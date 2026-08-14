import nodemailer from 'nodemailer';
import { Customer } from '../../models/Customer.model.js';
import { CustomerNotification } from '../../models/CustomerNotification.model.js';
import { Setting } from '../../models/Setting.model.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export type CustomerNotificationInput = { type: string; title: string; body: string; metadata?: object };
export interface EmailProvider { send(to: string, subject: string, body: string): Promise<void>; }
export interface SmsProvider { send(to: string, body: string): Promise<void>; }
export interface PushProvider { send(customerId: number, title: string, body: string, metadata?: object): Promise<void>; }

const _transporterCache = new Map<string, nodemailer.Transporter>();

async function getSmtpConfig(storeId: number): Promise<{ host: string; port: number; secure: boolean; user: string; pass: string; from: string }> {
  const setting = await Setting.findOne({ where: { key: `smtp:${storeId}` } });
  if (setting?.value?.host && setting.value.user) {
    return { host: setting.value.host, port: Number(setting.value.port) || 587, secure: !!setting.value.secure, user: setting.value.user, pass: setting.value.pass || '', from: setting.value.from || setting.value.user };
  }
  return { host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, user: config.smtp.user, pass: config.smtp.pass, from: config.smtp.from };
}

async function getSmsConfig(storeId: number): Promise<{ accountSid: string; authToken: string; phoneNumber: string }> {
  const setting = await Setting.findOne({ where: { key: `sms:${storeId}` } });
  if (setting?.value?.accountSid && setting.value.authToken) {
    return { accountSid: setting.value.accountSid, authToken: setting.value.authToken, phoneNumber: setting.value.phoneNumber || '' };
  }
  return { accountSid: config.sms.accountSid, authToken: config.sms.authToken, phoneNumber: config.sms.phoneNumber };
}

async function getTransporter(storeId: number): Promise<nodemailer.Transporter | null> {
  const cacheKey = String(storeId);
  if (_transporterCache.has(cacheKey)) return _transporterCache.get(cacheKey)!;
  const { host, port, secure, user, pass } = await getSmtpConfig(storeId);
  if (!host || !user) {
    logger.warn(`[notifications] SMTP not configured for store ${storeId} — emails will be skipped`);
    return null;
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  _transporterCache.set(cacheKey, transporter);
  return transporter;
}

// Clear transporter cache when settings change
export function clearSmtpCache(storeId: number) {
  _transporterCache.delete(String(storeId));
}

class SmtpEmailProvider implements EmailProvider {
  private storeId: number;
  constructor(storeId: number) { this.storeId = storeId; }
  async send(to: string, subject: string, body: string): Promise<void> {
    const transporter = await getTransporter(this.storeId);
    if (!transporter) return;
    const smtp = await getSmtpConfig(this.storeId);
    try {
      await transporter.sendMail({ from: smtp.from, to, subject, html: body });
      logger.info(`[notifications] Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      logger.error(`[notifications] Email failed to ${to}: ${err.message}`);
    }
  }
}

class TwilioSmsProvider implements SmsProvider {
  private storeId: number;
  constructor(storeId: number) { this.storeId = storeId; }
  async send(to: string, body: string): Promise<void> {
    const { accountSid, authToken, phoneNumber } = await getSmsConfig(this.storeId);
    if (!accountSid || !authToken || !phoneNumber) return;
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams({ To: to, From: phoneNumber, Body: body });
      const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
      if (!resp.ok) {
        const text = await resp.text();
        logger.error(`[notifications] SMS failed to ${to}: ${resp.status} ${text}`);
      } else {
        logger.info(`[notifications] SMS sent to ${to}`);
      }
    } catch (err: any) {
      logger.error(`[notifications] SMS failed to ${to}: ${err.message}`);
    }
  }
}

class NoopPushProvider implements PushProvider {
  async send(_customerId: number, _title: string, _body: string, _metadata?: object) {}
}

export function notificationProviders(storeId: number = 0) {
  return { email: new SmtpEmailProvider(storeId), sms: new TwilioSmsProvider(storeId), push: new NoopPushProvider() };
}

export async function notifyCustomer(customer: Customer, input: CustomerNotificationInput) {
  const notification = await CustomerNotification.create({
    storeId: customer.storeId,
    customerId: customer.id,
    type: input.type,
    title: input.title,
    body: input.body,
    metadata: input.metadata || null,
    readAt: null,
  });
  const providers = notificationProviders(customer.storeId);
  await Promise.allSettled([
    providers.email.send(customer.email, input.title, input.body),
    customer.phone ? providers.sms.send(customer.phone, input.body) : Promise.resolve(),
    providers.push.send(customer.id, input.title, input.body, input.metadata),
  ]);
  return notification;
}

export function buildOrderEmail(type: string, orderData: {
  orderNumber: string;
  customerName?: string;
  status?: string;
  trackingNumber?: string;
  carrier?: string;
  totalAmount?: number;
  items?: Array<{ name: string; quantity: number; price: number }>;
  storeName?: string;
}): { subject: string; html: string } {
  const { orderNumber, customerName, status, trackingNumber, carrier, totalAmount, items, storeName } = orderData;
  const name = customerName || 'Değerli Müşterimiz';
  const store = storeName || 'Mağazamız';

  const statusLabels: Record<string, string> = {
    pending: 'Siparişiniz Alındı',
    confirmed: 'Siparişiniz Onaylandı',
    processing: 'Siparişiniz Hazırlanıyor',
    shipped: 'Siparişiniz Kargoya Verildi',
    delivered: 'Siparişiniz Teslim Edildi',
    cancelled: 'Siparişiniz İptal Edildi',
    returned: 'Siparişiniz İade Edildi',
  };

  const statusLabel = statusLabels[status || 'pending'] || 'Sipariş Durumu Güncellendi';

  let itemsHtml = '';
  if (items && items.length > 0) {
    itemsHtml = `
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr style="background:#f5f5f5">
          <td style="padding:8px;font-weight:bold">Ürün</td>
          <td style="padding:8px;text-align:center">Adet</td>
          <td style="padding:8px;text-align:right">Fiyat</td>
        </tr>
        ${items.map(i => `
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:8px">${i.name}</td>
            <td style="padding:8px;text-align:center">${i.quantity}</td>
            <td style="padding:8px;text-align:right">${i.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  const trackingHtml = trackingNumber ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-weight:bold;color:#166534">Kargo Takip Bilgisi</p>
      <p style="margin:8px 0 0;color:#166534">
        ${carrier ? `Kargo Firması: <strong>${carrier}</strong><br/>` : ''}
        Takip Numarası: <strong>${trackingNumber}</strong>
      </p>
    </div>
  ` : '';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#1a1a1a">${statusLabel}</h2>
      <p>Merhaba ${name},</p>
      <p><strong>${store}</strong> mağazasından verdiğiniz <strong>${orderNumber}</strong> numaralı siparişinizle ilgili bir güncelleme vardır.</p>
      ${itemsHtml}
      ${totalAmount ? `<p style="font-size:18px;font-weight:bold;text-align:right;margin:16px 0">Toplam: ${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>` : ''}
      ${trackingHtml}
      <p style="color:#666;font-size:13px;margin-top:24px">Siparişlerinizi mağaza panelinizden takip edebilirsiniz.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="color:#999;font-size:11px">Bu e-posta ${store} tarafından gönderilmiştir.</p>
    </div>
  `;

  return { subject: `${store} - ${statusLabel} (${orderNumber})`, html };
}
