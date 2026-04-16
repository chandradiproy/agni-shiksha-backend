import prisma from '../config/db';
import * as admin from 'firebase-admin';

export const broadcastCacheInvalidation = async (target: string) => {
  try {
    const usersWithTokens = await prisma.user.findMany({
      where: { device_tokens: { not: { equals: [] } } },
      select: { device_tokens: true }
    });
    
    // Flatten all active tokens
    const allTokens = usersWithTokens.flatMap(u => (u.device_tokens as string[]) || []);
    if (allTokens.length === 0) return;

    // Firebase only accepts 500 tokens max per multicast message
    const chunkSize = 500;
    for (let i = 0; i < allTokens.length; i += chunkSize) {
      const chunk = allTokens.slice(i, i + chunkSize);
      await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        data: { type: 'CACHE_INVALIDATE', target, sentAt: Date.now().toString() },
        android: { priority: 'high' }
      });
    }
    console.log(`[Broadcast] Silently invalidated ${target} cache for ${allTokens.length} devices.`);
  } catch (err) {
    console.error(`[Broadcast] Failed to send cache invalidation push for ${target}`, err);
  }
};
