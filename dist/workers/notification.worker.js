"use strict";
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
exports.notificationWorker = void 0;
// src/workers/notification.worker.ts
const bullmq_1 = require("bullmq");
const notification_service_1 = require("../services/notification.service");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connection = {
    url: process.env.REDIS_URL,
};
console.log('[Worker] Starting Notification Worker...');
/**
 * The Notification Worker listens to the 'notification-queue'
 * and processes jobs entirely in the background, freeing up the main API.
 */
exports.notificationWorker = new bullmq_1.Worker('notification-queue', (job) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`[Worker] Processing job ${job.id} of type ${job.name}`);
    try {
        if (job.name === 'silent-sync') {
            const { tag } = job.data;
            // Calls the FCM service we created earlier
            yield notification_service_1.NotificationService.triggerSync(tag);
            console.log(`[Worker] Successfully dispatched silent-sync for tag: ${tag}`);
        }
        else if (job.name === 'alert-push') {
            const { title, body, topic } = job.data;
            yield notification_service_1.NotificationService.sendAlert(title, body, topic);
            console.log(`[Worker] Successfully dispatched alert-push: ${title}`);
        }
    }
    catch (error) {
        console.error(`[Worker] Job ${job.id} failed:`, error);
        throw error; // Let BullMQ handle the retry logic
    }
}), {
    connection,
    concurrency: 5 // Process up to 5 notifications concurrently
});
// Graceful error handling for the worker
exports.notificationWorker.on('error', (err) => {
    console.error('[Worker] Unexpected Error:', err);
});
