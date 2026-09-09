import { Router, Request, Response } from 'express';
import { Store } from '../../models/Store.model.js';
import { StorePaymentMethod } from '../../models/ContentModels.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { createGateway } from './gateways/index.js';
import { confirmPaidOrder } from './confirmPaidOrder.js';
import { verifyOrderToken } from '../order/checkout.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { sequelize } from '../../config/database.js';

export const paymentWebhookRoutes: Router = Router();

function isAllowedRedirect(urlStr: string, store?: Store | null): boolean {
  if (!urlStr) return true; // empty allowed (will fallback)
  try {
    const u = new URL(urlStr);
    const frontendHost = (() => { try { return new URL(config.frontendUrl).hostname; } catch { return 'rahatio.com.tr'; } })();
    const allowedHosts = new Set<string>([
      frontendHost,
      'rahatio.com.tr',
      'www.rahatio.com.tr',
      'localhost',
      '127.0.0.1',
    ]);
    // store-specific domains
    if (store?.domain) {
      try { allowedHosts.add(new URL(store.domain.startsWith('http') ? store.domain : `https://${store.domain}`).hostname); } catch {}
    }
    if ((store as any)?.siteUrl) {
      try { allowedHosts.add(new URL((store as any).siteUrl).hostname); } catch {}
    }
    // exact or subdomain of rahatio.com.tr
    if (u.hostname === 'rahatio.com.tr' || u.hostname.endsWith('.rahatio.com.tr')) return true;
    if (allowedHosts.has(u.hostname)) return true;
    // allow same frontend host subdomains
    if (frontendHost && (u.hostname === frontendHost || u.hostname.endsWith('.' + frontendHost))) return true;
    return false;
  } catch {
    return false;
  }
}

async function loadStoreMethod(
  siteCode: string,
  provider: string
): Promise<{ store: Store; method: StorePaymentMethod } | null> {
  const store = await Store.findOne({ where: { siteCode } });
  if (!store) return null;
  const method = await StorePaymentMethod.findOne({
    where: { storeId: store.id, type: provider, isActive: true },
  });
  if (!method) return null;
  return { store, method };
}

async function confirmFromResult(
  result: { orderId?: number; success: boolean; refId: string; eventId?: string; raw: unknown },
  provider: string,
  storeId: number
): Promise<void> {
  if (!result.orderId) throw new Error('Payment callback has no order ID');
  const order = await DropshippingOrder.findOne({ where: { id: result.orderId, storeId } });
  if (!order) throw new Error('Payment order not found');
  if (order.paymentProvider !== provider) throw new Error('Payment provider does not match order');

  if (!result.success) {
    if (order.paymentStatus === 'awaiting') await order.update({ paymentStatus: 'failed' });
    return;
  }

  const raw = (result.raw as any) || {};
  const expected = Number(order.totalAmount);
  const paid = provider === 'stripe'
    ? Number(raw?.data?.object?.amount_total ?? raw?.data?.object?.amount_received ?? 0) / 100
    : provider === 'paytr'
      ? Number(raw.total_amount)
      : Number(raw.paidPrice);
  if (!Number.isFinite(paid) || Math.abs(paid - expected) > 0.01) {
    throw new Error(`Payment amount mismatch: expected ${expected}, received ${paid}`);
  }
  const currency = provider === 'paytr' ? 'TRY' : String(raw.currency || '').toUpperCase();
  if (currency && currency !== String(order.currency || 'TRY').toUpperCase()) {
    throw new Error('Payment currency mismatch');
  }

  await confirmPaidOrder(result.orderId, {
    refId: result.refId,
    eventId: result.eventId,
    provider,
    paymentDetails: result.raw,
  });
}

