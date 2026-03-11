// src/workers/submission.worker.ts

import { Worker, Job } from 'bullmq';
import prisma from '../config/db';
import IORedis from 'ioredis';
import redisClient from '../config/redis'; // Assumes ioredis instance

const workerConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null 
});
// This worker listens to the 'test-submissions' queue we created in the controller
const submissionWorker = new Worker('test-submissions', async (job: Job) => {
  const { 
    attemptId, 
    userId, 
    finalScore, 
    percentage, 
    subjectScores, 
    timeTakenSeconds 
  } = job.data;

  console.log(`[Worker] Processing submission for Attempt: ${attemptId} | User: ${userId}`);

  try {
    // 1. We wrap the Database writes in a single, fast transaction
    await prisma.$transaction(async (tx) => {
      
      // Update the test attempt with the final graded scores
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'completed',
          score: finalScore,
          percentage: percentage,
          subject_scores: subjectScores,
          submitted_at: new Date(),
          time_taken_seconds: timeTakenSeconds
        }
      });

      // Update the user's gamification XP (Base XP for test completion)
      await tx.user.update({
        where: { id: userId },
        data: { xp_total: { increment: 50 } } 
      });

    });

    console.log(`[Worker] Successfully saved Attempt: ${attemptId}`);

  } catch (error) {
    console.error(`[Worker] Failed to process Attempt: ${attemptId}`, error);
    // Throwing an error allows BullMQ to automatically retry based on the backoff settings
    throw error; 
  }
}, { 
  connection: workerConnection as any, 
  concurrency: 5 // Process 5 submissions concurrently per worker node
});

submissionWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

submissionWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});

export default submissionWorker;