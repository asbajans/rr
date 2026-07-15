import { ProductData } from '../../types';

export interface TrendyolCategoryAttribute {
  attributeId: number;
  name: string;
  allowCustom: boolean;
  allowedValues: { id: number; value: string }[];
}

export interface TrendyolV2Item {
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  categoryId: number;
  quantity: number;
  stockCode: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  description: string;
  currency: string;
  attributes: { attributeId: number; attributeValueId?: number; customAttributeValue?: string }[];
  images: { url: string }[];
}

export function buildTrendyolV2Item(params: {
  data: ProductData;
  brandId: number;
  categoryId: number;
  requiredAttributes: TrendyolCategoryAttribute[];
}): TrendyolV2Item {
  const { data, brandId, categoryId, requiredAttributes } = params;

  const attributes: TrendyolV2Item['attributes'] = [];
  for (const attr of requiredAttributes) {
    const incoming = data.attributes?.[attr.name];
    const incomingStr = incoming != null ? String(incoming) : '';
    let matched: { id: number; value: string } | undefined;
    if (incomingStr && Array.isArray(attr.allowedValues)) {
      matched = attr.allowedValues.find(
        (av) => av.value && incomingStr.toLowerCase() === String(av.value).toLowerCase()
      );
    }
    if (matched) {
      attributes.push({ attributeId: attr.attributeId, attributeValueId: Number(matched.id) });
    } else if (attr.allowCustom) {
      attributes.push({ attributeId: attr.attributeId, customAttributeValue: incomingStr || attr.name });
    } else if (Array.isArray(attr.allowedValues) && attr.allowedValues.length) {
      attributes.push({ attributeId: attr.attributeId, attributeValueId: Number(attr.allowedValues[0].id) });
    }
  }

  const price = Number(data.price) || 0;

  return {
    barcode: data.barcode || data.sku,
    title: data.name,
    productMainId: data.sku,
    brandId,
    categoryId,
    quantity: Number(data.stock) || 0,
    stockCode: data.sku,
    listPrice: price,
    salePrice: price,
    vatRate: 18,
    description: data.description || data.name,
    currency: 'TRY',
    attributes,
    images: (data.images || []).slice(0, 8).map((url) => ({ url })),
  };
}
