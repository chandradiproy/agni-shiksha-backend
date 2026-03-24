"use strict";
// src/workers/submission.worker.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const db_1 = __importDefault(require("../config/db"));
const ioredis_1 = __importDefault(require("ioredis"));
const workerConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null
});
// This worker listens to the 'test-submissions' queue we created in the controller
const submissionWorker = new bullmq_1.Worker('test-submissions', (job) => __awaiter(void 0, void 0, void 0, function* () {
    const { attemptId, userId, finalScore, percentage, subjectScores, timeTakenSeconds } = job.data;
    console.log(`[Worker] Processing submission for Attempt: ${attemptId} | User: ${userId}`);
    try {
        // 1. We wrap the Database writes in a single, fast transaction
        yield db_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            // Update the test attempt with the final graded scores
            yield tx.testAttempt.update({
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
            yield tx.user.update({
                where: { id: userId },
                data: { xp_total: { increment: 50 } }
            });
        }));
        console.log(`[Worker] Successfully saved Attempt: ${attemptId}`);
    }
    catch (error) {
        console.error(`[Worker] Failed to process Attempt: ${attemptId}`, error);
        // Throwing an error allows BullMQ to automatically retry based on the backoff settings
        throw error;
    }
}), {
    connection: workerConnection,
    concurrency: 5 // Process 5 submissions concurrently per worker node
});
submissionWorker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});
submissionWorker.on('failed', (job, err) => {
    console.log(`Job ${job === null || job === void 0 ? void 0 : job.id} has failed with ${err.message}`);
});
exports.default = submissionWorker;
