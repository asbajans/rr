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

  try {
    const resp = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        priority: 'high',
      }),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status, storeId }, 'FCM push returned non-200');
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
