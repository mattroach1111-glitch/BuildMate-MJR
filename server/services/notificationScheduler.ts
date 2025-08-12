import { storage } from '../storage';
import { insertNotificationSchema } from '@shared/schema';

export class NotificationScheduler {
  private static instance: NotificationScheduler;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {}

  static getInstance(): NotificationScheduler {
    if (!NotificationScheduler.instance) {
      NotificationScheduler.instance = new NotificationScheduler();
    }
    return NotificationScheduler.instance;
  }

  /**
   * Initialize notification scheduler - sets up recurring Monday reminders
   */
  async initialize() {
    console.log('🔔 Initializing notification scheduler...');
    
    // Start checking for Monday reminders every hour
    const checkInterval = setInterval(() => {
      this.checkAndCreateMondayReminders();
    }, 1000 * 60 * 60); // Check every hour

    this.intervals.set('monday-reminders', checkInterval);
    
    // Also check immediately on startup
    await this.checkAndCreateMondayReminders();
    
    console.log('✅ Notification scheduler initialized successfully');
  }

  /**
   * Check if it's Monday and create reminder notifications for Mark and Will
   */
  private async checkAndCreateMondayReminders() {
    try {
      const now = new Date();
      const isMonday = now.getDay() === 1; // Monday is day 1
      const currentHour = now.getHours();

      // Only create notifications on Monday morning (8 AM - 10 AM)
      if (!isMonday || currentHour < 8 || currentHour >= 10) {
        return;
      }

      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Get all users to find Mark and Will
      const users = await storage.getAllUsers();
      const targetUsers = users.filter(user => 
        user.email && (
          user.email.toLowerCase().includes('mark') || 
          user.email.toLowerCase().includes('will')
        )
      );

      for (const user of targetUsers) {
        // Check if notification already exists for today
        const existingNotifications = await storage.getNotificationsForUser(user.id);
        const hasNotificationToday = existingNotifications.some(notification => 
          notification.scheduledFor === today && 
          notification.type === 'reminder' &&
          !notification.isDismissed
        );

        if (!hasNotificationToday) {
          const notificationData = insertNotificationSchema.parse({
            userId: user.id,
            title: 'Weekly Job Update Reminder',
            message: 'Time to submit your weekly job updates! Please review and submit progress reports for all active projects.',
            type: 'reminder',
            scheduledFor: today,
            triggerDay: 'monday',
            isRead: false,
            isDismissed: false
          });

          await storage.createNotification(notificationData);
          console.log(`📅 Created Monday reminder notification for ${user.email}`);
        }
      }
    } catch (error) {
      console.error('❌ Error creating Monday reminders:', error);
    }
  }

  /**
   * Create initial test notifications for Mark and Will
   */
  async createInitialNotifications() {
    try {
      const users = await storage.getAllUsers();
      const targetUsers = users.filter(user => 
        user.email && (
          user.email.toLowerCase().includes('mark') || 
          user.email.toLowerCase().includes('will')
        )
      );

      const today = new Date().toISOString().split('T')[0];

      for (const user of targetUsers) {
        const notificationData = insertNotificationSchema.parse({
          userId: user.id,
          title: 'Monday Job Update Reminder',
          message: 'This is your weekly reminder to submit job updates. Please review all active projects and provide status updates.',
          type: 'reminder',
          scheduledFor: today,
          triggerDay: 'monday',
          isRead: false,
          isDismissed: false
        });

        await storage.createNotification(notificationData);
        console.log(`✅ Created initial notification for ${user.email}`);
      }
    } catch (error) {
      console.error('❌ Error creating initial notifications:', error);
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      await storage.deleteOldNotifications(thirtyDaysAgo.toISOString());
      console.log('🧹 Cleaned up old notifications');
    } catch (error) {
      console.error('❌ Error cleaning up old notifications:', error);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`⏹️ Stopped ${name} scheduler`);
    });
    this.intervals.clear();
  }
}