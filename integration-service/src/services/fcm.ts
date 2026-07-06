import axios from 'axios';

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';
const FCM_API_URL = 'https://fcm.googleapis.com/fcm/send';

interface FcmPayload {
  to?: string;
  registration_ids?: string[];
  notification: {
    title: string;
    body: string;
    sound?: string;
  };
  data?: Record<string, string>;
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!FCM_SERVER_KEY) {
    console.warn('FCM_SERVER_KEY not set, skipping push notification');
    return;
  }

  const payload: FcmPayload = {
    to: token,
    notification: { title, body, sound: 'default' },
    data,
  };

  try {
    await axios.post(FCM_API_URL, payload, {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error(`FCM send failed: ${msg}`);
  }
}

export async function sendMulticastNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!FCM_SERVER_KEY || tokens.length === 0) return;

  const payload: FcmPayload = {
    registration_ids: tokens,
    notification: { title, body, sound: 'default' },
    data,
  };

  try {
    await axios.post(FCM_API_URL, payload, {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error(`FCM multicast failed: ${msg}`);
  }
}