async function handleCallback(req: Request, res: Response): Promise<void> {
  const provider = req.params.provider;
  const found = await loadStoreMethod(req.params.siteCode, provider);
  if (!found) {
    res.status(404).json({ error: `Store or ${provider} payment method not found` });
    return;
  }
  const gateway = createGateway(provider);
  if (!gateway) {
    res.status(404).json({ error: `Unsupported provider: ${provider}` });
    return;
  }

  const cfg = (found.method.config as any) || {};
  const secret =
    provider === 'paytr'
      ? `${cfg.merchant_key || ''}|${cfg.merchant_salt || ''}`
      : provider === 'iyzico'
        ? `${cfg.api_key || ''}|${cfg.secret_key || ''}`
        : '';

  try {
    const body = req.method === 'GET' ? req.query : req.body;
    const result = await gateway.parseWebhook(body, req.headers, secret);
    await confirmFromResult(result, provider, found.store.id);
    logger.info(`${provider} callback ok: orderId=${result.orderId} success=${result.success}`);

    const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : undefined;
    if (redirect) {
      if (!isAllowedRedirect(redirect, found.store)) {
        logger.warn({ redirect, storeId: found.store.id }, 'Blocked open redirect attempt');
        res.status(400).json({ error: 'Invalid redirect URL' });
        return;
      }
      const status = result.success ? 'success' : 'failed';
      const q = new URLSearchParams({ payment: status });
      if (result.orderId) q.set('orderId', String(result.orderId));
      const sep = redirect.includes('?') ? '&' : '?';
      res.redirect(302, `${redirect}${sep}${q.toString()}`);
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    logger.error(`${provider} callback error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
}

// Stripe webhook — requires raw body; express.raw is mounted ahead of express.json in server.ts
paymentWebhookRoutes.post('/:siteCode/payments/webhook/stripe', async (req: Request, res: Response) => {
  const provider = 'stripe';
  const found = await loadStoreMethod(req.params.siteCode, provider);
  if (!found) {
    res.status(404).json({ error: 'Store or Stripe payment method not found' });
    return;
  }
  const gateway = createGateway(provider);
  const cfg = (found.method.config as any) || {};
  const secret = cfg.webhook_secret || '';
  if (!secret) {
    res.status(400).json({ error: 'Stripe webhook_secret is not configured for this store' });
    return;
  }
  try {
    const result = await gateway!.parseWebhook({ raw: req.body }, req.headers, secret);
    // idempotency for storefront Stripe events (same as SaaS)
    if (result.eventId) {
      try {
        await sequelize.query(`CREATE TABLE IF NOT EXISTS stripe_storefront_events ("eventId" VARCHAR(200) PRIMARY KEY, type VARCHAR(100), "createdAt" TIMESTAMP DEFAULT NOW())`);
        const [dup]: any = await sequelize.query(`SELECT "eventId" FROM stripe_storefront_events WHERE "eventId" = $1`, { bind: [result.eventId] });
        if (Array.isArray(dup) && dup.length > 0) {
          logger.info(`Stripe storefront webhook duplicate ignored: ${result.eventId}`);
          res.status(200).json({ received: true, duplicate: true });
          return;
        }
      } catch {}
    }
    await confirmFromResult(result, provider, found.store.id);
    if (result.eventId) {
      try { await sequelize.query(`INSERT INTO stripe_storefront_events ("eventId", type) VALUES ($1,$2) ON CONFLICT ("eventId") DO NOTHING`, { bind: [result.eventId, 'stripe'] }); } catch {}
    }
    logger.info(`Stripe webhook ok: orderId=${result.orderId} success=${result.success}`);
    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error(`Stripe webhook error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// iyzico (payment page redirect / form POST) + PayTR (ok/fail form POST)
paymentWebhookRoutes.post('/:siteCode/payments/webhook/:provider', handleCallback);
paymentWebhookRoutes.post('/:siteCode/payments/callback/:provider', handleCallback);
paymentWebhookRoutes.get('/:siteCode/payments/callback/:provider', handleCallback);

// Initiate a gateway payment for an existing checkout (verified by orderToken)
paymentWebhookRoutes.post('/:siteCode/payments/initiate', async (req: Request, res: Response) => {
  try {
    const { orderId, orderToken, returnUrl } = req.body || {};
    if (!orderId || !orderToken) {
      res.status(400).json({ error: 'orderId and orderToken are required' });
      return;
    }

    const store = await Store.findOne({ where: { siteCode: req.params.siteCode } });
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const tokenData = verifyOrderToken(String(orderToken));
    if (!tokenData || tokenData.id !== Number(orderId)) {
      res.status(403).json({ error: 'Invalid or expired order token' });
      return;
    }

    const order = await DropshippingOrder.findOne({
      where: { id: tokenData.id, storeId: store.id, orderNumber: tokenData.n },
    });
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (order.paymentStatus === 'paid') {
      res.json({ alreadyPaid: true, orderId: order.id, paymentStatus: order.paymentStatus });
      return;
    }

    const provider = order.paymentProvider;
    if (!provider) {
      res.status(400).json({ error: 'Order has no payment provider (no gateway required)' });
      return;
    }
    const gateway = createGateway(provider);
    if (!gateway) {
      res.status(400).json({ error: `Unsupported payment provider: ${provider}` });
      return;
    }
    const method = await StorePaymentMethod.findOne({
      where: { storeId: store.id, type: provider, isActive: true },
    });
    if (!method) {
      res.status(400).json({ error: `Payment method not configured: ${provider}` });
      return;
    }

    const safeReturnUrl = String(returnUrl || '');
    if (safeReturnUrl && !isAllowedRedirect(safeReturnUrl, store)) {
      res.status(400).json({ error: 'Invalid returnUrl — host not allowed' });
      return;
    }

    const result = await gateway.createPayment({
      order,
      store,
      method,
      returnUrl: safeReturnUrl,
      callbackUrl: `${config.apiUrl}/api/store/${req.params.siteCode}/payments/callback/${provider}?orderId=${order.id}&redirect=${encodeURIComponent(safeReturnUrl)}`,
      ipAddress: req.ip || req.socket?.remoteAddress || '',
      customer: {
        email: order.customerEmail || '',
        name: order.customerName || '',
        phone: order.customerPhone || '',
      },
    });

    await order.update({ paymentRefId: result.refId || order.paymentRefId });
    res.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      requiresRedirect: result.requiresRedirect,
      clientToken: result.clientToken,
      paymentUrl: result.paymentUrl,
      refId: result.refId,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    logger.error(`Payment initiate error: ${err.message}`);
    res.status(500).json({ error: err.message || 'Payment initiation failed' });
  }
});
