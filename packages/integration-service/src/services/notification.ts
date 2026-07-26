import axios from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

export async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const serverKey = config.fcmServerKey;
  if (!serverKey) {
    logger.warn('FCM_SERVER_KEY not set, skipping push notification');
    return;
  }
  try {
    await axios.post(
      FCM_API_URL,
      {
        to: token,
        notification: { title, body, sound: 'default' },
        data,
      },
      {
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
  } catch (err: any) {
    logger.error({ err: err.message }, 'FCM send failed');
  }
}

export async function sendMulticastFcm(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const serverKey = config.fcmServerKey;
  if (!serverKey || tokens.length === 0) return;
  try {
    await axios.post(
      FCM_API_URL,
      {
        registration_ids: tokens,
        notification: { title, body, sound: 'default' },
        data,
      },
      {
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
  } catch (err: any) {
    logger.error({ err: err.message }, 'FCM multicast failed');
  }
}

export async function notifyNewOrder(
  fcmTokens: string[],
  marketplace: string,
  orderId: string,
  itemCount: number,
  totalAmount: number,
  currency: string,
): Promise<void> {
  const title = 'Yeni Sipariş';
  const body = `${marketplace.toUpperCase()} — ${itemCount} ürün, ${totalAmount.toFixed(2)} ${currency}`;
  await sendMulticastFcm(fcmTokens, title, body, {
    type: 'new_order',
    marketplace,
    orderId,
  });
}

export async function notifyOrderStatusChanged(
  fcmTokens: string[],
  marketplace: string,
  orderId: string,
  newStatus: string,
): Promise<void> {
  const statusLabels: Record<string, string> = {
    pending: 'Beklemede',
    confirmed: 'Onaylandı',
    processing: 'Hazırlanıyor',
    shipped: 'Kargoya Verildi',
    delivered: 'Teslim Edildi',
    cancelled: 'İptal Edildi',
    returned: 'İade Edildi',
  };
  const label = statusLabels[newStatus] || newStatus;
  const title = 'Sipariş Durumu Güncellendi';
  const body = `${marketplace.toUpperCase()} — ${label}`;
  await sendMulticastFcm(fcmTokens, title, body, {
    type: 'order_status_changed',
    marketplace,
    orderId,
    status: newStatus,
  });
}

export async function notifyTrackingUpdated(
  fcmTokens: string[],
  marketplace: string,
  orderId: string,
  trackingNumber: string,
  carrier: string,
): Promise<void> {
  const title = 'Kargo Bilgisi Güncellendi';
  const body = `${marketplace.toUpperCase()} — ${carrier}: ${trackingNumber}`;
  await sendMulticastFcm(fcmTokens, title, body, {
    type: 'tracking_updated',
    marketplace,
    orderId,
    trackingNumber,
    carrier,
  });
}