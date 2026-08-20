import { describe, expect, it } from 'vitest';
import { normalizeMarketplaceProduct } from '../marketplace/importNormalizer.js';

describe('normalizeMarketplaceProduct', () => {
  it('preserves Trendyol brand, stock, price and approval status', () => {
    const payload = {
      title: 'Kızıl Çanta',
      description: 'Şık ve hafif çanta',
      brand: 'Lacoste',
      images: [{ url: 'https://cdn.example.com/a.jpg' }],
      variants: [
        {
          barcode: 'TR-12345',
          stock: 42,
          salePrice: 1250,
          currency: 'USD',
          status: 'inactive',
        },
      ],
    };

    const result = normalizeMarketplaceProduct('trendyol', payload, 7);

    expect(result.title).toBe('Kızıl Çanta');
    expect(result.sku).toBe('TR-12345');
    expect(result.quantity).toBe(42);
    expect(result.priceUSD).toBe(1250);
    expect(result.priceTRY).toBeUndefined();
    expect(result.isActive).toBe(false);
    expect(result.marketplaceConfig).toMatchObject({
      trendyol: {
        brand: 'Lacoste',
        stock: 42,
        currency: 'USD',
        status: 'inactive',
      },
    });
  });

  it('preserves N11 nested brand, price, stock and status values', () => {
    const payload = {
      title: 'N11 Ürün',
      description: 'Detaylı açıklama',
      brand: { name: 'Nike' },
      price: { amount: 899 },
      currencyType: 'TRY',
      inventory: { available: 15 },
      productStatus: 'inactive',
      category: { id: 123, name: 'Ayakkabı' },
      sku: 'SKU-001',
      images: [{ url: 'https://cdn.example.com/n11.jpg' }],
    };

    const result = normalizeMarketplaceProduct('n11', payload, 9);

    expect(result.title).toBe('N11 Ürün');
    expect(result.sku).toBe('SKU-001');
    expect(result.quantity).toBe(15);
    expect(result.priceTRY).toBe(899);
    expect(result.isActive).toBe(false);
    expect(result.marketplaceConfig).toMatchObject({
      n11: {
        brand: 'Nike',
        stock: 15,
        currency: 'TRY',
        category: 'Ayakkabı',
        category_id: 123,
        status: 'inactive',
      },
    });
  });

  it('treats products without an explicit status as on sale (default active)', () => {
    const result = normalizeMarketplaceProduct('trendyol', {
      title: 'Durumsuz Ürün',
      barcode: 'T-NOSTATUS',
      quantity: 3,
    }, 7);

    expect(result.isActive).toBe(true);
    expect(result.quantity).toBe(3);
  });

  it('marks passive/onhold/notapproved products as inactive', () => {
    for (const status of ['passive', 'onhold', 'notapproved', 'rejected', 'disabled', 'pasif']) {
      const result = normalizeMarketplaceProduct('trendyol', {
        title: `Durum ${status}`,
        barcode: `T-${status}`,
        quantity: 5,
        status,
      }, 7);
      expect(result.isActive, `status=${status}`).toBe(false);
    }
  });

  it('recognizes active/approved/onsale statuses as on sale', () => {
    for (const status of ['active', 'approved', 'onsale', 'on sale', 'available', 'Active']) {
      const result = normalizeMarketplaceProduct('trendyol', {
        title: `Durum ${status}`,
        barcode: `T-${status}`,
        quantity: 5,
        status,
      }, 7);
      expect(result.isActive, `status=${status}`).toBe(true);
    }
  });

  it('uses marketplace stock count from PascalCase StockCount field', () => {
    const result = normalizeMarketplaceProduct('pazarama', {
      title: 'Stoklu Ürün',
      code: 'P-STOCK',
      StockCount: 27,
      SalePrice: 599,
    }, 3);

    expect(result.quantity).toBe(27);
    expect(result.priceTRY).toBe(599);
    expect(result.isActive).toBe(true);
  });
});
