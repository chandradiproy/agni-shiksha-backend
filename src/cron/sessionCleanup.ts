// src/cron/sessionCleanup.ts
import cron from 'node-cron';
import prisma from '../config/db';

export const startSessionCleanupCron = () => {
  cron.schedule('0 3 * * *', async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await prisma.userSession.deleteMany({
        where: {
          OR: [
            { is_active: false, created_at: { lt: thirtyDaysAgo } },
            { expires_at: { lt: thirtyDaysAgo } },
          ]
        }
      });
      console.log(`[SessionCleanup] Purged ${result.count} stale sessions.`);
    } catch (error) {
      console.error('[SessionCleanup] Error during session cleanup cron:', error);
    }
  });
};
