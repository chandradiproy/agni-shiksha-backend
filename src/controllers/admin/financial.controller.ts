import Razorpay from 'razorpay';
import { Request, Response } from 'express';
import prisma from '../../config/db';

// Initialize Razorpay SDK for admin verification
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret',
});

// ==========================================
// 1. GET ALL PAYMENTS (Transactions Ledger)
// ==========================================
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Optional filters
    const status = req.query.status as string; // 'created', 'success', 'failed'
    const orderId = req.query.orderId as string;
    
    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (orderId) whereClause.gateway_order_id = { contains: orderId, mode: 'insensitive' };

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { id: true, full_name: true, email: true, phone_number: true } },
          plan: { select: { name: true } }
        }
      }),
      prisma.payment.count({ where: whereClause })
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Fetch Payments Error:', error);
    res.status(500).json({ error: 'Failed to fetch payment records' });
  }
};

// ==========================================
// 2. GET ALL SUBSCRIPTIONS (Active/Expired)
// ==========================================
export const getAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const status = req.query.status as string; // 'active' or 'expired'
    const planId = req.query.planId as string;

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (planId) whereClause.plan_id = planId;

    const [subscriptions, totalCount] = await Promise.all([
      prisma.subscription.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { started_at: 'desc' },
        include: {
          user: { select: { id: true, full_name: true, email: true, phone_number: true } },
          plan: { select: { name: true, monthly_price_paise: true, annual_price_paise: true } }
        }
      }),
      prisma.subscription.count({ where: whereClause })
    ]);

    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Fetch Subscriptions Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription records' });
  }
};

// ==========================================
// 3. GET FINANCIAL SUMMARY DASHBOARD (FIXED ACCOUNTING)
// ==========================================
export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    // Run concurrent aggregate queries
    const [
      totalRevenuePaise,
      successfulPaymentsCount,
      activeSubscriptions,
      expiredSubscriptions,
      revokedSubscriptions // <-- NEW: Added revoked tracking
    ] = await Promise.all([
      // Sum all successful payments (Refunded/Revoked payments are now excluded)
      prisma.payment.aggregate({
        where: { status: 'success' },
        _sum: { amount_paise: true }
      }),
      // Count successful payments
      prisma.payment.count({ where: { status: 'success' } }),
      // Count subscriptions
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.subscription.count({ where: { status: 'expired' } }),
      prisma.subscription.count({ where: { status: 'revoked' } }) // <-- NEW
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_revenue_inr: (totalRevenuePaise._sum.amount_paise || 0) / 100,
        total_successful_payments: successfulPaymentsCount,
        active_subscribers: activeSubscriptions,
        expired_subscribers: expiredSubscriptions,
        revoked_subscribers: revokedSubscriptions // <-- NEW
      }
    });

  } catch (error) {
    console.error('Financial Summary Error:', error);
    res.status(500).json({ error: 'Failed to generate financial summary' });
  }
};

// ==========================================
// 4. MANUAL PAYMENT VERIFICATION (Sync with Razorpay)
// Handles Scenario 1: False Negatives
// ==========================================
export const verifyPaymentSync = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params; // Our internal Payment table ID
    const adminId = (req as any).admin.id as string;

    const paymentRecord = await prisma.payment.findUnique({
      where: { id: paymentId as string }
    });

    if (!paymentRecord) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (paymentRecord.status === 'success') {
      return res.status(400).json({ error: 'Payment is already marked as successful' });
    }

    // 1. Ask Razorpay for all payments associated with this Order ID
    const razorpayPayments = await razorpay.orders.fetchPayments(paymentRecord.gateway_order_id);

    // 2. Look for a successful payment in the Razorpay response
    const successfulPayment = razorpayPayments.items.find((p: any) => p.status === 'captured');

    if (successfulPayment) {
      // The user DID pay, but our webhook missed it! Let's fulfill the order manually.
      
      const durationMonths = paymentRecord.description === 'annual' ? 12 : 1;
      const startedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      await prisma.$transaction(async (tx) => {
        // Update Payment status
        await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: 'success',
            gateway_payment_id: successfulPayment.id
          }
        });

        // Create Subscription Record
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

        // Upgrade User
        await tx.user.update({
          where: { id: paymentRecord.user_id },
          data: {
            is_premium: true,
            premium_plan_id: paymentRecord.plan_id,
            premium_expires_at: expiresAt
          }
        });
      });

      // Audit Log the manual intervention
      await prisma.adminAuditLog.create({
        data: {
          admin_id: adminId,
          action: 'MANUAL_PAYMENT_SYNC',
          target_id: paymentRecord.id,
          details: { resolved: true, razorpay_payment_id: successfulPayment.id }
        }
      });

      return res.status(200).json({ success: true, message: 'Payment verified and user successfully upgraded.' });
    }

    // If we reach here, Razorpay also says the payment failed or hasn't happened.
    return res.status(200).json({ success: false, message: 'Razorpay confirms this payment was not successful.' });

  } catch (error) {
    console.error('Verify Payment Sync Error:', error);
    res.status(500).json({ error: 'Failed to sync with Razorpay' });
  }
};

