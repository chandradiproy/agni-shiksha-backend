"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.broadcastCacheInvalidation = void 0;
const db_1 = __importDefault(require("../config/db"));
const admin = __importStar(require("firebase-admin"));
const broadcastCacheInvalidation = (target) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const usersWithTokens = yield db_1.default.user.findMany({
            where: { device_tokens: { not: { equals: [] } } },
            select: { device_tokens: true }
        });
        // Flatten all active tokens
        const allTokens = usersWithTokens.flatMap(u => u.device_tokens || []);
        if (allTokens.length === 0)
            return;
        // Firebase only accepts 500 tokens max per multicast message
        const chunkSize = 500;
        for (let i = 0; i < allTokens.length; i += chunkSize) {
            const chunk = allTokens.slice(i, i + chunkSize);
            yield admin.messaging().sendEachForMulticast({
                tokens: chunk,
                data: { type: 'CACHE_INVALIDATE', target, sentAt: Date.now().toString() },
                android: { priority: 'high' }
            });
        }
        console.log(`[Broadcast] Silently invalidated ${target} cache for ${allTokens.length} devices.`);
    }
    catch (err) {
        console.error(`[Broadcast] Failed to send cache invalidation push for ${target}`, err);
    }
});
exports.broadcastCacheInvalidation = broadcastCacheInvalidation;
