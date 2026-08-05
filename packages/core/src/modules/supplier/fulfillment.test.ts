import { describe, expect, it } from 'vitest';
import { deriveParentStatus, latestSupplierTracking, toRestockMap, SUPPLIER_STATUS } from './fulfillment.js';

describe('deriveParentStatus', () => {
  it('returns null for an empty sub-order set', () => {
    expect(deriveParentStatus([])).toBeNull();
  });

  it('returns null while all sub-orders are still pending', () => {
    expect(deriveParentStatus([{ supplierStatus: 'pending' }, { supplierStatus: 'pending' }])).toBeNull();
  });

  it('confirms the parent when a sub-order is accepted', () => {
    expect(deriveParentStatus([{ supplierStatus: 'accepted' }, { supplierStatus: 'pending' }])).toBe('confirmed');
  });

  it('ships the parent when every sub-order is fulfilled', () => {
    expect(deriveParentStatus([{ supplierStatus: 'fulfilled' }, { supplierStatus: 'fulfilled' }])).toBe('shipped');
  });

  it('cancels the parent when any sub-order is rejected', () => {
    expect(deriveParentStatus([{ supplierStatus: 'fulfilled' }, { supplierStatus: 'rejected' }])).toBe('cancelled');
  });
});

describe('latestSupplierTracking', () => {
  it('returns null when nothing is tracked', () => {
    expect(latestSupplierTracking([{ trackingNumber: undefined }, {}])).toBeNull();
  });

  it('picks the last sub-order that carries a tracking number', () => {
    const tracking = latestSupplierTracking([
      { trackingNumber: 'ABC', carrier: 'Yurtiçi' },
      { trackingNumber: undefined },
      { trackingNumber: 'XYZ', carrier: 'Aras' },
    ]);
    expect(tracking).toEqual({ trackingNumber: 'XYZ', carrier: 'Aras' });
  });
});

describe('toRestockMap', () => {
  it('aggregates quantities by product id (supports both product_id and productId)', () => {
    const map = toRestockMap([
      { product_id: 5, quantity: 2 },
      { productId: 5, quantity: 1 },
      { productId: 9, quantity: 3 },
      { quantity: 7 },
    ]);
    expect(map.get(5)).toBe(3);
    expect(map.get(9)).toBe(3);
    expect(map.size).toBe(2);
  });
});

describe('SUPPLIER_STATUS constants', () => {
  it('exposes the expected states', () => {
    expect(SUPPLIER_STATUS).toEqual({ PENDING: 'pending', ACCEPTED: 'accepted', REJECTED: 'rejected', FULFILLED: 'fulfilled' });
  });
});
