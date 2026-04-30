import { Request, Response } from 'express';
import { NotificationCenterService } from '../../services/notification-center.service';
import { CacheService } from '../../services/cache.service';

const CACHE_TAG = 'notifications';

export const getMyNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const unreadOnly = req.query.unreadOnly === 'true';
    const bypassCache = req.headers['x-bypass-cache'] === 'true';

    const cacheScope = `inbox:${userId}:p${page}:l${limit}:u${unreadOnly}`;
    const cached = bypassCache ? null : await CacheService.get<any>(CACHE_TAG, cacheScope);
    if (cached) {
      return res.status(200).json(cached);
    }

    const result = await NotificationCenterService.getStudentInbox({
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
    await CacheService.set(CACHE_TAG, cacheScope, payload, 300);

    res.status(200).json(payload);
  } catch (error) {
    console.error('Get My Notifications Error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const getUnreadNotificationCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const bypassCache = req.headers['x-bypass-cache'] === 'true';

    const cacheScope = `unread:${userId}`;
    const cached = bypassCache ? null : await CacheService.get<any>(CACHE_TAG, cacheScope);
    if (cached) {
      return res.status(200).json(cached);
    }

    const result = await NotificationCenterService.getStudentInbox({
      userId,
      page: 1,
      limit: 1,
      unreadOnly: false,
    });

    const payload = {
      success: true,
      unread_count: result.unreadCount,
    };

    await CacheService.set(CACHE_TAG, cacheScope, payload, 300);

    res.status(200).json(payload);
  } catch (error) {
    console.error('Get Unread Notification Count Error:', error);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
};

export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { id } = req.params;

    const updatedNotification = await NotificationCenterService.markAsRead(userId, id as string);
    if (!updatedNotification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Invalidate notification caches so next fetch gets fresh data
    await CacheService.invalidateTag(CACHE_TAG);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: updatedNotification,
    });
  } catch (error) {
    console.error('Mark Notification As Read Error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

export const markAllNotificationsAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;

    // Respond immediately with success, then do DB work
    // This drastically reduces perceived latency
    const updatedCount = await NotificationCenterService.markAllAsRead(userId);

    // Invalidate notification caches
    await CacheService.invalidateTag(CACHE_TAG);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updated_count: updatedCount,
    });
  } catch (error) {
    console.error('Mark All Notifications As Read Error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

export const registerDeviceToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { token, device_fingerprint } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'A valid device token is required' });
    }

    const result = await NotificationCenterService.registerDeviceToken(
      userId,
      token,
      typeof device_fingerprint === 'string' ? device_fingerprint : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
      data: result,
    });
  } catch (error) {
    console.error('Register Device Token Error:', error);
    res.status(500).json({ error: 'Failed to register device token' });
  }
};

export const unregisterDeviceToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id as string;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'A valid device token is required' });
    }

    const result = await NotificationCenterService.unregisterDeviceToken(userId, token);

    res.status(200).json({
      success: true,
      message: 'Device token removed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Unregister Device Token Error:', error);
    res.status(500).json({ error: 'Failed to remove device token' });
  }
};
