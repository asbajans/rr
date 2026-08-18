import { describe, expect, it } from 'vitest';
import { normalizeMarketplaceStatus } from '../modules/integration/orderImport.js';

describe('normalizeMarketplaceStatus', () => {
  it('maps N11 raw statuses to Rahatio statuses', () => {
    const cases: Array<[string, string]> = [
      ['Created', 'pending'],
      ['WaitingForApproval', 'pending'],
      ['Approved', 'processing'],
      ['Picking', 'processing'],
      ['UnPacked', 'processing'],
      ['Invoiced', 'processing'],
      ['UnSupplied', 'cancelled'],
      ['Shipped', 'shipped'],
      ['Kargolandı', 'shipped'],
      ['Kargolandi', 'shipped'],
      ['Completed', 'delivered'],
      ['Delivered', 'delivered'],
      ['Cancelled', 'cancelled'],
      ['Returned', 'returned'],
    ];
    for (const [raw, expected] of cases) {
      expect(normalizeMarketplaceStatus('n11', raw)).toBe(expected);
    }
  });

  it('maps Turkish order statuses', () => {
    expect(normalizeMarketplaceStatus('n11', 'Onaylandı')).toBe('processing');
    expect(normalizeMarketplaceStatus('n11', 'kargoya verildi')).toBe('shipped');
    expect(normalizeMarketplaceStatus('n11', 'İptal edildi')).toBe('cancelled');
    expect(normalizeMarketplaceStatus('n11', 'Teslim edildi')).toBe('delivered');
  });

  it('maps Pazarama numeric statuses', () => {
    expect(normalizeMarketplaceStatus('pazarama', 3)).toBe('pending');
    expect(normalizeMarketplaceStatus('pazarama', 12)).toBe('processing');
    expect(normalizeMarketplaceStatus('pazarama', 5)).toBe('shipped');
    expect(normalizeMarketplaceStatus('pazarama', 11)).toBe('delivered');
    expect(normalizeMarketplaceStatus('pazarama', 9)).toBe('cancelled');
    expect(normalizeMarketplaceStatus('pazarama', 14)).toBe('returned');
    expect(normalizeMarketplaceStatus('pazarama', 15)).toBe('returned');
  });

  it('falls back to pending for unknown statuses', () => {
    expect(normalizeMarketplaceStatus('n11', 'BilinmeyenDurum')).toBe('pending');
    expect(normalizeMarketplaceStatus('trendyol', null)).toBe('pending');
  });
});