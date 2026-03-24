// src/controllers/student/premium.controller.ts

import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../../config/db';
import { CacheService } from '../../services/cache.service';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

// Helper function to validate and calculate discounts securely
const calculateDiscountedPrice = async (planId: string, billingCycle: string, couponCode?: string) => {
  const plan = await prisma.plan.findUnique({ where: { id: planId, is_active: true } });
  if (!plan) throw new Error('Selected plan is not available');

  let baseAmountPaise = billingCycle === 'annual' ? plan.annual_price_paise : plan.monthly_price_paise;
  let finalAmountPaise = baseAmountPaise;
  let couponDetails = null;

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    
    if (!coupon) throw new Error('Invalid coupon code');
    if (!coupon.is_active) throw new Error('Coupon is currently inactive');
    if (coupon.valid_until && new Date() > coupon.valid_until) throw new Error('Coupon has expired');
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) throw new Error('Coupon usage limit reached');
    if (coupon.applicable_plan_id && coupon.applicable_plan_id !== plan.id) throw new Error('Coupon is not applicable for this plan');

    // Calculate Discount
    if (coupon.discount_type === 'PERCENTAGE') {
      const discountAmount = (baseAmountPaise * coupon.discount_value) / 100;
      finalAmountPaise = baseAmountPaise - discountAmount;
    } else if (coupon.discount_type === 'FLAT') {
      // Flat value is stored in INR, convert to Paise
      const discountAmountPaise = coupon.discount_value * 100; 
      finalAmountPaise = baseAmountPaise - discountAmountPaise;
    }

    // Razorpay minimum payment is 1 INR (100 Paise)
    finalAmountPaise = Math.max(finalAmountPaise, 100); 
    couponDetails = coupon;
  }

  return { plan, baseAmountPaise, finalAmountPaise, coupon: couponDetails };
};

// ==========================================
// 1. GET ACTIVE PLANS
// ==========================================
export const getActivePlans = async (req: Request, res: Response) => {
  try {
    const cacheScope = 'premium:active_plans';
    let plans = await CacheService.get<any[]>('premium', cacheScope);

    if (!plans) {
      plans = await prisma.plan.findMany({
        where: { is_active: true },
        orderBy: { display_order: 'asc' },
        select: { id: true, name: true, slug: true, monthly_price_paise: true, annual_price_paise: true, features: true }
      });
      await CacheService.set('premium', cacheScope, plans, 1800);
    }

    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch premium plans' });
  }
};

// ==========================================
// 2. VALIDATE COUPON (For Mobile App Checkout UI)
// ==========================================
export const validateCoupon = async (req: Request, res: Response) => {
  try {
    const { planId, billingCycle, couponCode } = req.body;

    if (!planId || !billingCycle || !couponCode) {
      return res.status(400).json({ error: 'Plan ID, billing cycle, and coupon code are required' });
    }

    const { baseAmountPaise, finalAmountPaise } = await calculateDiscountedPrice(planId, billingCycle, couponCode);

    res.status(200).json({
      success: true,
      data: {
        original_price_inr: baseAmountPaise / 100,
        discounted_price_inr: finalAmountPaise / 100,
        savings_inr: (baseAmountPaise - finalAmountPaise) / 100
      }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// ==========================================
// 3. GENERATE RAZORPAY ORDER (Secure)
// ==========================================
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { planId, billingCycle, couponCode } = req.body; 

    if (!planId || !billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({ error: 'Plan ID and valid billing cycle are required' });
    }

    // Calculate final price securely on the backend
    const { plan, finalAmountPaise, coupon } = await calculateDiscountedPrice(planId, billingCycle, couponCode);

    const options = {
      amount: finalAmountPaise,
      currency: "INR",
      receipt: `receipt_order_${Date.now()}_${userId.substring(0, 5)}`,
    };

    const order = await razorpay.orders.create(options);

    // Log the transaction attempt including the coupon used!
    await prisma.payment.create({
      data: {
        user_id: userId,
        gateway_order_id: order.id,
        amount_paise: finalAmountPaise,
        plan_id: plan.id,
        status: 'created',
        description: billingCycle, 
        coupon_id: coupon ? coupon.id : null // Save the coupon ID to track usage
      }
    });

    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan_name: plan.name,
        coupon_applied: !!coupon
      }
    });

  } catch (error: any) {
    res.status(error.message === 'Failed to initialize payment gateway' ? 500 : 400).json({ 
      error: error.message || 'Failed to initialize payment gateway' 
    });
  }
};

// ==========================================
// 4. RAZORPAY WEBHOOK
// ==========================================
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
    
    const signature = req.headers['x-razorpay-signature'] as string;
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('[SECURITY ALERT] Invalid Razorpay Webhook Signature!');
      return res.status(400).json({ status: 'Invalid signature' });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;

    if (event === 'payment.captured') {
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const paymentRecord = await prisma.payment.findUnique({
        where: { gateway_order_id: orderId }
      });

      if (!paymentRecord) return res.status(404).json({ status: 'Order not found' });
      if (paymentRecord.status === 'success') return res.status(200).json({ status: 'Already processed' });

      await prisma.$transaction(async (tx) => {
        // 1. Update Payment status
        await tx.payment.update({
          where: { id: paymentRecord.id },
          data: { status: 'success', gateway_payment_id: paymentId }
        });

        // 2. INCREMENT COUPON USAGE IF ONE WAS USED
        if (paymentRecord.coupon_id) {
          await tx.coupon.update({
            where: { id: paymentRecord.coupon_id },
            data: { current_uses: { increment: 1 } }
          });
        }

        const durationMonths = paymentRecord.description === 'annual' ? 12 : 1;
        const startedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        // 3. Create Subscription Record
        await tx.subscription.create({
          data: {
            user_id: paymentRecord.user_id,
            plan_id: paymentRecord.plan_id!,
            started_at: startedAt,
            expires_at: expiresAt,
            status: 'active',
            payment_gateway: 'razorpay'
          }
        });

        // 4. Upgrade User
        await tx.user.update({
          where: { id: paymentRecord.user_id },
          data: { is_premium: true, premium_plan_id: paymentRecord.plan_id, premium_expires_at: expiresAt }
        });
      });
      console.log(`[Webhook] User ${paymentRecord.user_id} upgraded!`);
    }

    if (event === 'payment.failed') {
       const orderId = paymentEntity.order_id;
       await prisma.payment.update({
          where: { gateway_order_id: orderId },
          data: { status: 'failed', description: paymentEntity.error_description }
       });
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Handling Error:', error);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};
