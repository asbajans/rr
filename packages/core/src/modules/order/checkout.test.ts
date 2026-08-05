import { describe, expect, it } from 'vitest';
import { calculateTotals, issueOrderToken, verifyOrderToken, hashOrderToken, createCheckoutOrder, CheckoutError } from './checkout.js';
import { createGateway } from '../payment/gateways/index.js';

describe('calculateTotals', () => {
  const items = [
    { quantity: 2, unitPrice: 100 },
    { quantity: 1, unitPrice: 50 },
  ];

  it('computes subtotal with no tax/shipping', () => {
    const t = calculateTotals(items, {});
    expect(t.subtotal).toBe(250);
    expect(t.shippingAmount).toBe(0);
    expect(t.taxAmount).toBe(0);
    expect(t.totalAmount).toBe(250);
    expect(t.taxMode).toBe('none');
  });

  it('adds excluded tax on top', () => {
    const t = calculateTotals(items, { taxSettings: { rate: 20, mode: 'excluded' } });
    expect(t.subtotal).toBe(250);
    expect(t.taxAmount).toBe(50);
    expect(t.totalAmount).toBe(300);
    expect(t.taxMode).toBe('excluded');
  });

  it('computes embedded tax for included mode', () => {
    const t = calculateTotals(items, { taxSettings: { rate: 20, mode: 'included' } });
    // 250 * 20 / 120 = 41.67
    expect(t.taxAmount).toBeCloseTo(41.67, 2);
    // prices already include tax → total = subtotal
    expect(t.totalAmount).toBe(250);
  });

  it('charges shipping below freeAbove threshold', () => {
    const t = calculateTotals(items, {
      shippingSettings: { enabled: true, cost: 30, freeAbove: 500 },
    });
    expect(t.shippingAmount).toBe(30);
    expect(t.totalAmount).toBe(280);
  });

  it('waives shipping above freeAbove threshold', () => {
    const t = calculateTotals(items, {
      shippingSettings: { enabled: true, cost: 30, freeAbove: 200 },
    });
    expect(t.shippingAmount).toBe(0);
    expect(t.totalAmount).toBe(250);
  });

  it('rounds to 2 decimals', () => {
    const t = calculateTotals([{ quantity: 3, unitPrice: 33.33 }], {
      taxSettings: { rate: 18, mode: 'excluded' },
    });
    expect(t.subtotal).toBe(99.99);
    expect(t.taxAmount).toBe(18.0);
    expect(t.totalAmount).toBe(117.99);
  });
});

describe('order token', () => {
  it('round-trips issue → verify', () => {
    const token = issueOrderToken(123, 'ORD-1');
    const data = verifyOrderToken(token);
    expect(data).toEqual({ id: 123, n: 'ORD-1' });
  });

  it('rejects tampered token', () => {
    const token = issueOrderToken(123, 'ORD-1');
    const [payload, sig] = token.split('.');
    const forged = `${payload}.${sig.slice(0, -1)}x`;
    expect(verifyOrderToken(forged)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(verifyOrderToken('')).toBeNull();
    expect(verifyOrderToken('not.a.token')).toBeNull();
    expect(verifyOrderToken('onlypayload')).toBeNull();
  });

  it('hashOrderToken is deterministic', () => {
    const token = issueOrderToken(1, 'ORD-1');
    expect(hashOrderToken(token)).toBe(hashOrderToken(token));
    expect(hashOrderToken(token)).toHaveLength(64);
  });
});

describe('honeypot', () => {
  it('rejects checkout payloads that fill the website honeypot', async () => {
    const store = { id: 1 } as any;
    const payload = {
      items: [{ product_id: 1, quantity: 1 }],
      shipping_address: { full_name: 'A', phone: '1', city: 'I', district: '', address: 'a', zip_code: '' },
      customer: { email: 'a@b.c', name: 'A', phone: '' },
      payment_method: 'stripe',
      website: 'http://spam.example',
    } as any;
    await expect(createCheckoutOrder(store, payload)).rejects.toMatchObject({
      status: 400,
      message: 'Spam detected',
    });
  });

  it('throws CheckoutError (not a generic error) for honeypot hits', async () => {
    const store = { id: 1 } as any;
    const payload = {
      items: [{ product_id: 1, quantity: 1 }],
      shipping_address: {},
      customer: {},
      payment_method: 'stripe',
      website: 'x',
    } as any;
    try {
      await createCheckoutOrder(store, payload);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CheckoutError);
    }
  });
});

describe('gateway factory', () => {
  it('returns the expected gateway for supported providers', () => {
    for (const provider of ['stripe', 'iyzico', 'paytr']) {
      const gateway = createGateway(provider);
      expect(gateway).not.toBeNull();
      expect(gateway).toHaveProperty('createPayment');
      expect(gateway).toHaveProperty('parseWebhook');
      expect(gateway).toHaveProperty('refund');
    }
  });

  it('returns null for unsupported providers', () => {
    expect(createGateway('bank_transfer')).toBeNull();
    expect(createGateway('')).toBeNull();
    expect(createGateway('nope')).toBeNull();
  });
});
