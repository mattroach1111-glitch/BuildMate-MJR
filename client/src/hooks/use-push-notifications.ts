import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  // Detect support and current permission
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      setPermission('unsupported');
      setIsSubscribed(false);
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  // Get the VAPID public key from server
  const { data: vapidData } = useQuery<{ publicKey: string | null }>({
    queryKey: ['/api/push/vapid-public-key'],
    staleTime: Infinity,
    enabled: permission !== 'unsupported',
  });

  // Check current subscription status with the SW. If the browser has a
  // subscription, also re-upsert it on the server so the two stay in sync
  // (handles cases where the server lost the record but the browser still
  // holds an active SW subscription).
  useEffect(() => {
    if (permission === 'unsupported') return;
    let cancelled = false;
    (async () => {
      try {
        if (!('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        if (cancelled) return;
        if (sub) {
          // Re-sync the subscription with the server (idempotent upsert)
          try {
            const json = sub.toJSON();
            await apiRequest('POST', '/api/push/subscribe', {
              endpoint: json.endpoint,
              p256dh: json.keys?.p256dh,
              auth: json.keys?.auth,
              userAgent: navigator.userAgent,
            });
          } catch (err) {
            console.warn('Push subscription resync failed:', err);
          }
          if (!cancelled) setIsSubscribed(true);
        } else {
          if (!cancelled) setIsSubscribed(false);
        }
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [permission]);

  const saveSubscription = useMutation({
    mutationFn: async (sub: PushSubscription) => {
      const json = sub.toJSON();
      return apiRequest('POST', '/api/push/subscribe', {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        userAgent: navigator.userAgent,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/status'] });
    },
  });

  const removeSubscription = useMutation({
    mutationFn: async (endpoint: string) => {
      return apiRequest('POST', '/api/push/unsubscribe', { endpoint });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/push/status'] });
    },
  });

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (permission === 'unsupported') return false;
    if (!vapidData?.publicKey) {
      console.warn('VAPID public key not available yet');
      return false;
    }
    setIsWorking(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== 'granted') {
        setIsWorking(false);
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
        });
      }
      await saveSubscription.mutateAsync(sub);
      setIsSubscribed(true);
      setIsWorking(false);
      return true;
    } catch (err) {
      console.error('Push subscribe failed:', err);
      setIsWorking(false);
      return false;
    }
  }, [permission, vapidData?.publicKey, saveSubscription]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (permission === 'unsupported') return false;
    setIsWorking(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await removeSubscription.mutateAsync(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      setIsWorking(false);
      return true;
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      setIsWorking(false);
      return false;
    }
  }, [permission, removeSubscription]);

  // iOS PWA detection - notifications on iOS only work when installed to home screen
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
  const iosNeedsInstall = isIOS && !isStandalone;

  return {
    permission,
    isSubscribed,
    isSupported: permission !== 'unsupported' && !iosNeedsInstall,
    isWorking,
    subscribe,
    unsubscribe,
    iosNeedsInstall,
    isIOS,
  };
}
