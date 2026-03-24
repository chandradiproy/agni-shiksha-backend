"use strict";
// src/cron/premiumExpirer.ts
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
exports.schedulePremiumExpirer = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = __importDefault(require("../config/db"));
// This job runs every day at 00:01 AM (1 minute past midnight)
const schedulePremiumExpirer = () => {
    node_cron_1.default.schedule('1 0 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
        console.log('[Cron] Running Premium Expiration Check...');
        try {
            const now = new Date();
            // We use a transaction to ensure both the Subscription ledger and User states are updated together
            const [updatedSubscriptions, updatedUsers] = yield db_1.default.$transaction([
                // 1. Mark the official Subscription ledger records as 'expired'
                db_1.default.subscription.updateMany({
                    where: {
                        status: 'active',
                        expires_at: { lt: now }
                    },
                    data: {
                        status: 'expired'
                    }
                }),
                // 2. Demote the User and wipe their active plan data
                db_1.default.user.updateMany({
                    where: {
                        is_premium: true,
                        premium_expires_at: { lt: now }
                    },
                    data: {
                        is_premium: false,
                        premium_plan_id: null,
                        premium_expires_at: null
                    }
                })
            ]);
            console.log(`[Cron] Premium Expiration Check complete.`);
            console.log(` -> Marked ${updatedSubscriptions.count} subscriptions as expired.`);
            console.log(` -> Demoted ${updatedUsers.count} users to free tier.`);
        }
        catch (error) {
            console.error('[Cron] Failed to execute Premium Expiration Check:', error);
        }
    }));
    console.log('[Cron] Premium Expirer Job Scheduled.');
};
exports.schedulePremiumExpirer = schedulePremiumExpirer;
