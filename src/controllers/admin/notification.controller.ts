import { Request, Response } from 'express';
import { NotificationCenterService } from '../../services/notification-center.service';

export const createNotification = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).admin.id as string;
    const {
      title,
      body,
      type,
      image_url,
      deep_link,
      entity_type,
      entity_id,
      metadata,
      audience_type,
      user_ids,
      target_exam_id,
      send_push,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const result = await NotificationCenterService.createAdminNotification({
      adminId,
      title,
      body,
      type,
      imageUrl: image_url,
      deepLink: deep_link,
      entityType: entity_type,
      entityId: entity_id,
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      audienceType: typeof audience_type === 'string' ? (audience_type.toUpperCase() as 'ALL' | 'USERS' | 'EXAM') : undefined,
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
  } catch (error: any) {
    console.error('Create Notification Error:', error);
    res.status(400).json({ error: error.message || 'Failed to create notification' });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await NotificationCenterService.getAdminNotifications(page, limit);

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
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};
