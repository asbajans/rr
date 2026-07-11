import { ProductData } from '../../types';

export function mapToPazaramaProduct(p: any): ProductData {
  const priceItems = Array.isArray(p.priceList) ? p.priceList : [];
  const priceObj = priceItems.find((x: any) => x.type === 'DEFAULT') || priceItems[0] || {};
  const price = Number(priceObj.price ?? priceObj.listPrice ?? p.price ?? 0);

  const images: string[] = [];
  if (Array.isArray(p.images)) {
    for (const img of p.images) {
      const url = typeof img === 'string' ? img : img.url ?? img.path ?? null;
      if (url) images.push(url);
    }
  }

  const stock = Number(p.stock ?? p.quantity ?? p.availableStock ?? 0);

  return {
    id: String(p.id ?? p.code ?? p.productCode ?? ''),
    sku: String(p.code ?? p.productCode ?? p.id ?? ''),
    name: p.title ?? p.name ?? '',
    description: p.description ?? (Array.isArray(p.descriptions) ? p.descriptions[0]?.description ?? '' : ''),
    price,
    currency: (priceObj.currency ?? p.currency ?? 'TRY').toString().toUpperCase(),
    stock,
    category: String(p.categoryName ?? p.categoryId ?? p.category?.name ?? ''),
    barcode: p.barcode ?? p.gtin ?? undefined,
    brand: p.brand ?? p.brandName ?? undefined,
    images: images.slice(0, 8),
    attributes: {},
  };
}
