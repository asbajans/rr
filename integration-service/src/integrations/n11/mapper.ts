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

function readValue(source: any, paths: string[]) {
  for (const path of paths) {
    let current: any = source;
    const parts = path.split('.');
    let found = true;
    for (const part of parts) {
      if (current == null || typeof current !== 'object' || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }
    if (found && current !== undefined && current !== null && current !== '') {
      return current;
    }
  }
  return undefined;
}

/** Map an N11 GetProductQuery content item -> normalized ProductData. */
export function mapToN11Product(p: any): ProductData {
  const images: string[] = Array.isArray(readValue(p, ['imageUrls', 'images', 'imageUrl'])) ? (readValue(p, ['imageUrls', 'images', 'imageUrl']) as any[]).filter((u: any) => !!u) : [];

  const attributes: Record<string, string> = {};
  const attrs = Array.isArray(p.attributes) ? p.attributes : [];
  let brand: string | undefined;
  for (const a of attrs) {
    const name = a?.attributeName ?? a?.name ?? a?.key;
    const value = a?.attributeValue ?? a?.value ?? a?.customValue;
    if (name) {
      attributes[name] = String(value ?? '');
      if (String(name).toLowerCase() === 'marka') brand = String(value ?? '');
    }
  }

  const alternativeBrand = readValue(p, ['brand', 'brandName', 'brand.name', 'manufacturer', 'sellerBrand']);
  if (!brand && alternativeBrand) {
    brand = String(alternativeBrand);
  }

  const categoryId = readValue(p, ['categoryId', 'category.id', 'categoryId.value', 'pimCategoryId']);
  const sku = String(readValue(p, ['stockCode', 'productSellerCode', 'n11ProductId', 'sku', 'code']) ?? '');
  const price = Number(readValue(p, ['salePrice', 'listPrice', 'price', 'unitPrice', 'sellingPrice']) ?? 0);
  const stock = Number(readValue(p, ['quantity', 'stock', 'availableStock', 'stockQuantity', 'inventory']) ?? 0);

  return {
    id: String(readValue(p, ['n11ProductId', 'stockCode', 'id']) ?? ''),
    sku,
    name: String(readValue(p, ['title', 'name', 'productName', 'label']) ?? ''),
    description: String(readValue(p, ['description', 'content', 'detail']) ?? ''),
    price,
    currency: (String(readValue(p, ['currencyType', 'currency']) ?? 'TL')).toUpperCase() === 'TL' ? 'TRY' : (String(readValue(p, ['currencyType', 'currency']) ?? 'TL')).toUpperCase(),
    stock,
    category: String(categoryId ?? ''),
    category_id: categoryId != null ? String(categoryId) : undefined,
    barcode: String(readValue(p, ['barcode', 'gtin']) ?? undefined),
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
