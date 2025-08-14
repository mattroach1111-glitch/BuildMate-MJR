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
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    
    // For desktop browsers, ensure user gesture is present
    try {
      const permission = await Notification.requestPermission();
      console.log('Notification permission result:', permission);
      return permission;
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return 'denied';
    }
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
    console.log('Starting push registration...');
    
    if (!this.isSupported()) {
      console.warn('Push notifications not supported');
      return false;
    }

    const permission = await this.requestPermission();
    console.log('Permission granted:', permission);
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted:', permission);
      return false;
    }

    try {
      if (!this.registration) {
        console.log('Initializing service worker...');
        await this.initServiceWorker();
      }

      if (this.registration) {
        console.log('Getting VAPID key...');
        const vapidKey = await this.getVapidKey();
        if (!vapidKey) {
          console.error('Failed to get VAPID key');
          return false;
        }

        console.log('Subscribing to push manager...');
        const subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey
        });

        console.log('Sending subscription to server...');
        await this.sendSubscriptionToServer(subscription);
        console.log('Push registration successful!');
        return true;
      }
    } catch (error) {
      console.error('Push subscription failed:', error);
      // Show more detailed error for desktop debugging
      if (error.name === 'NotSupportedError') {
        console.error('Push notifications not supported by browser');
      } else if (error.name === 'NotAllowedError') {
        console.error('Push notifications blocked by user or browser');
      }
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