// src/cron/premiumExpirer.ts

import cron from 'node-cron';
import prisma from '../config/db';

// This job runs every day at 00:01 AM (1 minute past midnight)
export const schedulePremiumExpirer = () => {
  cron.schedule('1 0 * * *', async () => {
    console.log('[Cron] Running Premium Expiration Check...');

    try {
      const now = new Date();

      // We use a transaction to ensure both the Subscription ledger and User states are updated together
      const [updatedSubscriptions, updatedUsers] = await prisma.$transaction([
        
        // 1. Mark the official Subscription ledger records as 'expired'
        prisma.subscription.updateMany({
          where: {
            status: 'active',
            expires_at: { lt: now }
          },
          data: {
            status: 'expired'
          }
        }),

        // 2. Demote the User and wipe their active plan data
        prisma.user.updateMany({
          where: {
            is_premium: true,
            premium_expires_at: { lt: now }
          },
          data: {
            is_premium: false,
            premium_plan_id: null, 
            premium_expires_at: null 
          }
        })
      ]);

      console.log(`[Cron] Premium Expiration Check complete.`);
      console.log(` -> Marked ${updatedSubscriptions.count} subscriptions as expired.`);
      console.log(` -> Demoted ${updatedUsers.count} users to free tier.`);
      
    } catch (error) {
      console.error('[Cron] Failed to execute Premium Expiration Check:', error);
    }
  });

  console.log('[Cron] Premium Expirer Job Scheduled.');
};