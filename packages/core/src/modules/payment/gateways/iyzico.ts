import Iyzipay from 'iyzipay';
import crypto from 'crypto';
import { logger } from '../../../utils/logger.js';
import type { StorePaymentMethod } from '../../../models/ContentModels.js';
import type { PaymentGateway, GatewayPaymentRequest, GatewayPaymentResult, GatewayWebhookResult, GatewayRefundResult } from './types.js';

function client(method: any): any {
  const cfg = (method.config as any) || {};
  const apiKey = cfg.api_key;
  const secretKey = cfg.secret_key;
  if (!apiKey || !secretKey) throw new Error('iyzico api_key/secret_key not configured for this store');
  return new Iyzipay({
    apiKey,
    secretKey,
    uri: cfg.base_url || 'https://api.iyzipay.com',
  });
}

export class IyzicoGateway implements PaymentGateway {
  provider = 'iyzico';

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResult> {
    const c = client(req.method);
    const currency = (req.order.currency || 'TRY').toUpperCase();
    const total = String(Number(req.order.totalAmount));
    const subtotal = String(Number(req.order.subtotal));

    const buyerName = (req.customer.name || '').split(' ').filter(Boolean);
    const buyer: Record<string, unknown> = {
      id: String(req.order.id),
      name: buyerName[0] || 'Musteri',
      surname: buyerName.slice(1).join(' ') || 'Musteri',
      identityNumber: '11111111111',
      email: req.customer.email || 'musteri@rahatio.com.tr',
      gsmNumber: req.customer.phone || '5550000000',
      registrationDate: new Date().toISOString().split('T')[0],
      lastLoginDate: new Date().toISOString().split('T')[0],
      registrationAddress: (req.order.shippingAddress as any)?.address || 'N/A',
      city: (req.order.shippingAddress as any)?.city || 'Istanbul',
      country: 'Turkey',
      zipCode: (req.order.shippingAddress as any)?.zip_code || '34000',
      ip: req.ipAddress || '85.34.78.112',
    };

    const contactName = (req.order.shippingAddress as any)?.full_name || req.customer.name || 'Musteri';
    const address = (req.order.shippingAddress as any)?.address || 'N/A';
    const city = (req.order.shippingAddress as any)?.city || 'Istanbul';
    const zip = (req.order.shippingAddress as any)?.zip_code || '34000';
    const shippingAddress: Record<string, unknown> = { contactName, city, country: 'Turkey', address, zipCode: zip };
    const billingAddress: Record<string, unknown> = { ...shippingAddress };

    const items = (req.order.items as any[]) || [];
    const basketItems = items.map((it, i) => ({
      id: String(it.sku || it.product_id || i),
      name: (it.name || 'Urun').slice(0, 100),
      category1: 'Genel',
      itemType: 'PHYSICAL',
      price: String(Number(it.unitPrice ?? it.price ?? 0)),
    }));
    if (basketItems.length === 0) {
      basketItems.push({ id: String(req.order.id), name: 'Siparis', category1: 'Genel', itemType: 'PHYSICAL', price: subtotal });
    }

    const request = {
      locale: 'tr',
      conversationId: String(req.order.id),
      price: subtotal,
      paidPrice: total,
      currency,
      basketId: req.order.orderNumber,
      paymentGroup: 'PRODUCT',
      callbackUrl: req.callbackUrl || req.returnUrl,
      enabledInstallments: [1],
      buyer,
      shippingAddress,
      billingAddress,
      basketItems,
    };

    return new Promise<GatewayPaymentResult>((resolve, reject) => {
      c.paymentPage.initialize(request, (err: unknown, result: any) => {
        if (err) return reject(err instanceof Error ? err : new Error(String(err)));
        if (result?.status !== 'success' || !result.paymentPageUrl) {
          return reject(new Error(`iyzico initialize failed: ${result?.errorMessage || result?.errorCode || 'unknown'}`));
        }
        logger.info(`iyzico payment page created for order ${req.order.id}: token=${result.token}`);
        resolve({
          provider: this.provider,
          requiresRedirect: true,
          paymentUrl: result.paymentPageUrl,
          refId: result.token,
        });
      });
    });
  }

  /** Callback values are not trusted; retrieve the checkout result from iyzico. */
  async parseWebhook(
    body: unknown,
    _headers: Record<string, string | string[] | undefined>,
    secret: string
  ): Promise<GatewayWebhookResult> {
    const b = (body as Record<string, unknown>) || {};
    const token = String(b.token || '');
    if (!token) throw new Error('iyzico callback without token');
    const [apiKey = '', secretKey = ''] = String(secret || '').split('|');
    if (!apiKey || !secretKey) throw new Error('iyzico credentials unavailable for callback verification');
    const c = client({ config: { api_key: apiKey, secret_key: secretKey } });
    const retrieved = await new Promise<any>((resolve, reject) => {
      c.checkoutForm.retrieve({ locale: 'tr', conversationId: String(b.conversationId || b.orderId || ''), token }, (err: unknown, result: any) => {
        if (err) return reject(err instanceof Error ? err : new Error(String(err)));
        resolve(result);
      });
    });
    if (retrieved?.status !== 'success' || retrieved?.paymentStatus !== 'SUCCESS') {
      return {
        orderId: Number(retrieved?.conversationId || b.conversationId) || undefined,
        success: false,
        refId: String(retrieved?.paymentId || token),
        eventId: String(retrieved?.paymentId || token),
        raw: retrieved,
      };
    }
    const signature = String(retrieved.signature || '');
    const expected = crypto.createHmac('sha256', secretKey)
      .update([
        retrieved.paymentStatus,
        retrieved.paymentId,
        retrieved.currency,
        retrieved.basketId,
        retrieved.conversationId,
        retrieved.paidPrice,
        retrieved.price,
        retrieved.token,
      ].join(':'))
      .digest('hex');
    if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new Error('iyzico signature verification failed');
    }
    return {
      orderId: Number(retrieved.conversationId) || undefined,
      success: true,
      refId: String(retrieved.paymentId),
      eventId: String(retrieved.paymentId),
      raw: retrieved,
    };
  }

  async refund(order: any, method: StorePaymentMethod, _amount?: number, _reason?: string): Promise<GatewayRefundResult> {
    const cfg = ((method.config as any) || {}) as { api_key?: string; secret_key?: string; base_url?: string };
    if (!cfg.api_key || !cfg.secret_key) throw new Error('iyzico credentials unavailable for refund');
    const c = new Iyzipay({ apiKey: cfg.api_key, secretKey: cfg.secret_key, uri: cfg.base_url || 'https://api.iyzipay.com' });
    const refId = order.paymentRefId;
    if (!refId) throw new Error('Order has no iyzico payment reference');

    return new Promise<GatewayRefundResult>((resolve, reject) => {
      c.refund.create(
        {
          locale: 'tr',
          conversationId: String(order.id),
          paymentTransactionId: refId,
          price: String(Number(order.totalAmount)),
          currency: (order.currency || 'TRY').toUpperCase(),
        },
        (err: unknown, result: any) => {
          if (err) return reject(err instanceof Error ? err : new Error(String(err)));
          if (result?.status !== 'success') return reject(new Error(`iyzico refund failed: ${result?.errorMessage || result?.errorCode || 'unknown'}`));
          resolve({ success: true, refId: result.refundId || refId });
        }
      );
    });
  }
}
