import { ProductData } from '../../types';

/** Turkish decimal format: 199.90 -> "199,90" (Hepsiburada catalog import expects comma). */
export function toCommaDecimal(value: number | string | undefined): string {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '0,00';
  return n.toFixed(2).replace('.', ',');
}

/** Map normalized ProductData -> Hepsiburada catalog import product object. */
export function mapToHepsiburadaCreatePayload(data: ProductData, merchantId: string): any {
  const images = (data.images || []).slice(0, 10);
  const attributes: Record<string, any> = {
    merchantSku: data.sku || `${data.id}`,
    UrunAdi: data.name,
    UrunAciklamasi: data.description,
    price: toCommaDecimal(data.price),
    stock: String(Number(data.stock || 0)),
  };
  if (data.brand) attributes['Marka'] = data.brand;
  if (data.barcode) attributes['Barcode'] = data.barcode;
  images.forEach((url, i) => {
    attributes[`Image${i + 1}`] = url;
  });

  return {
    categoryId: Number(data.category_id || 0),
    merchant: merchantId,
    attributes,
  };
}

/** Map a Hepsiburada listing item -> normalized ProductData. */
export function mapToHepsiburadaProduct(p: any): ProductData {
  const sku = String(p.merchantSku ?? p.sku ?? p.hepsiburadaSku ?? p.productCode ?? '');
  const images: string[] = Array.isArray(p.images)
    ? p.images.map((i: any) => (typeof i === 'string' ? i : i?.url)).filter(Boolean)
    : p.image
      ? [p.image]
      : [];
  const attributes: Record<string, string> = {};
  if (p.attributes && typeof p.attributes === 'object' && !Array.isArray(p.attributes)) {
    for (const [k, v] of Object.entries(p.attributes)) attributes[k] = String(v ?? '');
  }

  return {
    id: sku,
    sku,
    name: p.productName ?? p.title ?? p.UrunAdi ?? '',
    description: p.description ?? p.UrunAciklamasi ?? '',
    price: Number(p.price ?? p.salePrice ?? p.listPrice ?? 0),
    currency: 'TRY',
    stock: Number(p.availableStock ?? p.stock ?? p.quantity ?? 0),
    category: String(p.categoryName ?? p.categoryId ?? ''),
    category_id: p.categoryId != null ? String(p.categoryId) : undefined,
    barcode: p.barcode ?? undefined,
    brand: p.brand ?? p.Marka ?? undefined,
    images: images.slice(0, 8),
    attributes,
  };
}
