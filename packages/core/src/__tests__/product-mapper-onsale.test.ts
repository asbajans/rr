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

describe('productMapper - Trendyol V2 attribute format', () => {
  const attrProduct: any = {
    ...baseProduct,
    marketplaceConfig: {
      trendyol: {
        categoryId: 900,
        brandId: 1976661,
        attributes: [
          { attributeId: 338, attributeValueId: 76662 },
          { attributeId: 339, attributeValueIds: [1, 2] },
          { attributeId: 346, customValue: 'Siyah' },
          { attributeId: 347, customAttributeValue: 'Beyaz' },
          { attributeId: 999 }, // no value → dropped
        ],
      },
    },
  };

  it('maps legacy singular attributeValueId to V2 attributeValueIds array', () => {
    const mapped = mapProductForTrendyol(attrProduct, {});
    const attr338 = mapped.attributes.find((a: any) => a.attributeId === 338);
    expect(attr338).toEqual({ attributeId: 338, attributeValueIds: [76662] });
    expect(attr338.attributeValueId).toBeUndefined();
  });

  it('preserves existing attributeValueIds arrays', () => {
    const mapped = mapProductForTrendyol(attrProduct, {});
    const attr339 = mapped.attributes.find((a: any) => a.attributeId === 339);
    expect(attr339).toEqual({ attributeId: 339, attributeValueIds: [1, 2] });
  });

  it('maps custom values to customAttributeValue (V2)', () => {
    const mapped = mapProductForTrendyol(attrProduct, {});
    const attr346 = mapped.attributes.find((a: any) => a.attributeId === 346);
    const attr347 = mapped.attributes.find((a: any) => a.attributeId === 347);
    expect(attr346).toEqual({ attributeId: 346, customAttributeValue: 'Siyah' });
    expect(attr347).toEqual({ attributeId: 347, customAttributeValue: 'Beyaz' });
    expect(mapped.attributes.some((a: any) => a.attributeId === 999)).toBe(false);
  });

  it('falls back to valid vatRate (10) when an invalid value is set', () => {
    const bad = { ...attrProduct, marketplaceConfig: { trendyol: { categoryId: 900, brandId: 1976661, vatRate: 18 } } };
    expect(mapProductForTrendyol(bad, {}).vatRate).toBe(18);
    const invalid = { ...attrProduct, marketplaceConfig: { trendyol: { categoryId: 900, brandId: 1976661, vatRate: 7 } } };
    expect(mapProductForTrendyol(invalid, {}).vatRate).toBe(10);
  });
});