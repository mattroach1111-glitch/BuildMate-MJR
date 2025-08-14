// Web Push Notifications Service
class PushNotificationService {
  private static instance: PushNotificationService;
  private permission: NotificationPermission = 'default';
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  constructor() {
    this.permission = Notification.permission;
    this.initializeServiceWorker();
  }

  // Initialize service worker
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully');
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Check if browser supports notifications
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
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

  // Get VAPID public key from server
  private async getVapidPublicKey(): Promise<string> {
    try {
      const response = await fetch('/api/push/vapid-key');
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error('Error fetching VAPID key:', error);
      throw error;
    }
  }

  // Convert URL-safe base64 to Uint8Array
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Subscribe to push notifications
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.initializeServiceWorker();
    }

    if (!this.registration) {
      console.error('Service worker not available');
      return null;
    }

    try {
      const vapidPublicKey = await this.getVapidPublicKey();
      const applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey);

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription);
      
      console.log('Push subscription successful:', this.subscription);
      return this.subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  // Send subscription to server
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')!))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')!)))
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('Subscription sent to server successfully');
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      throw error;
    }
  }

  // Register for push notifications (full implementation)
  async registerForPush(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const subscription = await this.subscribeToPush();
    return subscription !== null;
  }

  // Test notification (for debugging)
  async sendTestNotification(): Promise<boolean> {
    try {
      // First ensure we have permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return false;
      }

      // Call the API
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
        const result = await response.json();
        console.log('Test notification API response:', result);
        
        // Show immediate browser notification
        await this.showNotificationWithServiceWorker('Test Notification', {
          body: 'This is a test push notification from BuildFlow Pro',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'test-notification',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        });
        
        return true;
      }
      
      console.error('Test notification failed:', await response.text());
      return false;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  // Show notification using service worker
  private async showNotificationWithServiceWorker(title: string, options?: NotificationOptions): Promise<void> {
    if (!this.registration) {
      await this.initializeServiceWorker();
    }

    if (this.registration && this.permission === 'granted') {
      try {
        await this.registration.showNotification(title, {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          ...options
        });
        console.log('Service worker notification shown:', title);
      } catch (error) {
        console.error('Error showing service worker notification:', error);
        // Fallback to regular notification
        this.showNotification(title, options);
      }
    } else {
      console.warn('Service worker not available, using fallback notification');
      this.showNotification(title, options);
    }
  }

  // Show timesheet reminder notification
  async showTimesheetReminder(): Promise<void> {
    await this.showNotificationWithServiceWorker('Timesheet Reminder', {
      body: 'Don\'t forget to submit your timesheet for this week!',
      icon: '/icon-192x192.png',
      tag: 'timesheet-reminder',
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
  }

  // Show instant notification from admin
  async showInstantNotification(message: string): Promise<void> {
    await this.showNotificationWithServiceWorker('Important Message', {
      body: message,
      icon: '/icon-192x192.png',
      tag: 'instant-notification',
      requireInteraction: true,
      vibrate: [200, 100, 200]
    });
  }
}

// Create and export the singleton instance
export const pushNotificationService = PushNotificationService.getInstance();