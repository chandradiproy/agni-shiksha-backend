// src/services/notification.service.ts
import * as admin from 'firebase-admin';

type AlertPayload = {
  title: string;
  body: string;
  topic?: string;
  tokens?: string[];
  data?: Record<string, string>;
  imageUrl?: string;
};

/**
 * Notification Service for high-throughput real-time updates.
 * Handles both visible alerts and silent background synchronization.
 */
export class NotificationService {
  private static GLOBAL_TOPIC = 'global_updates';

  private static chunkTokens(tokens: string[], size = 500): string[][] {
    const chunks: string[][] = [];
    for (let index = 0; index < tokens.length; index += size) {
      chunks.push(tokens.slice(index, index + size));
    }
    return chunks;
  }

  static getGlobalTopic(): string {
    return this.GLOBAL_TOPIC;
  }

  /**
   * Triggers a Silent Push to all devices subscribed to the global topic.
   * This wakes up the app to perform a background cache refresh.
   */
  static async triggerSync(tag: string): Promise<void> {
    const message: admin.messaging.Message = {
      data: {
        type: "SYNC_REQUIRED",
        tag: tag,
        timestamp: Date.now().toString(),
      },
      topic: this.GLOBAL_TOPIC,
      // Priority settings to ensure delivery while optimizing battery
      android: {
        priority: "normal",
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
      await admin.messaging().send(message);
    } catch (error) {
      console.error(`FCM Sync Error for tag ${tag}:`, error);
    }
  }

  /**
   * Sends a standard visible notification to a topic or specific user.
   */
  static async sendAlert(payload: AlertPayload): Promise<void> {
    const {
      title,
      body,
      topic = this.GLOBAL_TOPIC,
      tokens = [],
      data,
      imageUrl,
    } = payload;

    const uniqueTokens = [...new Set(tokens.filter(Boolean))];

    try {
      if (uniqueTokens.length > 0) {
        for (const chunk of this.chunkTokens(uniqueTokens)) {
          const response = await admin.messaging().sendEachForMulticast({
            tokens: chunk,
            notification: { title, body, imageUrl },
            data,
            android: {
              priority: 'high',
              notification: imageUrl ? { imageUrl } : undefined,
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

      const message: admin.messaging.Message = {
        notification: { title, body, imageUrl },
        data,
        topic,
      };

      await admin.messaging().send(message);
    } catch (error) {
      console.error('FCM Alert Error:', error);
    }
  }

  static async subscribeTokenToGlobalTopic(token: string): Promise<void> {
    try {
      await admin.messaging().subscribeToTopic([token], this.GLOBAL_TOPIC);
    } catch (error) {
      console.error('FCM Subscribe Error:', error);
    }
  }

  static async unsubscribeTokenFromGlobalTopic(token: string): Promise<void> {
    try {
      await admin.messaging().unsubscribeFromTopic([token], this.GLOBAL_TOPIC);
    } catch (error) {
      console.error('FCM Unsubscribe Error:', error);
    }
  }
}
