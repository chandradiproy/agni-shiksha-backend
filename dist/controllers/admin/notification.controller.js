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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = exports.createNotification = void 0;
const notification_center_service_1 = require("../../services/notification-center.service");
const createNotification = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const adminId = req.admin.id;
        const { title, body, type, image_url, deep_link, entity_type, entity_id, metadata, audience_type, user_ids, target_exam_id, send_push, } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }
        const result = yield notification_center_service_1.NotificationCenterService.createAdminNotification({
            adminId,
            title,
            body,
            type,
            imageUrl: image_url,
            deepLink: deep_link,
            entityType: entity_type,
            entityId: entity_id,
            metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
            audienceType: typeof audience_type === 'string' ? audience_type.toUpperCase() : undefined,
            userIds: Array.isArray(user_ids) ? user_ids : undefined,
            targetExamId: typeof target_exam_id === 'string' ? target_exam_id : undefined,
            sendPush: send_push === undefined ? true : Boolean(send_push),
        });
        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            data: result.notification,
            recipient_count: result.recipientCount,
            push_target_count: result.pushTargetCount,
        });
    }
    catch (error) {
        console.error('Create Notification Error:', error);
        res.status(400).json({ error: error.message || 'Failed to create notification' });
    }
});
exports.createNotification = createNotification;
const getNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const result = yield notification_center_service_1.NotificationCenterService.getAdminNotifications(page, limit);
        res.status(200).json({
            success: true,
            data: result.items,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
exports.getNotifications = getNotifications;
