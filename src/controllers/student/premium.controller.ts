// src/controllers/student/premium.controller.ts

import { Request, Response } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import prisma from '../../config/db';

// Initialize Razorpay SDK
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

// ==========================================
// 1. GET ACTIVE PLANS (For Mobile App Display)
// ==========================================
export const getActivePlans = async (req: Request, res: Response) => {
  try {
    // Fetch all active plans ordered by display priority
    const plans = await prisma.plan.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        monthly_price_paise: true,
        annual_price_paise: true,
        features: true // JSON object holding benefits list
      }
    });

    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    console.error('Fetch Plans Error:', error);
    res.status(500).json({ error: 'Failed to fetch premium plans' });
  }
};

// ==========================================
// 2. GENERATE RAZORPAY ORDER (Secure)
// ==========================================
export const createOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { planId, billingCycle } = req.body; // billingCycle must be 'monthly' or 'annual'

    if (!planId || !billingCycle || !['monthly', 'annual'].includes(billingCycle)) {
      return res.status(400).json({ error: 'Plan ID and valid billing cycle (monthly/annual) are required' });
    }

    // Securely pull the plan from DB
    const plan = await prisma.plan.findUnique({
      where: { id: planId, is_active: true }
    });

    if (!plan) {
      return res.status(404).json({ error: 'Selected plan is not available' });
    }

    // Determine the exact cost from the backend truth
    const amountInPaise = billingCycle === 'annual' ? plan.annual_price_paise : plan.monthly_price_paise;

    // Ask Razorpay to create a secure order
    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `receipt_order_${Date.now()}_${userId.substring(0, 5)}`,
    };

    const order = await razorpay.orders.create(options);

    // Log the transaction attempt in your Payment table
    await prisma.payment.create({
      data: {
        user_id: userId,
        gateway_order_id: order.id,
        amount_paise: amountInPaise,
        plan_id: plan.id,
        status: 'created',
        description: billingCycle // Clever trick: We save the cycle here so the webhook knows the duration!
      }
    });

    // Return ONLY the order ID and safe data to the client
    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan_name: plan.name
      }
    });

  } catch (error) {
    console.error('Create Razorpay Order Error:', error);
    res.status(500).json({ error: 'Failed to initialize payment gateway' });
  }
};

// ==========================================
// 3. RAZORPAY WEBHOOK (The Ultimate Source of Truth)
// ==========================================
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
    
    // Verify the cryptographic signature
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

    // ----------------------------------------------------
    // Handle Successful Payment
    // ----------------------------------------------------
    if (event === 'payment.captured') {
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;

      const paymentRecord = await prisma.payment.findUnique({
        where: { gateway_order_id: orderId }
      });

      if (!paymentRecord) {
        console.error(`[Webhook] Order ${orderId} not found in our database!`);
        return res.status(404).json({ status: 'Order not found' });
      }

      if (paymentRecord.status === 'success') {
        return res.status(200).json({ status: 'Already processed' });
      }

      // Execute atomic upgrade
      await prisma.$transaction(async (tx) => {
        // 1. Update Payment status
        await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: 'success',
            gateway_payment_id: paymentId
          }
        });

        // 2. DYNAMIC EXPIRATION LOGIC
        // We look at the 'description' field where we stored 'monthly' or 'annual'
        const durationMonths = paymentRecord.description === 'annual' ? 12 : 1;
        const startedAt = new Date();
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

        // 3. Create Official Subscription Record
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

        // 4. Upgrade the User Object (For fast dashboard tracking)
        await tx.user.update({
          where: { id: paymentRecord.user_id },
          data: {
            is_premium: true,
            premium_plan_id: paymentRecord.plan_id,
            premium_expires_at: expiresAt
          }
        });
      });

      console.log(`[Webhook] User ${paymentRecord.user_id} upgraded!`);
    }

    // ----------------------------------------------------
    // Handle Failed Payment
    // ----------------------------------------------------
    if (event === 'payment.failed') {
       const orderId = paymentEntity.order_id;
       const errorDescription = paymentEntity.error_description;

       await prisma.payment.update({
          where: { gateway_order_id: orderId },
          data: {
             status: 'failed',
             description: errorDescription // Optionally overwrite with actual error
          }
       });
       console.log(`[Webhook] Payment failed for order ${orderId}`);
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook Handling Error:', error);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};