import { ProductData } from '../../types';

export function mapToN11Product(p: any): ProductData {
  const stockItems = Array.isArray(p.stockItems?.stockItem) ? p.stockItems.stockItem : [];
  const stock = stockItems.reduce(
    (sum: number, s: any) => sum + (Number(s.quantity ?? s.optionQuantity ?? 0) || 0),
    0
  );

  const images: string[] = [];
  const imgList = p.productImageList?.image ?? p.productImageList?.images ?? [];
  const imgArr = Array.isArray(imgList) ? imgList : [imgList];
  for (const img of imgArr) {
    const url = typeof img === 'string' ? img : img.url ?? null;
    if (url) images.push(url);
  }

  const attributes: Record<string, string> = {};
  const attrs = p.attributes?.attribute ?? [];
  const attrArr = Array.isArray(attrs) ? attrs : [attrs];
  for (const a of attrArr) {
    if (a?.name) attributes[a.name] = String(a.value ?? '');
  }

  return {
    id: String(p.id ?? p.productId ?? p.productSellerCode ?? ''),
    sku: String(p.productSellerCode ?? p.productId ?? ''),
    name: p.title ?? '',
    description: p.description ?? '',
    price: Number(p.price ?? 0),
    currency: (p.currencyType ?? 'TRY').toString().toUpperCase(),
    stock,
    category: String(p.category?.name ?? p.category?.categoryId ?? ''),
    barcode: p.barcode ?? p.gtin ?? undefined,
    brand: p.brand ?? p.brandName ?? undefined,
    images: images.slice(0, 8),
    attributes,
  };
}
