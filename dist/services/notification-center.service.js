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
exports.NotificationCenterService = void 0;
const db_1 = __importDefault(require("../config/db"));
const notification_service_1 = require("./notification.service");
const queue_service_1 = require("./queue.service");
const normalizeStringArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean);
};
const buildPushData = (input) => {
    const data = {
        notificationId: input.notificationId,
        type: input.type,
    };
    if (input.deepLink)
        data.deepLink = input.deepLink;
    if (input.entityType)
        data.entityType = input.entityType;
    if (input.entityId)
        data.entityId = input.entityId;
    return data;
};
class NotificationCenterService {
    static resolveAudienceUsers(audienceType, userIds, targetExamId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (audienceType === 'USERS') {
                const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
                if (uniqueUserIds.length === 0) {
                    throw new Error('At least one target user is required for USERS audience.');
                }
                return db_1.default.user.findMany({
                    where: {
                        id: { in: uniqueUserIds },
                        is_active: true,
                        is_banned: false,
                        deleted_at: null,
                    },
                    select: {
                        id: true,
                        device_tokens: true,
                    },
                });
            }
            if (audienceType === 'EXAM') {
                if (!targetExamId) {
                    throw new Error('target_exam_id is required for EXAM audience.');
                }
                return db_1.default.user.findMany({
                    where: {
                        target_exam_id: targetExamId,
                        is_active: true,
                        is_banned: false,
                        deleted_at: null,
                    },
                    select: {
                        id: true,
                        device_tokens: true,
                    },
                });
            }
            return db_1.default.user.findMany({
                where: {
                    is_active: true,
                    is_banned: false,
                    deleted_at: null,
                },
                select: {
                    id: true,
                    device_tokens: true,
                },
            });
        });
    }
    static createAdminNotification(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const audienceType = (input.audienceType || 'ALL').toUpperCase();
            const type = input.type || 'GENERAL';
            const sendPush = (_a = input.sendPush) !== null && _a !== void 0 ? _a : true;
            const users = yield this.resolveAudienceUsers(audienceType, input.userIds, input.targetExamId);
            if (users.length === 0) {
                throw new Error('No eligible student recipients were found for this notification.');
            }
            const notification = yield db_1.default.$transaction((tx) => __awaiter(this, void 0, void 0, function* () {
                const createdNotification = yield tx.notification.create({
                    data: {
                        title: input.title,
                        body: input.body,
                        type,
                        audience_type: audienceType,
                        image_url: input.imageUrl,
                        deep_link: input.deepLink,
                        entity_type: input.entityType,
                        entity_id: input.entityId,
                        metadata: input.metadata || {},
                        created_by: input.adminId,
                    },
                });
                yield tx.studentNotification.createMany({
                    data: users.map((user) => ({
                        user_id: user.id,
                        notification_id: createdNotification.id,
                    })),
                });
                yield tx.adminAuditLog.create({
                    data: {
                        admin_id: input.adminId,
                        action: 'CREATED_NOTIFICATION',
                        target_id: createdNotification.id,
                        details: {
                            audience_type: audienceType,
                            recipient_count: users.length,
                            type,
                        },
                    },
                });
                return createdNotification;
            }));
            const tokens = [...new Set(users.flatMap((user) => normalizeStringArray(user.device_tokens)))];
            if (sendPush && tokens.length > 0) {
                yield queue_service_1.QueueService.enqueueAlert({
                    title: input.title,
                    body: input.body,
                    tokens,
                    imageUrl: input.imageUrl,
                    data: buildPushData({
                        notificationId: notification.id,
                        type,
                        deepLink: input.deepLink,
                        entityType: input.entityType,
                        entityId: input.entityId,
                    }),
                });
            }
            return {
                notification,
                recipientCount: users.length,
                pushTargetCount: tokens.length,
            };
        });
    }
    static getStudentInbox(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, page, limit, unreadOnly } = options;
            const skip = (page - 1) * limit;
            const whereClause = Object.assign({ user_id: userId }, (unreadOnly ? { is_read: false } : {}));
            const [items, total, unreadCount] = yield db_1.default.$transaction([
                db_1.default.studentNotification.findMany({
                    where: whereClause,
                    skip,
                    take: limit,
                    orderBy: { created_at: 'desc' },
                    include: {
                        notification: true,
                    },
                }),
                db_1.default.studentNotification.count({
                    where: whereClause,
                }),
                db_1.default.studentNotification.count({
                    where: {
                        user_id: userId,
                        is_read: false,
                    },
                }),
            ]);
            return {
                items,
                total,
                unreadCount,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }
    static markAsRead(userId, studentNotificationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield db_1.default.studentNotification.findFirst({
                where: {
                    id: studentNotificationId,
                    user_id: userId,
                },
            });
            if (!existing) {
                return null;
            }
            if (existing.is_read) {
                return existing;
            }
            return db_1.default.studentNotification.update({
                where: { id: studentNotificationId },
                data: {
                    is_read: true,
                    read_at: new Date(),
                },
                include: {
                    notification: true,
                },
            });
        });
    }
    static markAllAsRead(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield db_1.default.studentNotification.updateMany({
                where: {
                    user_id: userId,
                    is_read: false,
                },
                data: {
                    is_read: true,
                    read_at: new Date(),
                },
            });
            return result.count;
        });
    }
    static registerDeviceToken(userId, token, deviceFingerprint) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield db_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    device_tokens: true,
                    device_fingerprints: true,
                },
            });
            if (!user) {
                throw new Error('User not found');
            }
            const tokens = normalizeStringArray(user.device_tokens);
            const fingerprints = normalizeStringArray(user.device_fingerprints);
            if (!tokens.includes(token)) {
                tokens.push(token);
            }
            if (deviceFingerprint && !fingerprints.includes(deviceFingerprint)) {
                fingerprints.push(deviceFingerprint);
            }
            const updatedUser = yield db_1.default.user.update({
                where: { id: userId },
                data: {
                    device_tokens: tokens,
                    device_fingerprints: fingerprints,
                },
                select: {
                    device_tokens: true,
                },
            });
            yield notification_service_1.NotificationService.subscribeTokenToGlobalTopic(token);
            return {
                device_tokens: normalizeStringArray(updatedUser.device_tokens),
            };
        });
    }
    static unregisterDeviceToken(userId, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield db_1.default.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    device_tokens: true,
                },
            });
            if (!user) {
                throw new Error('User not found');
            }
            const updatedTokens = normalizeStringArray(user.device_tokens).filter((existingToken) => existingToken !== token);
            yield db_1.default.user.update({
                where: { id: userId },
                data: {
                    device_tokens: updatedTokens,
                },
            });
            yield notification_service_1.NotificationService.unsubscribeTokenFromGlobalTopic(token);
            return {
                device_tokens: updatedTokens,
            };
        });
    }
    static getAdminNotifications(page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const skip = (page - 1) * limit;
            const [items, total] = yield db_1.default.$transaction([
                db_1.default.notification.findMany({
                    skip,
                    take: limit,
                    orderBy: { created_at: 'desc' },
                    include: {
                        creator: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                        _count: {
                            select: {
                                recipients: true,
                            },
                        },
                    },
                }),
                db_1.default.notification.count(),
            ]);
            return {
                items,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }
}
exports.NotificationCenterService = NotificationCenterService;
