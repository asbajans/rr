import { ProductData } from '../../types';

export interface TrendyolProductRequest {
  barcode: string;
  title: string;
  productMainId: string;
  brandId: number;
  categoryId: number;
  quantity: number;
  stockCode: string;
  price: number;
  description: string;
  images: { url: string }[];
  attributes: { attributeId: number; attributeValueId?: number; customAttributeValue?: string }[];
  cargoCompanyId?: number;
  deliveryDuration?: number;
}

const CATEGORY_MAP: Record<string, { categoryId: number; brandId: number }> = {
  giyim: { categoryId: 1368, brandId: 1 },
  taki: { categoryId: 1724, brandId: 1 },
  kozmetik: { categoryId: 1262, brandId: 1 },
  ayakkabi: { categoryId: 1074, brandId: 1 },
  canta: { categoryId: 1458, brandId: 1 },
  elektronik: { categoryId: 1308, brandId: 1 },
  ev_dekorasyon: { categoryId: 1416, brandId: 1 },
  spor: { categoryId: 1562, brandId: 1 },
};

export function mapToTrendyolProduct(data: ProductData): TrendyolProductRequest {
  const mapping = CATEGORY_MAP[data.category] || { categoryId: 1368, brandId: 1 };

  return {
    barcode: data.barcode || data.sku,
    title: data.name,
    productMainId: data.sku,
    brandId: mapping.brandId,
    categoryId: mapping.categoryId,
    quantity: data.stock,
    stockCode: data.sku,
    price: data.price,
    description: data.description,
    images: data.images.slice(0, 8).map((url) => ({ url })),
    attributes: Object.entries(data.attributes).map(([key, value]) => ({
      attributeId: 0,
      customAttributeValue: `${key}: ${value}`,
    })),
    deliveryDuration: 3,
  };
}
