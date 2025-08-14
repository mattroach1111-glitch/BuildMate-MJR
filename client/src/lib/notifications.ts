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
    if (typeof window === 'undefined') return false;
    
    const hasServiceWorker = 'serviceWorker' in navigator;
    const hasPushManager = 'PushManager' in window;
    const hasNotification = 'Notification' in window;
    
    console.log('🔍 Push support check:', {
      hasServiceWorker,
      hasPushManager, 
      hasNotification,
      userAgent: navigator.userAgent.substring(0, 100)
    });
    
    // For mobile browsers, be more permissive with notification support
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Mobile browsers might have different notification API implementations
      console.log('📱 Mobile browser detected, checking alternative notification support...');
      return hasServiceWorker && hasPushManager;
    }
    
    return hasServiceWorker && hasPushManager && hasNotification;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      console.log('🚫 Notifications not supported by this browser');
      return 'denied';
    }
    
    // Check if we're on mobile and handle differently
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (typeof Notification === 'undefined') {
      if (isMobile) {
        console.log('📱 Mobile browser may use service worker notifications');
        // On mobile, service worker can handle notifications even without global Notification
        return 'granted';
      }
      console.log('🚫 Notification API not available');
      return 'denied';
    }
    
    try {
      const permission = await Notification.requestPermission();
      console.log('📋 Notification permission result:', permission);
      return permission;
    } catch (error) {
      console.error('🚫 Notification permission request failed:', error);
      if (isMobile) {
        console.log('📱 Falling back to service worker notifications for mobile');
        return 'granted';
      }
      return 'denied';
    }
  }

  getPermission(): NotificationPermission {
    if (typeof Notification === 'undefined') {
      // On mobile, assume granted if we have service worker support
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile && 'serviceWorker' in navigator) {
        return 'granted';
      }
      return 'denied';
    }
    return Notification.permission;
  }

  showNotification(title: string, options?: NotificationOptions): void {
    // Check if we're on mobile first
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (typeof Notification === 'undefined') {
      if (isMobile && this.registration) {
        // Use service worker notification for mobile
        console.log('📱 Using service worker notification for mobile');
        this.registration.showNotification(title, {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          ...options
        });
        return;
      }
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
        console.log('Subscription object:', subscription.toJSON());
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
      const subscriptionData = subscription.toJSON();
      console.log('Sending subscription data to server:', subscriptionData);
      
      const response = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response error:', response.status, errorText);
        throw new Error(`Failed to send subscription to server: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Subscription sent successfully:', result);
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      throw error; // Re-throw to catch in registerForPush
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