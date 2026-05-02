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
exports.startSessionCleanupCron = void 0;
// src/cron/sessionCleanup.ts
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
const startSessionCleanupCron = () => {
    node_cron_1.default.schedule('0 3 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const result = yield db_1.default.userSession.deleteMany({
                where: {
                    OR: [
                        { is_active: false, created_at: { lt: thirtyDaysAgo } },
                        { expires_at: { lt: thirtyDaysAgo } },
                    ]
                }
            });
            console.log(`[SessionCleanup] Purged ${result.count} stale sessions.`);
        }
        catch (error) {
            console.error('[SessionCleanup] Error during session cleanup cron:', error);
        }
    }));
};
exports.startSessionCleanupCron = startSessionCleanupCron;
