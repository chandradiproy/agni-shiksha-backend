"use strict";
// src/cron/newsAggregator.ts
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
exports.initCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const newsService_1 = require("../services/newsService");
// Initialize the background jobs
const initCronJobs = () => {
    console.log('[Cron] Initializing background jobs...');
    // Schedule: Runs at minute 0 past every 6th hour (e.g., 00:00, 06:00, 12:00, 18:00)
    // Format: 'Minute Hour Day Month DayOfWeek'
    node_cron_1.default.schedule('0 */6 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('[Cron] Firing scheduled task: Current Affairs Aggregator');
        yield (0, newsService_1.fetchAndStoreNews)();
    }));
    console.log('[Cron] Background jobs successfully scheduled.');
};
exports.initCronJobs = initCronJobs;
