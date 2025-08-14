// Simple Push Notifications Service
interface NotificationService {
  isSupported(): boolean;
  requestPermission(): Promise<NotificationPermission>;
  getPermission(): NotificationPermission;
  showNotification(title: string, options?: NotificationOptions): void;
  registerForPush(): Promise<boolean>;
  sendTestNotification(): Promise<boolean>;
}

class SimpleNotificationService implements NotificationService {
  private static instance: SimpleNotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  static getInstance(): SimpleNotificationService {
    if (!SimpleNotificationService.instance) {
      SimpleNotificationService.instance = new SimpleNotificationService();
    }
    return SimpleNotificationService.instance;
  }

  constructor() {
    this.initServiceWorker();
  }

  private async initServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  getPermission(): NotificationPermission {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    return Notification.permission;
  }

  showNotification(title: string, options?: NotificationOptions): void {
    if (typeof Notification === 'undefined') {
      console.warn('Notifications not supported in this environment');
      return;
    }
    if (this.getPermission() === 'granted') {
      new Notification(title, {
        icon: '/icon-192x192.png',
        ...options
      });
    }
  }

  async registerForPush(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    try {
      if (!this.registration) {
        await this.initServiceWorker();
      }

      if (this.registration) {
        const subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: await this.getVapidKey()
        });

        await this.sendSubscriptionToServer(subscription);
        return true;
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
    }

    return false;
  }

  private async getVapidKey(): Promise<string> {
    try {
      const response = await fetch('/api/vapid-public-key');
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error('Failed to get VAPID key:', error);
      return '';
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  }

  async sendTestNotification(): Promise<boolean> {
    try {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      const response = await fetch('/api/test-push-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Test Notification',
          message: 'This is a test push notification from BuildFlow Pro',
          userIds: ['test-user']
        })
      });

      if (response.ok) {
        this.showNotification('Test Notification', {
          body: 'This is a test push notification from BuildFlow Pro',
          requireInteraction: true
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }
}

export const notificationService = SimpleNotificationService.getInstance();