import webpush from 'web-push';
import { storage } from '../storage';
import { db } from '../db';
import { pushSubscriptions, users } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

const VAPID_PUBLIC_KEY_SETTING = 'vapid_public_key';
const VAPID_PRIVATE_KEY_SETTING = 'vapid_private_key';
const VAPID_SUBJECT_SETTING = 'vapid_subject';

let vapidInitialised = false;
let cachedPublicKey: string | null = null;

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  requireInteraction?: boolean;
}

/**
 * Generate VAPID keys on first run and persist them in system_settings.
 * Subsequent calls just load and configure web-push.
 */
export async function initialisePushService(): Promise<void> {
  if (vapidInitialised) return;

  let publicKeySetting = await storage.getSystemSetting(VAPID_PUBLIC_KEY_SETTING);
  let privateKeySetting = await storage.getSystemSetting(VAPID_PRIVATE_KEY_SETTING);

  if (!publicKeySetting?.settingValue || !privateKeySetting?.settingValue) {
    console.log('🔔 Generating new VAPID key pair for web push...');
    const keys = webpush.generateVAPIDKeys();
    await storage.setSystemSetting(VAPID_PUBLIC_KEY_SETTING, keys.publicKey);
    await storage.setSystemSetting(VAPID_PRIVATE_KEY_SETTING, keys.privateKey);
    publicKeySetting = await storage.getSystemSetting(VAPID_PUBLIC_KEY_SETTING);
    privateKeySetting = await storage.getSystemSetting(VAPID_PRIVATE_KEY_SETTING);
    console.log('✅ VAPID keys generated and stored in system settings');
  }

  let subjectSetting = await storage.getSystemSetting(VAPID_SUBJECT_SETTING);
  if (!subjectSetting?.settingValue) {
    await storage.setSystemSetting(VAPID_SUBJECT_SETTING, 'mailto:admin@buildflowpro.app');
    subjectSetting = await storage.getSystemSetting(VAPID_SUBJECT_SETTING);
  }

  webpush.setVapidDetails(
    subjectSetting!.settingValue!,
    publicKeySetting!.settingValue!,
    privateKeySetting!.settingValue!,
  );

  cachedPublicKey = publicKeySetting!.settingValue!;
  vapidInitialised = true;
  console.log('✅ Push notification service initialised');
}

export async function getVapidPublicKey(): Promise<string | null> {
  if (!vapidInitialised) await initialisePushService();
  return cachedPublicKey;
}

/**
 * Send a push notification to a single subscription. Removes the subscription
 * from the database if the push service reports it's gone (404/410).
 */
async function sendToSubscription(
  sub: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h
    );
    return true;
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log(`🔔 Removing dead push subscription ${sub.id}`);
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    } else {
      console.error('🔔 Push send error:', err.statusCode, err.body || err.message);
    }
    return false;
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!vapidInitialised) await initialisePushService();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++; else failed++;
  }
  return { sent, failed };
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!vapidInitialised) await initialisePushService();
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const ok = await sendToSubscription(sub, payload);
    if (ok) sent++; else failed++;
  }
  return { sent, failed };
}

export async function sendPushToAllStaff(payload: PushPayload): Promise<{ sent: number; failed: number; users: number }> {
  if (!vapidInitialised) await initialisePushService();
  const allUsers = await db.select({ id: users.id }).from(users);
  const userIds = allUsers.map(u => u.id);
  const result = await sendPushToUsers(userIds, payload);
  return { ...result, users: userIds.length };
}
