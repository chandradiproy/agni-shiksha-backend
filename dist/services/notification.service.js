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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
// src/services/notification.service.ts
const admin = __importStar(require("firebase-admin"));
/**
 * Notification Service for high-throughput real-time updates.
 * Handles both visible alerts and silent background synchronization.
 */
class NotificationService {
    static chunkTokens(tokens, size = 500) {
        const chunks = [];
        for (let index = 0; index < tokens.length; index += size) {
            chunks.push(tokens.slice(index, index + size));
        }
        return chunks;
    }
    static getGlobalTopic() {
        return this.GLOBAL_TOPIC;
    }
    /**
     * Triggers a Silent Push to all devices subscribed to the global topic.
     * This wakes up the app to perform a background cache refresh.
     */
    static triggerSync(tag) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = {
                data: {
                    type: "CACHE_INVALIDATE",
                    target: tag,
                    tag: tag,
                    timestamp: Date.now().toString(),
                },
                topic: this.GLOBAL_TOPIC,
                // Priority settings to ensure delivery while optimizing battery
                android: {
                    priority: "high",
                },
                apns: {
                    payload: {
                        aps: {
                            "content-available": 1, // Required for iOS background wake-up
                        },
                    },
                    headers: {
                        "apns-push-type": "background",
                        "apns-priority": "5",
                    },
                },
            };
            try {
                yield admin.messaging().send(message);
            }
            catch (error) {
                console.error(`FCM Sync Error for tag ${tag}:`, error);
            }
        });
    }
    /**
     * Sends a standard visible notification to a topic or specific user.
     */
    static sendAlert(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { title, body, topic = this.GLOBAL_TOPIC, tokens = [], data, imageUrl, } = payload;
            const uniqueTokens = [...new Set(tokens.filter(Boolean))];
            try {
                if (uniqueTokens.length > 0) {
                    for (const chunk of this.chunkTokens(uniqueTokens)) {
                        const response = yield admin.messaging().sendEachForMulticast({
                            tokens: chunk,
                            notification: { title, body, imageUrl },
                            data,
                            android: {
                                priority: 'high',
                                notification: Object.assign({ channelId: 'high_priority', sound: 'default' }, (imageUrl ? { imageUrl } : {})),
                            },
                            apns: imageUrl
                                ? {
                                    fcmOptions: {
                                        imageUrl,
                                    },
                                }
                                : undefined,
                        });
                        if (response.failureCount > 0) {
                            console.error('[FCM Alert Warning] Some multicast notifications failed to send.', {
                                successCount: response.successCount,
                                failureCount: response.failureCount,
                            });
                        }
                    }
                    return;
                }
                const message = {
                    notification: { title, body, imageUrl },
                    data,
                    topic,
                };
                yield admin.messaging().send(message);
            }
            catch (error) {
                console.error('FCM Alert Error:', error);
            }
        });
    }
    static subscribeTokenToGlobalTopic(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield admin.messaging().subscribeToTopic([token], this.GLOBAL_TOPIC);
            }
            catch (error) {
                console.error('FCM Subscribe Error:', error);
            }
        });
    }
    static unsubscribeTokenFromGlobalTopic(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield admin.messaging().unsubscribeFromTopic([token], this.GLOBAL_TOPIC);
            }
            catch (error) {
                console.error('FCM Unsubscribe Error:', error);
            }
        });
    }
}
exports.NotificationService = NotificationService;
NotificationService.GLOBAL_TOPIC = 'global_updates';
