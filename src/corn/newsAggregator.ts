// src/cron/newsAggregator.ts

import cron from 'node-cron';
import { fetchAndStoreNews } from '../services/newsService';

// Initialize the background jobs
export const initCronJobs = () => {
  console.log('[Cron] Initializing background jobs...');

  // Schedule: Runs at minute 0 past every 6th hour (e.g., 00:00, 06:00, 12:00, 18:00)
  // Format: 'Minute Hour Day Month DayOfWeek'
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Cron] Firing scheduled task: Current Affairs Aggregator');
    await fetchAndStoreNews();
  });

  console.log('[Cron] Background jobs successfully scheduled.');
};