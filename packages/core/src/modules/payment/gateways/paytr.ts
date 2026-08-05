import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../../../utils/logger.js';
import type { StorePaymentMethod } from '../../../models/ContentModels.js';
import type { PaymentGateway, GatewayPaymentRequest, GatewayPaymentResult, GatewayWebhookResult, GatewayRefundResult } from './types.js';

const PAYTR_API = 'https://www.paytr.com/odeme/api/get-token';

function credentials(method: any): { merchantId: string; merchantKey: string; merchantSalt: string } {
  const cfg = (method.config as any) || {};
  const merchantId = String(cfg.merchant_id || '');
  const merchantKey = String(cfg.merchant_key || '');
  const merchantSalt = String(cfg.merchant_salt || '');
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error('PayTR merchant_id/merchant_key/merchant_salt not configured for this store');
  }
  return { merchantId, merchantKey, merchantSalt };
}

export class PayTRGateway implements PaymentGateway {
  provider = 'paytr';

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResult> {
    const { merchantId, merchantKey, merchantSalt } = credentials(req.method);
    const userIp = req.ipAddress || '85.34.78.112';
    const merchantOid = `RH${req.order.id}-${req.order.orderNumber}`;
    const email = req.customer.email || 'musteri@rahatio.com.tr';
    const paymentAmount = Math.round(Number(req.order.totalAmount) * 100); // kuruş
    const currency = (req.order.currency || 'TRY').toUpperCase() === 'TRY' ? 'TL' : (req.order.currency || 'TRY').toUpperCase();
    const testMode = (req.method.config as any)?.test_mode ? 1 : 0;

    const basketItems = ((req.order.items as any[]) || []).map((it) => [
      (it.name || 'Urun').slice(0, 250),
      String(it.quantity || 1),
      String(Math.round(Number(it.unitPrice ?? it.price ?? 0) * 100) / 100),
    ]);
    if (basketItems.length === 0) basketItems.push(['Siparis', '1', String(Math.round(Number(req.order.totalAmount) * 100) / 100)]);
    const userBasket = JSON.stringify(basketItems);

    const hashStr = [
      merchantId, userIp, merchantOid, email, paymentAmount, userBasket,
      '0', '0', currency, testMode, merchantSalt,
    ].join(':');
    const paytrToken = crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');

    const form = new URLSearchParams({
      merchant_id: merchantId,
      user_ip: userIp,
      merchant_oid: merchantOid,
      email,
      payment_amount: String(paymentAmount),
      currency,
      user_basket: userBasket,
      no_installment: '0',
      max_installment: '0',
      user_name: req.customer.name || 'Musteri',
      user_address: String((req.order.shippingAddress as any)?.address || 'N/A'),
      user_phone: req.customer.phone || '5550000000',
      merchant_ok_url: req.callbackUrl || req.returnUrl,
      merchant_fail_url: req.callbackUrl || req.returnUrl,
      timeout_limit: '120',
      debug_on: testMode ? '1' : '0',
      test_mode: String(testMode),
      lang: 'tr',
      paytr_token: paytrToken,
    });

    const { data } = await axios.post(PAYTR_API, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    if (data?.status !== 'success' || !data.token) {
      throw new Error(`PayTR token error: ${data?.status || 'unknown'} ${data?.reason || ''}`);
    }

    logger.info(`PayTR token created for order ${req.order.id}: merchant_oid=${merchantOid}`);
    return {
      provider: this.provider,
      requiresRedirect: true,
      paymentUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
      refId: merchantOid,
    };
  }

  /** PayTR result callback. The callback hash covers merchant_oid, salt, status and total_amount. */
  async parseWebhook(
    body: unknown,
    _headers: Record<string, string | string[] | undefined>,
    secret: string
  ): Promise<GatewayWebhookResult> {
    const b = (body as Record<string, unknown>) || {};
    const merchantOid = String(b.merchant_oid || '');
    const paytrStatus = String(b.paytr_status || '');
    const totalAmount = String(b.total_amount || '');
    const hash = String(b.hash || '');
    const [merchantKey = '', merchantSalt = ''] = String(secret || '').split('|');

    if (merchantKey && merchantSalt) {
      const expected = crypto
        .createHmac('sha256', merchantKey)
        .update(`${merchantOid}${merchantSalt}${paytrStatus}${totalAmount}`)
        .digest('base64');
      const a = Buffer.from(hash || '');
      const b2 = Buffer.from(expected);
      if (a.length !== b2.length || !crypto.timingSafeEqual(a, b2)) {
        throw new Error('PayTR hash verification failed');
      }
    } else {
      throw new Error('PayTR merchant credentials unavailable for callback verification');
    }

    const orderId = Number(String(merchantOid).replace(/^RH/, '').split('-')[0]) || 0;
    return {
      orderId: orderId || undefined,
      success: paytrStatus === '1',
      refId: merchantOid,
      eventId: merchantOid,
      raw: body,
    };
  }

  async refund(_order: any, _method: StorePaymentMethod, _amount?: number, _reason?: string): Promise<GatewayRefundResult> {
    // PayTR does not expose a public refund API; refunds are handled in the PayTR panel.
    throw new Error('PayTR refund must be processed from the PayTR merchant panel');
  }
}
