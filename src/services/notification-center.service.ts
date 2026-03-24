import prisma from '../config/db';
import { NotificationService } from './notification.service';
import { QueueService } from './queue.service';

type AudienceType = 'ALL' | 'USERS' | 'EXAM';

type CreateNotificationInput = {
  adminId: string;
  title: string;
  body: string;
  type?: string;
  imageUrl?: string;
  deepLink?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  audienceType?: AudienceType;
  userIds?: string[];
  targetExamId?: string;
  sendPush?: boolean;
};

type UserSummary = {
  id: string;
  device_tokens: unknown;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildPushData = (input: {
  notificationId: string;
  type: string;
  deepLink?: string;
  entityType?: string;
  entityId?: string;
}) => {
  const data: Record<string, string> = {
    notificationId: input.notificationId,
    type: input.type,
  };

  if (input.deepLink) data.deepLink = input.deepLink;
  if (input.entityType) data.entityType = input.entityType;
  if (input.entityId) data.entityId = input.entityId;

  return data;
};

export class NotificationCenterService {
  private static async resolveAudienceUsers(
    audienceType: AudienceType,
    userIds?: string[],
    targetExamId?: string
  ): Promise<UserSummary[]> {
    if (audienceType === 'USERS') {
      const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
      if (uniqueUserIds.length === 0) {
        throw new Error('At least one target user is required for USERS audience.');
      }

      return prisma.user.findMany({
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

      return prisma.user.findMany({
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

    return prisma.user.findMany({
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
  }

  static async createAdminNotification(input: CreateNotificationInput) {
    const audienceType = (input.audienceType || 'ALL').toUpperCase() as AudienceType;
    const type = input.type || 'GENERAL';
    const sendPush = input.sendPush ?? true;

    const users = await this.resolveAudienceUsers(audienceType, input.userIds, input.targetExamId);
    if (users.length === 0) {
      throw new Error('No eligible student recipients were found for this notification.');
    }

    const notification = await prisma.$transaction(async (tx) => {
      const createdNotification = await tx.notification.create({
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

      await tx.studentNotification.createMany({
        data: users.map((user) => ({
          user_id: user.id,
          notification_id: createdNotification.id,
        })),
      });

      await tx.adminAuditLog.create({
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
    });

    const tokens = [...new Set(users.flatMap((user) => normalizeStringArray(user.device_tokens)))];

    if (sendPush && tokens.length > 0) {
      await QueueService.enqueueAlert({
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
  }

  static async getStudentInbox(options: {
    userId: string;
    page: number;
    limit: number;
    unreadOnly: boolean;
  }) {
    const { userId, page, limit, unreadOnly } = options;
    const skip = (page - 1) * limit;
    const whereClause = {
      user_id: userId,
      ...(unreadOnly ? { is_read: false } : {}),
    };

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.studentNotification.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          notification: true,
        },
      }),
      prisma.studentNotification.count({
        where: whereClause,
      }),
      prisma.studentNotification.count({
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
  }

  static async markAsRead(userId: string, studentNotificationId: string) {
    const existing = await prisma.studentNotification.findFirst({
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

    return prisma.studentNotification.update({
      where: { id: studentNotificationId },
      data: {
        is_read: true,
        read_at: new Date(),
      },
      include: {
        notification: true,
      },
    });
  }

  static async markAllAsRead(userId: string) {
    const result = await prisma.studentNotification.updateMany({
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
  }

  static async registerDeviceToken(userId: string, token: string, deviceFingerprint?: string) {
    const user = await prisma.user.findUnique({
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        device_tokens: tokens,
        device_fingerprints: fingerprints,
      },
      select: {
        device_tokens: true,
      },
    });

    await NotificationService.subscribeTokenToGlobalTopic(token);

    return {
      device_tokens: normalizeStringArray(updatedUser.device_tokens),
    };
  }

  static async unregisterDeviceToken(userId: string, token: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        device_tokens: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const updatedTokens = normalizeStringArray(user.device_tokens).filter(
      (existingToken) => existingToken !== token
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        device_tokens: updatedTokens,
      },
    });

    await NotificationService.unsubscribeTokenFromGlobalTopic(token);

    return {
      device_tokens: updatedTokens,
    };
  }

  static async getAdminNotifications(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await prisma.$transaction([
      prisma.notification.findMany({
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
      prisma.notification.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
