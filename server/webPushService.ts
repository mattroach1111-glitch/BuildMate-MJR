import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Use real VAPID keys (you can override these with environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BAbNDRMN70_lugGWkhmCG3sOy-5Q15kzWq39vyQgJf_8QEmHqGjdxo8bIuobpnCnbojxYCrmO9VbQ_ADBbLJJzk';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'AxAJd4cIPLNDyLKtUQqsJZubaW4cXS1mk3jISi6lqPY';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@buildflowpro.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class WebPushService {
  // Store a push subscription for a user
  async subscribeUser(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      await db.insert(pushSubscriptions).values({
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      }).onConflictDoUpdate({
        target: [pushSubscriptions.userId],
        set: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updatedAt: new Date(),
        }
      });
      console.log(`Push subscription stored for user ${userId}`);
    } catch (error) {
      console.error('Error storing push subscription:', error);
      throw error;
    }
  }

  // Get all subscriptions for users
  async getUserSubscriptions(userIds?: string[]): Promise<Array<{ userId: string; subscription: PushSubscription }>> {
    try {
      let query = db.select().from(pushSubscriptions);
      
      if (userIds && userIds.length > 0) {
        query = query.where(eq(pushSubscriptions.userId, userIds[0])); // Simple implementation for now
      }
      
      const subscriptions = await query;
      
      return subscriptions.map(sub => ({
        userId: sub.userId,
        subscription: {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }
      }));
    } catch (error) {
      console.error('Error fetching push subscriptions:', error);
      return [];
    }
  }

  // Send push notification to specific users
  async sendNotificationToUsers(userIds: string[], notification: { title: string; body: string; data?: any }): Promise<{ success: number; failed: number }> {
    const subscriptions = await this.getUserSubscriptions(userIds);
    
    if (subscriptions.length === 0) {
      console.log('No push subscriptions found for users:', userIds);
      return { success: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: notification.data || {},
      timestamp: Date.now()
    });

    let success = 0;
    let failed = 0;

    console.log(`Sending push notifications to ${subscriptions.length} devices`);

    for (const { userId, subscription } of subscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        console.log(`Push notification sent successfully to user ${userId}`);
        success++;
      } catch (error) {
        console.error(`Failed to send push notification to user ${userId}:`, error);
        failed++;
        
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          await this.removeUserSubscription(userId);
        }
      }
    }

    return { success, failed };
  }

  // Send notification to all subscribed users
  async sendNotificationToAllUsers(notification: { title: string; body: string; data?: any }): Promise<{ success: number; failed: number }> {
    const subscriptions = await this.getUserSubscriptions();
    
    if (subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return { success: 0, failed: 0 };
    }

    const userIds = subscriptions.map(sub => sub.userId);
    return this.sendNotificationToUsers(userIds, notification);
  }

  // Remove a user's push subscription
  async removeUserSubscription(userId: string): Promise<void> {
    try {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
      console.log(`Push subscription removed for user ${userId}`);
    } catch (error) {
      console.error('Error removing push subscription:', error);
    }
  }

  // Get VAPID public key for client-side subscription
  getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }
}

export const webPushService = new WebPushService();