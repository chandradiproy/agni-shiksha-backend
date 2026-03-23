// src/services/notification.service.ts
import * as admin from 'firebase-admin';

/**
 * Notification Service for high-throughput real-time updates.
 * Handles both visible alerts and silent background synchronization.
 */
export class NotificationService {
  private static GLOBAL_TOPIC = "global_updates";

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
  static async sendAlert(title: string, body: string, topic = this.GLOBAL_TOPIC): Promise<void> {
    const message: admin.messaging.Message = {
      notification: { title, body },
      topic: topic,
    };

    try {
      await admin.messaging().send(message);
    } catch (error) {
      console.error("FCM Alert Error:", error);
    }
  }
}