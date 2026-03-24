// src/services/queue.service.ts
import { Queue } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export type AlertQueuePayload = {
  title: string;
  body: string;
  topic?: string;
  tokens?: string[];
  data?: Record<string, string>;
  imageUrl?: string;
};

/**
 * BullMQ requires an 'ioredis' compatible connection.
 * We use the standard REDIS_URL environment variable here.
 */
const connection = {
  url: process.env.REDIS_URL,
};

// Create a dedicated queue for high-priority notifications
export const notificationQueue = new Queue('notification-queue', { 
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times if FCM fails
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: true, // Keep Redis memory clean
  }
});

/**
 * Queue Service to abstract job additions.
 */
export class QueueService {
  /**
   * Enqueues a silent background sync job.
   * This is called by Admin Controllers.
   */
  static async enqueueSilentSync(tag: string) {
    await notificationQueue.add('silent-sync', { tag }, {
      priority: 1 // Highest priority to ensure real-time feel
    });
    console.log(`[QueueService] Enqueued silent-sync for tag: ${tag}`);
  }

  /**
   * Enqueues a standard visible alert push notification.
   */
  static async enqueueAlert(payload: AlertQueuePayload) {
    await notificationQueue.add('alert-push', payload);
  }
}
