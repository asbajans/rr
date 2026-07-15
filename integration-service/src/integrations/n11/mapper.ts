import { ProductData } from '../../types';

/** N11 accepts only its own currency enum; TRY must be mapped to TL. */
function normalizeN11Currency(code?: string): string {
  const c = (code || 'TRY').toUpperCase();
  const map: Record<string, string> = {
    TRY: 'TL',
    TL: 'TL',
    EUR: 'EUR',
    USD: 'USD',
    GBP: 'GBP',
  };
  return map[c] ?? 'TL';
}

/** Map an N11 GetProductQuery content item -> normalized ProductData. */
export function mapToN11Product(p: any): ProductData {
  const images: string[] = Array.isArray(p.imageUrls) ? p.imageUrls.filter((u: any) => !!u) : [];

  const attributes: Record<string, string> = {};
  const attrs = Array.isArray(p.attributes) ? p.attributes : [];
  let brand: string | undefined;
  for (const a of attrs) {
    const name = a?.attributeName ?? a?.name;
    const value = a?.attributeValue ?? a?.value;
    if (name) {
      attributes[name] = String(value ?? '');
      if (String(name).toLowerCase() === 'marka') brand = String(value ?? '');
    }
  }

  const categoryId = p.categoryId ?? p.category?.id;
  const sku = String(p.stockCode ?? p.productSellerCode ?? p.n11ProductId ?? '');

  return {
    id: String(p.n11ProductId ?? p.stockCode ?? ''),
    sku,
    name: p.title ?? '',
    description: p.description ?? '',
    price: Number(p.salePrice ?? p.listPrice ?? 0),
    currency: (p.currencyType ?? 'TL').toString().toUpperCase() === 'TL' ? 'TRY' : (p.currencyType ?? 'TL').toString().toUpperCase(),
    stock: Number(p.quantity ?? 0),
    category: String(categoryId ?? ''),
    category_id: categoryId != null ? String(categoryId) : undefined,
    barcode: p.barcode ?? undefined,
    brand,
    images: images.slice(0, 8),
    attributes,
  };
}

/** Map normalized ProductData -> N11 CreateProduct payload. */
export function mapToN11CreatePayload(data: ProductData, integrator: string, shipmentTemplate?: string): any {
  const attributes: any[] = [];
  if (data.brand) {
    // N11 "Marka" attribute id is conventionally 1; sent as free customValue.
    attributes.push({ id: 1, valueId: null, customValue: data.brand });
  }

  const sku = data.sku || `${data.id}`;
  const price = Number(data.price || 0);

  return {
    payload: {
      integrator,
      skus: [
        {
          title: data.name,
          description: data.description,
          categoryId: Number(data.category_id || 0),
          currencyType: normalizeN11Currency(data.currency),
          productMainId: sku,
          preparingDay: 3,
          shipmentTemplate: shipmentTemplate || '',
          maxPurchaseQuantity: 5,
          stockCode: sku,
          catalogId: null,
          barcode: data.barcode ?? null,
          quantity: Number(data.stock || 0),
          images: (data.images || []).slice(0, 8).map((url, i) => ({ url, order: i })),
          attributes: attributes.length ? attributes : [],
          salePrice: price,
          listPrice: price,
          vatRate: 10,
        },
      ],
    },
  };
}

/** Map a stock/price update -> N11 price-stock-update payload. */
export function mapToN11PriceStockPayload(
  sku: string,
  update: { quantity?: number; price?: number; currency?: string }
): any {
  const skuEntry: any = { stockCode: sku };
  if (typeof update.quantity === 'number') skuEntry.quantity = update.quantity;
  if (typeof update.price === 'number') {
    skuEntry.salePrice = update.price;
    skuEntry.listPrice = update.price;
      skuEntry.currencyType = normalizeN11Currency(update.currency);
  }

  return {
    payload: {
      integrator: 'Rahatio',
      skus: [skuEntry],
    },
  };
}
