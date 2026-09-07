import { StoreNotification } from '../../models/StoreNotification.model.js';
import { User } from '../../models/User.model.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/env.js';

export interface NotifyInput {
  storeId: number;
  userId?: number | null;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export async function createStoreNotification(input: NotifyInput): Promise<StoreNotification | null> {
  try {
    return await StoreNotification.create({
      storeId: input.storeId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data || {},
    });
  } catch (err) {
    logger.warn({ err }, 'createStoreNotification failed (non-fatal)');
    return null;
  }
}

export async function getFcmTokensForStore(storeId: number): Promise<string[]> {
  try {
    const users = await User.findAll({
      where: { storeId, isActive: true },
      attributes: ['fcmToken'],
    });
    return users.map(u => u.fcmToken).filter((t): t is string => Boolean(t));
  } catch (err) {
    logger.warn({ err, storeId }, 'getFcmTokensForStore failed');
    return [];
  }
}

/**
 * Sends a FCM multicast (legacy HTTP API) to every active user of a store.
 * Includes coin sound for new orders (Android channel `orders` + iOS sound).
 * No-op when FCM_SERVER_KEY is not configured. Never throws.
 */
export async function sendPushToStore(storeId: number, title: string, body: string, data: Record<string, any> = {}): Promise<void> {
  const serverKey = config.fcm.serverKey;
  if (!serverKey) {
    logger.debug({ storeId }, 'FCM_SERVER_KEY not set — skipping push notification');
    return;
  }
  const tokens = await getFcmTokensForStore(storeId);
  if (tokens.length === 0) return;

  const isOrder = String(data?.type || '').includes('order') || title.toLowerCase().includes('sipariş') || title.toLowerCase().includes('siparis');
  const sound = isOrder ? 'coin' : 'default';

  try {
    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body, sound, android_channel_id: isOrder ? 'orders' : 'default' },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK', sound },
        priority: 'high',
        android: {
          priority: 'high',
          notification: {
            sound,
            channel_id: isOrder ? 'orders' : 'default',
            visibility: 'public',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: isOrder ? 'coin.wav' : 'default',
              badge: 1,
            },
          },
        },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      logger.warn({ status: resp.status, storeId, body: txt.slice(0, 500) }, 'FCM push returned non-200');
    } else {
      logger.info({ storeId, title, sound }, 'FCM push sent');
    }
  } catch (err) {
    logger.warn({ err, storeId }, 'FCM push failed (non-fatal)');
  }
}

/**
 * In-app notification + optional push, fire-and-forget.
 */
export async function notifyStore(input: NotifyInput, opts: { push?: boolean } = { push: true }): Promise<void> {
  await createStoreNotification(input);
  if (opts.push) {
    await sendPushToStore(input.storeId, input.title, input.body, input.data || {});
  }
}
