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
});