// ==========================================
// 5. MANUALLY REVOKE SUBSCRIPTION (FIXED REVENUE INFLATION)
// Handles Scenario 2: False Positives or Refunds
// ==========================================
export const revokeSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).admin.id as string;

    if (!reason) {
      return res.status(400).json({ error: 'A reason must be provided for revoking a subscription.' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId as string }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (subscription.status !== 'active') {
      return res.status(400).json({ error: 'Only active subscriptions can be revoked.' });
    }

    // FIX: Find the successful payment that triggered this subscription
    const relatedPayment = await prisma.payment.findFirst({
      where: { 
        user_id: subscription.user_id, 
        plan_id: subscription.plan_id, 
        status: 'success' 
      },
      orderBy: { created_at: 'desc' }
    });

    await prisma.$transaction(async (tx) => {
      // 1. Mark subscription as revoked
      await tx.subscription.update({
        where: { id: subscriptionId as string },
        data: { status: 'revoked' }
      });

      // 2. Demote the user
      await tx.user.update({
        where: { id: subscription.user_id },
        data: {
          is_premium: false,
          premium_plan_id: null,
          premium_expires_at: null
        }
      });

      // 3. NEW FIX: Correct the accounting! Mark the payment as revoked so revenue drops.
      if (relatedPayment) {
        await tx.payment.update({
          where: { id: relatedPayment.id },
          data: { status: 'revoked' }
        });
      }
    });

    // Audit Log the revocation
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'REVOKED_SUBSCRIPTION',
        target_id: subscriptionId as string,
        details: { reason, payment_revoked: !!relatedPayment }
      }
    });

    res.status(200).json({ success: true, message: 'Subscription and associated payment manually revoked.' });

  } catch (error) {
    console.error('Revoke Subscription Error:', error);
    res.status(500).json({ error: 'Failed to revoke subscription' });
  }
};

// ==========================================
// 6. MANUALLY REFUND A PAYMENT
// Marks payment as refunded and revokes associated subscription
// ==========================================
export const refundPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).admin.id as string;

    if (!reason) {
      return res.status(400).json({ error: 'A reason must be provided for refunding a payment.' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId as string }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'success') {
      return res.status(400).json({ error: 'Only successful payments can be refunded.' });
    }

    // Find if there is an active subscription tied to this payment's plan and user
    const associatedSubscription = await prisma.subscription.findFirst({
      where: {
        user_id: payment.user_id,
        plan_id: payment.plan_id!,
        status: 'active'
      }
    });

    await prisma.$transaction(async (tx) => {
      // 1. Mark payment as refunded
      await tx.payment.update({
        where: { id: paymentId as string },
        data: { status: 'refunded', description: `Refunded: ${reason}` }
      });

      // 2. If there's an active subscription, revoke it and demote user
      if (associatedSubscription) {
        await tx.subscription.update({
          where: { id: associatedSubscription.id },
          data: { status: 'revoked' }
        });

        await tx.user.update({
          where: { id: payment.user_id },
          data: {
            is_premium: false,
            premium_plan_id: null,
            premium_expires_at: null
          }
        });
      }
    });

    // Audit Log the refund
    await prisma.adminAuditLog.create({
      data: {
        admin_id: adminId,
        action: 'REFUNDED_PAYMENT',
        target_id: paymentId as string,
        details: { reason, subscription_revoked: !!associatedSubscription }
      }
    });

    res.status(200).json({ success: true, message: 'Payment refunded and user demoted successfully.' });

  } catch (error) {
    console.error('Refund Payment Error:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
};