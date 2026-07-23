type MarketplaceRawProduct = Record<string, any>;

function normalizeImages(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => (typeof item === 'string' ? item : item?.url || item?.url_fullxfull || item?.url_570xN || item?.imageUrl || item?.src || ''))
      .filter(Boolean);
  }

  if (Array.isArray(raw?.images)) {
    return raw.images
      .map((item: any) => (typeof item === 'string' ? item : item?.url || item?.url_fullxfull || item?.url_570xN || item?.imageUrl || item?.src || ''))
      .filter(Boolean);
  }

  if (typeof raw === 'string') {
    return [raw];
  }

  return [];
}

function resolvePrice(raw: MarketplaceRawProduct): { priceTRY?: number; priceUSD?: number } {
  const directCurrency = raw.currency ?? raw.currencyType ?? raw.price?.currency ?? raw.price?.currencyType ?? null;
  const salePrice = raw.salePrice ?? raw.listPrice ?? raw.price?.salePrice ?? raw.price?.listPrice ?? raw.price?.amount ?? raw.price ?? null;
  const resolvedPrice = Number(salePrice ?? 0);

  if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
    return {};
  }

  const currency = String(directCurrency || '').toUpperCase();
  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') {
    return { priceUSD: resolvedPrice };
  }

  if (currency === 'TRY') {
    return { priceTRY: resolvedPrice };
  }

  return { priceTRY: resolvedPrice };
}

function resolveQuantity(raw: MarketplaceRawProduct): number {
  const candidates = [
    raw.quantity,
    raw.stock,
    raw.stockAmount,
    raw.stockQuantity,
    raw.availableStock,
    raw.fulfillmentAvailability?.availability?.availableQuantity,
    raw.inventory?.available,
    raw.productStock,
    raw.stock?.quantity,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

export function normalizeMarketplaceProduct(mp: string, raw: MarketplaceRawProduct, storeId: number) {
  const title = raw.title || raw.name || raw.productName || raw.label || 'Imported Product';
  const sku = raw.barcode || raw.stockCode || raw.merchantSku || raw.sku || raw.productCode || raw.asin || raw.sellerSKU || raw.id || `imp-${Date.now()}`;
  const description = raw.description || raw.itemDescription || raw.shortDescription || raw.summary || '';
  const quantity = resolveQuantity(raw);
  const images = normalizeImages(raw.images ?? raw.imageUrls ?? raw.imageUrl ?? raw.image);
  const statusValue = raw.status ?? raw.isActive ?? raw.onSale ?? raw.saleStatus ?? raw.isAvailable ?? null;
  const normalizedStatus = typeof statusValue === 'boolean'
    ? statusValue
    : typeof statusValue === 'number'
      ? statusValue > 0
      : typeof statusValue === 'string'
        ? !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'unavailable'].includes(statusValue.toLowerCase())
        : true;

  const marketplaceConfig = {
    [mp]: {
      brand: raw.brand?.name ?? raw.brand ?? raw.brandName ?? raw.manufacturer ?? null,
      stock: quantity,
      currency: raw.currency ?? raw.currencyType ?? raw.price?.currency ?? raw.price?.currencyType ?? 'TRY',
      status: raw.status ?? raw.saleStatus ?? raw.approvalStatus ?? null,
      externalId: raw.barcode || raw.stockCode || raw.sku || raw.id || null,
      raw: raw,
    },
  };

  return {
    storeId,
    title,
    sku,
    slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 190)}-${Date.now()}`,
    description,
    quantity,
    images,
    isActive: normalizedStatus,
    marketplaceConfig,
    marketplaces: [mp],
    ...resolvePrice(raw),
  };
}
