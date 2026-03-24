// src/workers/notification.worker.ts
import { Worker, Job } from 'bullmq';
import { NotificationService } from '../services/notification.service';
import initializeFirebase from '../config/firebase';
import dotenv from 'dotenv';

dotenv.config();
initializeFirebase();

const connection = {
  url: process.env.REDIS_URL,
};

console.log('[Worker] Starting Notification Worker...');

/**
 * The Notification Worker listens to the 'notification-queue' 
 * and processes jobs entirely in the background, freeing up the main API.
 */
export const notificationWorker = new Worker(
  'notification-queue',
  async (job: Job) => {
    console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);

    try {
      if (job.name === 'silent-sync') {
        const { tag } = job.data;
        // Calls the FCM service we created earlier
        await NotificationService.triggerSync(tag);
        console.log(`[Worker] Successfully dispatched silent-sync for tag: ${tag}`);
      } 
      else if (job.name === 'alert-push') {
        const { title, body } = job.data;
        await NotificationService.sendAlert(job.data);
        console.log(`[Worker] Successfully dispatched alert-push: ${title} - ${body}`);
      }
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      throw error; // Let BullMQ handle the retry logic
    }
  },
  { 
    connection,
    concurrency: 5 // Process up to 5 notifications concurrently
  }
);

// Graceful error handling for the worker
notificationWorker.on('error', (err) => {
  console.error('[Worker] Unexpected Error:', err);
});
