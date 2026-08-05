import { describe, expect, it } from 'vitest';
import { mapPazaramaOrder, mapEtsyOrder } from './orderMapper.js';

describe('marketplace order mappings', () => {
  it('keeps Pazarama order item ids required for item-level shipment updates', () => {
    const order = mapPazaramaOrder({
      id: 'p-1',
      orderNumber: 12345,
      status: 'kargoya_verildi',
      items: [{ id: 'item-1', barcode: 'SKU-1', productName: 'Ürün', quantity: 2, salePrice: 25 }],
    });

    expect(order.status).toBe('shipped');
    expect(order.marketplaceOrderNumber).toBe('12345');
    expect(order.items[0]).toMatchObject({ orderItemId: 'item-1', sku: 'SKU-1', quantity: 2, unitPrice: 25 });
  });

  it('maps Etsy paid and shipped receipt states to internal states', () => {
    expect(mapEtsyOrder({ receipt_id: 10, status: 'paid', transactions: [] }).status).toBe('confirmed');
    expect(mapEtsyOrder({ receipt_id: 11, status: 'shipped', transactions: [] }).status).toBe('shipped');
  });
});
