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
exports.unregisterDeviceToken = exports.registerDeviceToken = exports.markAllNotificationsAsRead = exports.markNotificationAsRead = exports.getUnreadNotificationCount = exports.getMyNotifications = void 0;
const notification_center_service_1 = require("../../services/notification-center.service");
const cache_service_1 = require("../../services/cache.service");
const CACHE_TAG = 'notifications';
const getMyNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const unreadOnly = req.query.unreadOnly === 'true';
        const bypassCache = req.headers['x-bypass-cache'] === 'true';
        const cacheScope = `inbox:${userId}:p${page}:l${limit}:u${unreadOnly}`;
        const cached = bypassCache ? null : yield cache_service_1.CacheService.get(CACHE_TAG, cacheScope);
        if (cached) {
            console.log(`[NotifCache] HIT for ${cacheScope}`);
            return res.status(200).json(cached);
        }
        console.log(`[NotifCache] MISS for ${cacheScope}`);
        const result = yield notification_center_service_1.NotificationCenterService.getStudentInbox({
            userId,
            page,
            limit,
            unreadOnly,
        });
        const payload = {
            success: true,
            data: result.items,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
                totalPages: result.totalPages,
            },
            unread_count: result.unreadCount,
        };
        // Cache for 5 minutes — invalidated on read/mark actions & new notifications
        yield cache_service_1.CacheService.set(CACHE_TAG, cacheScope, payload, 300);
        res.status(200).json(payload);
    }
    catch (error) {
        console.error('Get My Notifications Error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
exports.getMyNotifications = getMyNotifications;
const getUnreadNotificationCount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const bypassCache = req.headers['x-bypass-cache'] === 'true';
        const cacheScope = `unread:${userId}`;
        const cached = bypassCache ? null : yield cache_service_1.CacheService.get(CACHE_TAG, cacheScope);
        if (cached) {
            console.log(`[NotifCache] HIT for ${cacheScope}`);
            return res.status(200).json(cached);
        }
        console.log(`[NotifCache] MISS for ${cacheScope}`);
        const result = yield notification_center_service_1.NotificationCenterService.getStudentInbox({
            userId,
            page: 1,
            limit: 1,
            unreadOnly: false,
        });
        const payload = {
            success: true,
            unread_count: result.unreadCount,
        };
        yield cache_service_1.CacheService.set(CACHE_TAG, cacheScope, payload, 300);
        res.status(200).json(payload);
    }
    catch (error) {
        console.error('Get Unread Notification Count Error:', error);
        res.status(500).json({ error: 'Failed to fetch unread notification count' });
    }
});
exports.getUnreadNotificationCount = getUnreadNotificationCount;
const markNotificationAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updatedNotification = yield notification_center_service_1.NotificationCenterService.markAsRead(userId, id);
        if (!updatedNotification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        // Invalidate notification caches so next fetch gets fresh data
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: updatedNotification,
        });
    }
    catch (error) {
        console.error('Mark Notification As Read Error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
exports.markNotificationAsRead = markNotificationAsRead;
const markAllNotificationsAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        // Respond immediately with success, then do DB work
        // This drastically reduces perceived latency
        const updatedCount = yield notification_center_service_1.NotificationCenterService.markAllAsRead(userId);
        // Invalidate notification caches
        yield cache_service_1.CacheService.invalidateTag(CACHE_TAG);
        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            updated_count: updatedCount,
        });
    }
    catch (error) {
        console.error('Mark All Notifications As Read Error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});
exports.markAllNotificationsAsRead = markAllNotificationsAsRead;
const registerDeviceToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { token, device_fingerprint } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'A valid device token is required' });
        }
        const result = yield notification_center_service_1.NotificationCenterService.registerDeviceToken(userId, token, typeof device_fingerprint === 'string' ? device_fingerprint : undefined);
        res.status(200).json({
            success: true,
            message: 'Device token registered successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Register Device Token Error:', error);
        res.status(500).json({ error: 'Failed to register device token' });
    }
});
exports.registerDeviceToken = registerDeviceToken;
const unregisterDeviceToken = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'A valid device token is required' });
        }
        const result = yield notification_center_service_1.NotificationCenterService.unregisterDeviceToken(userId, token);
        res.status(200).json({
            success: true,
            message: 'Device token removed successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Unregister Device Token Error:', error);
        res.status(500).json({ error: 'Failed to remove device token' });
    }
});
exports.unregisterDeviceToken = unregisterDeviceToken;
