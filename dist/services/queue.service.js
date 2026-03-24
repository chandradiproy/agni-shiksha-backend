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
exports.QueueService = exports.notificationQueue = void 0;
// src/services/queue.service.ts
const bullmq_1 = require("bullmq");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * BullMQ requires an 'ioredis' compatible connection.
 * We use the standard REDIS_URL environment variable here.
 */
const connection = {
    url: process.env.REDIS_URL,
};
// Create a dedicated queue for high-priority notifications
exports.notificationQueue = new bullmq_1.Queue('notification-queue', {
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
class QueueService {
    /**
     * Enqueues a silent background sync job.
     * This is called by Admin Controllers.
     */
    static enqueueSilentSync(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            yield exports.notificationQueue.add('silent-sync', { tag }, {
                priority: 1 // Highest priority to ensure real-time feel
            });
            console.log(`[QueueService] Enqueued silent-sync for tag: ${tag}`);
        });
    }
    /**
     * Enqueues a standard visible alert push notification.
     */
    static enqueueAlert(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield exports.notificationQueue.add('alert-push', payload);
        });
    }
}
exports.QueueService = QueueService;
