import Stripe from 'stripe';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';
import type { StorePaymentMethod } from '../../../models/ContentModels.js';
import type { PaymentGateway, GatewayPaymentRequest, GatewayPaymentResult, GatewayWebhookResult, GatewayRefundResult } from './types.js';

const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey, { apiVersion: '2024-04-10' }) : null;

function clientFor(secretKey: string): Stripe | null {
  if (!secretKey) return null;
  return secretKey === config.stripe.secretKey ? stripe : new Stripe(secretKey, { apiVersion: '2024-04-10' });
}

export class StripeGateway implements PaymentGateway {
  provider = 'stripe';

  async createPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResult> {
    const cfg = (req.method.config as any) || {};
    const client = clientFor(cfg.secret_key || config.stripe.secretKey);
    if (!client) throw new Error('Stripe secret key is not configured for this store');

    const amount = Math.round(Number(req.order.totalAmount) * 100);
    if (amount <= 0) throw new Error('Invalid order amount');

    const currency = (req.order.currency || 'TRY').toLowerCase();
    const session = await client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: `Order ${req.order.orderNumber}`,
              description: (req.store as any).name || undefined,
            },
          },
        },
      ],
      customer_email: req.customer.email || undefined,
      metadata: {
        orderId: String(req.order.id),
        storeId: String(req.store.id),
        siteCode: (req.store as any).siteCode || '',
        orderNumber: req.order.orderNumber,
      },
      success_url: `${req.returnUrl}?payment=success&refId={CHECKOUT_SESSION_ID}&orderId=${req.order.id}`,
      cancel_url: `${req.returnUrl}?payment=cancelled&orderId=${req.order.id}`,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');

    return {
      provider: this.provider,
      requiresRedirect: true,
      paymentUrl: session.url,
      refId: session.id,
      expiresAt: session.expires_at ? session.expires_at * 1000 : undefined,
    };
  }

  async parseWebhook(
    body: unknown,
    headers: Record<string, string | string[] | undefined>,
    secret: string
  ): Promise<GatewayWebhookResult> {
    const sig = headers['stripe-signature'];
    const signature = Array.isArray(sig) ? sig[0] : sig;
    if (!signature) throw new Error('Missing stripe-signature header');
    if (!stripe) throw new Error('Stripe is not configured');
    const rawBody = (body as unknown as { raw?: Buffer }).raw;
    if (!rawBody) throw new Error('Raw body not available for signature verification');

    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

    const eventWithOrder = (metadata: { orderId?: string }, refId: string) => {
      const orderId = Number(metadata?.orderId);
      if (!orderId) throw new Error(`${event.type} without orderId metadata`);
      return { orderId, refId, raw: event };
    };

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      return { ...eventWithOrder(session.metadata as any, String(session.payment_intent || session.id)), success: true };
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      return { ...eventWithOrder(pi.metadata as any, pi.id), success: true };
    }

    if (event.type === 'payment_intent.payment_failed' || event.type === 'checkout.session.async_payment_failed') {
      const obj = event.data.object as Stripe.PaymentIntent | Stripe.Checkout.Session;
      const metadata = (obj as any).metadata as { orderId?: string };
      return { ...eventWithOrder(metadata || {}, String((obj as any).id)), success: false };
    }

    return { success: false, refId: event.id, raw: event };
  }

  async refund(
    order: any,
    method: StorePaymentMethod,
    amount?: number,
    reason?: string
  ): Promise<GatewayRefundResult> {
    const cfg = ((method.config as any) || {}) as { secret_key?: string };
    const secretKey = cfg.secret_key || config.stripe.secretKey || '';
    const client = clientFor(secretKey);
    if (!client) throw new Error('Stripe secret key is not configured');
    const refId = order.paymentRefId;
    if (!refId) throw new Error('Order has no Stripe payment reference');
    const refund = await client.refunds.create({
      payment_intent: refId,
      amount: amount != null ? Math.round(amount * 100) : undefined,
      reason: reason === 'fraudulent' ? 'fraudulent' : reason === 'duplicate' ? 'duplicate' : 'requested_by_customer',
      metadata: { orderId: String(order.id), orderNumber: order.orderNumber },
    });
    logger.info(`Stripe refund for order ${order.id}: ${refund.id} status=${refund.status}`);
    return { success: refund.status !== 'failed', refId: refund.id };
  }
}
