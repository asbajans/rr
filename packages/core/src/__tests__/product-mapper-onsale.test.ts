import { describe, expect, it } from 'vitest';
import {
  mapProductForTrendyol,
  mapProductForN11,
  mapProductForHepsiburada,
  mapProductForPazarama,
  mapProductForAmazon,
  mapProductForEtsy,
  marketplaceQuantity,
  isProductOnSale,
} from '../marketplace/productMapper.js';

const baseProduct: any = {
  sku: 'SKU-1',
  title: 'Test Ürün',
  priceTRY: 100,
  quantity: 5,
  isActive: true,
  marketplaceConfig: {
    trendyol: { categoryId: 900, brandId: 1976661 },
    n11: { categoryId: 123, shipmentTemplate: 'Standart' },
    hepsiburada: { categoryId: 100, brandId: 200 },
    pazarama: { categoryId: 'GUID-CAT', brandId: 'GUID-BRAND' },
    amazon: { categoryId: 300 },
    etsy: { categoryId: 400 },
  },
};

describe('productMapper - on-sale quantity handling', () => {
  it('returns 0 quantity for inactive products across all mappers', () => {
    const inactive = { ...baseProduct, isActive: false };

    expect(marketplaceQuantity(inactive)).toBe(0);
    expect(isProductOnSale(inactive)).toBe(false);

    expect(mapProductForTrendyol(inactive, {}).quantity).toBe(0);
    expect(mapProductForN11(inactive, {}).quantity).toBe(0);
    expect(mapProductForHepsiburada(inactive, {}).quantity).toBe(0);
    expect(mapProductForPazarama(inactive, {}).StockCount).toBe(0);
    expect(mapProductForAmazon(inactive, {}).quantity).toBe(0);
    expect(mapProductForEtsy(inactive, {}).quantity).toBe(0);
  });

  it('keeps real quantity for active products', () => {
    expect(marketplaceQuantity(baseProduct)).toBe(5);
    expect(mapProductForTrendyol(baseProduct, {}).quantity).toBe(5);
    expect(mapProductForN11(baseProduct, {}).quantity).toBe(5);
    expect(mapProductForPazarama(baseProduct, {}).StockCount).toBe(5);
  });

  it('marks N11 inactive products as Suspended', () => {
    const inactive = { ...baseProduct, isActive: false };
    expect(mapProductForN11(inactive, {}).status).toBe('Suspended');
    expect(mapProductForN11(baseProduct, {}).status).toBe('Active');
  });

  it('marks Etsy inactive products with is_active false', () => {
    const inactive = { ...baseProduct, isActive: false };
    expect(mapProductForEtsy(inactive, {}).is_active).toBe(false);
    expect(mapProductForEtsy(baseProduct, {}).is_active).toBe(true);
  });

  it('defaults to on-sale when isActive is undefined', () => {
    const unknown = { ...baseProduct, isActive: undefined };
    expect(isProductOnSale(unknown)).toBe(true);
  });
});