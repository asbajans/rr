import { describe, expect, it } from 'vitest';
import { computeSettlementTotals, toSettlementLines } from './settlement.js';

const fakeOrder = (total: number, commission: number) =>
  ({ totalAmount: total, commissionAmount: commission, orderNumber: `ORD-${Math.random()}`, createdAt: new Date() }) as any;

describe('computeSettlementTotals', () => {
  it('sums empty orders to zero', () => {
    expect(computeSettlementTotals([])).toEqual({ totalAmount: 0, commissionAmount: 0, netAmount: 0, orderCount: 0 });
  });

  it('computes totals, commission and net across orders', () => {
    const result = computeSettlementTotals([fakeOrder(1000, 50), fakeOrder(2000, 100)]);
    expect(result).toEqual({ totalAmount: 3000, commissionAmount: 150, netAmount: 2850, orderCount: 2 });
  });

  it('rounds to 2 decimals', () => {
    const result = computeSettlementTotals([fakeOrder(33.33, 4.17), fakeOrder(66.67, 8.33)]);
    expect(result.netAmount).toBe(87.5);
  });
});

describe('toSettlementLines', () => {
  it('maps orders with net = total - commission', () => {
    const lines = toSettlementLines([fakeOrder(500, 25)]);
    expect(lines[0]).toMatchObject({ totalAmount: 500, commissionAmount: 25, netAmount: 475 });
  });
});
