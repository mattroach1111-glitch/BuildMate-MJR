import { storage } from '../storage';
import { insertNotificationSchema } from '@shared/schema';
import { db } from '../db';
import { jobs, employees, users, timesheetEntries, laborEntries, materials, subTrades, otherCosts, tipFees, jobFiles } from '@shared/schema';

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
   * Initialize notification scheduler - sets up recurring Monday reminders and weekly backup
   */
  async initialize() {
    console.log('🔔 Initializing notification scheduler...');
    
    // Start checking for Monday reminders every hour
    const checkInterval = setInterval(() => {
      this.checkAndCreateMondayReminders();
    }, 1000 * 60 * 60); // Check every hour
    this.intervals.set('monday-reminders', checkInterval);
    
    // Check for weekly backup every hour
    const backupInterval = setInterval(() => {
      this.checkAndRunWeeklyBackup();
    }, 1000 * 60 * 60); // Check every hour
    this.intervals.set('weekly-backup', backupInterval);

    // Also check immediately on startup
    await this.checkAndCreateMondayReminders();
    await this.checkAndRunWeeklyBackup();
    
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
   * Check if a weekly backup is due (every Sunday) and run it automatically
   */
  private async checkAndRunWeeklyBackup() {
    try {
      const now = new Date();
      const isSunday = now.getDay() === 0;
      const currentHour = now.getHours();

      // Run once on Sunday between 2 AM and 3 AM
      if (!isSunday || currentHour !== 2) return;

      // Check if we already ran this backup today
      const todayKey = `weekly_backup_last_run`;
      const lastRunSetting = await storage.getSystemSetting(todayKey);
      const today = now.toISOString().split('T')[0];
      if (lastRunSetting?.settingValue === today) {
        return; // Already backed up today
      }

      console.log('📦 Starting automatic weekly MJR backup to Google Drive...');

      const systemTokens = await storage.getSystemGoogleDriveTokens();
      if (!systemTokens) {
        console.log('⚠️ Weekly backup skipped: Google Drive not connected');
        return;
      }

      // Gather all data
      const jobsData = await db.select().from(jobs);
      const employeesData = await db.select().from(employees);
      const usersData = await db.select().from(users);
      const timesheetEntriesData = await db.select().from(timesheetEntries);
      const laborEntriesData = await db.select().from(laborEntries);
      const materialsData = await db.select().from(materials);
      const subTradesData = await db.select().from(subTrades);
      const otherCostsData = await db.select().from(otherCosts);
      const tipFeesData = await db.select().from(tipFees);
      const jobFilesData = await db.select().from(jobFiles);

      const exportData = {
        exportDate: now.toISOString(),
        exportType: 'MJR Automatic Weekly Backup',
        version: '1.0',
        summary: {
          jobs: jobsData.length,
          employees: employeesData.length,
          timesheetEntries: timesheetEntriesData.length,
          laborEntries: laborEntriesData.length,
          materials: materialsData.length,
        },
        data: {
          jobs: jobsData,
          employees: employeesData,
          users: usersData.map((u: any) => ({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role })),
          timesheetEntries: timesheetEntriesData,
          laborEntries: laborEntriesData,
          materials: materialsData,
          subTrades: subTradesData,
          otherCosts: otherCostsData,
          tipFees: tipFeesData,
          jobFiles: jobFilesData,
        }
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const fileName = `MJR-BuildFlow-Backup-${today}.json`;
      const fileBuffer = Buffer.from(jsonContent, 'utf-8');

      const { GoogleDriveService } = await import('../googleDriveService');
      const googleDriveService = new GoogleDriveService();
      const tokens = JSON.parse(systemTokens);
      const tokenRefreshCallback = async (newTokens: any) => {
        await storage.setSystemGoogleDriveTokens(JSON.stringify(newTokens));
      };
      googleDriveService.setUserTokens(tokens, 'system', tokenRefreshCallback);

      const mainFolderId = await googleDriveService.findOrCreateFolder('BuildFlow Pro');
      const backupsFolderId = await googleDriveService.findOrCreateFolder('MJR Backups', mainFolderId);
      await googleDriveService.uploadFile(fileName, fileBuffer, 'application/json', backupsFolderId || undefined);

      // Record that we ran the backup today
      await storage.setSystemSetting(todayKey, today);

      console.log(`✅ Weekly MJR backup completed: ${fileName}`);
    } catch (error) {
      console.error('❌ Error running weekly backup:', error);
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