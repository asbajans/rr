import { ProductData } from '../../types';

export function mapToAmazonProduct(item: any, catalog?: any): ProductData {
  const asin = item.asin ?? catalog?.asin ?? '';
  const summaries = Array.isArray(catalog?.summaries) ? catalog.summaries : [catalog?.summaries];
  const summary = summaries[0] ?? {};
  const attributes = catalog?.attributes ?? {};

  const title =
    summary.itemName ??
    attributes.item_name?.[0]?.value ??
    item.summaries?.[0]?.itemName ??
    '';

  const brand = summary.brandName ?? attributes.brand?.[0]?.value ?? undefined;
  const category =
    summary.categoryName ??
    attributes.product_category?.[0]?.value ??
    attributes.item_type_keyword?.[0]?.value ??
    '';

  const images: string[] = [];
  for (const key of ['images', 'image', 'main_image', 'other_images']) {
    const val = (catalog ?? item)[key];
    if (Array.isArray(val)) {
      for (const img of val) {
        const url = img?.link ?? img?.url ?? (typeof img === 'string' ? img : null);
        if (url) images.push(url);
      }
    }
  }

  const offers = item.offers ?? [];
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const price = Number(offer?.price?.amount ?? offer?.price ?? summary?.price?.amount ?? 0);
  const currency = (offer?.price?.currencyCode ?? summary?.price?.currencyCode ?? 'TRY').toString().toUpperCase();
  const stock = Number(offer?.buyBoxPrice ?? offer?.quantity ?? 0) || 0;

  const attrMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(attributes)) {
    const arr = Array.isArray(v) ? v : [v];
    const first = (arr[0] as any)?.value;
    if (first !== undefined && first !== null) attrMap[k] = String(first);
  }

  return {
    id: String(asin),
    sku: String(item.sku ?? asin),
    name: title,
    description: attributes.product_description?.[0]?.value ?? '',
    price,
    currency,
    stock,
    category: String(category),
    barcode: asin,
    brand: brand ? String(brand) : undefined,
    images: images.slice(0, 8),
    attributes: attrMap,
  };
}
