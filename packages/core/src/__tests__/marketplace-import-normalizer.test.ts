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
});
