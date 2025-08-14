// Web Push Notifications Service
export class PushNotificationService {
  private static instance: PushNotificationService;
  private permission: NotificationPermission = 'default';

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  constructor() {
    this.permission = Notification.permission;
  }

  // Check if browser supports notifications
  isSupported(): boolean {
    return 'Notification' in window;
  }

  // Get current permission status
  getPermission(): NotificationPermission {
    return this.permission;
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  // Show a notification
  showNotification(title: string, options?: NotificationOptions): Notification | null {
    if (!this.isSupported() || this.permission !== 'granted') {
      console.warn('Cannot show notification: permission not granted or not supported');
      return null;
    }

    try {
      return new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  // Register for push notifications (simplified version)
  async registerForPush(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const permission = await this.requestPermission();
    return permission === 'granted';
  }

  // Show timesheet reminder notification
  showTimesheetReminder(): void {
    this.showNotification('Timesheet Reminder', {
      body: 'Don\'t forget to submit your timesheet for this week!',
      icon: '/favicon.ico',
      tag: 'timesheet-reminder',
      requireInteraction: true
    });
  }

  // Show instant notification from admin
  showInstantNotification(message: string): void {
    this.showNotification('Important Message', {
      body: message,
      icon: '/favicon.ico',
      tag: 'instant-notification',
      requireInteraction: true
    });
  }
}

export const pushNotificationService = PushNotificationService.getInstance();