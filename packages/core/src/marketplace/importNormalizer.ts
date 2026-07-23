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

function resolveValue(source: any, keys: string[]) {
  for (const key of keys) {
    let current: any = source;
    const parts = key.split('.');
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

function getVariantPayload(raw: MarketplaceRawProduct) {
  if (!Array.isArray(raw?.variants) || raw.variants.length === 0) {
    return { root: raw, variant: null };
  }

  return { root: raw, variant: raw.variants.find((item: any) => item != null) ?? null };
}

function resolveCategory(raw: MarketplaceRawProduct) {
  const { root, variant } = getVariantPayload(raw);
  
  // Handle category name - check for nested object or direct value
  let categoryName: string | undefined;
  const rootCategory = resolveValue(root, ['category']);
  const variantCategory = resolveValue(variant, ['category']);
  
  if (rootCategory && typeof rootCategory === 'object' && rootCategory !== null) {
    categoryName = String(rootCategory.name ?? rootCategory.categoryName ?? '');
  } else {
    categoryName = resolveValue(root, ['categoryName', 'category.name', 'pimCategoryName', 'category.title']) ?? 
                   resolveValue(variant, ['categoryName', 'category.name', 'pimCategoryName', 'category.title']);
  }
  
  // Handle category ID - check for nested object or direct value
  let categoryId: string | number | undefined;
  const rootCategoryId = resolveValue(root, ['categoryId']);
  const variantCategoryId = resolveValue(variant, ['categoryId']);
  
  if (rootCategoryId && typeof rootCategoryId === 'object' && rootCategoryId !== null) {
    categoryId = rootCategoryId.id ?? rootCategoryId.categoryId;
  } else {
    categoryId = resolveValue(root, ['categoryId', 'category.id', 'pimCategoryId']) ?? 
                 resolveValue(variant, ['categoryId', 'category.id', 'pimCategoryId']);
  }
  
  return { categoryName: categoryName ?? undefined, categoryId: categoryId ?? undefined };
}

function resolvePrice(raw: MarketplaceRawProduct): { priceTRY?: number; priceUSD?: number } {
  const { root, variant } = getVariantPayload(raw);
  const directCurrency = resolveValue(root, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? resolveValue(variant, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? null;
  const salePrice = resolveValue(root, ['salePrice', 'listPrice', 'price.salePrice', 'price.listPrice', 'price.amount', 'price.value', 'price.price', 'price', 'sellingPrice'])
    ?? resolveValue(variant, ['salePrice', 'listPrice', 'price.salePrice', 'price.listPrice', 'price.amount', 'price.value', 'price.price', 'price', 'sellingPrice'])
    ?? null;
  const resolvedPrice = Number(salePrice ?? 0);

  if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
    return {};
  }

  const currency = String(directCurrency || '').toUpperCase();
  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') {
    return { priceUSD: resolvedPrice };
  }

  return { priceTRY: resolvedPrice };
}

function resolveQuantity(raw: MarketplaceRawProduct): number {
  const { root, variant } = getVariantPayload(raw);
  const candidates = [
    resolveValue(root, ['quantity', 'stock', 'stockAmount', 'stockQuantity', 'availableStock', 'fulfillmentAvailability.availability.availableQuantity', 'inventory.available', 'productStock', 'stock.quantity', 'inventory']),
    resolveValue(variant, ['quantity', 'stock', 'stockAmount', 'stockQuantity', 'availableStock', 'fulfillmentAvailability.availability.availableQuantity', 'inventory.available', 'productStock', 'stock.quantity', 'inventory']),
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
  const { root, variant } = getVariantPayload(raw);
  const title = resolveValue(root, ['title', 'name', 'productName', 'label']) || resolveValue(variant, ['title', 'name', 'productName', 'label']) || 'Imported Product';
  const sku = resolveValue(root, ['barcode', 'stockCode', 'merchantSku', 'sku', 'productCode', 'asin', 'sellerSKU', 'id', 'productSellerCode', 'sellerSKU'])
    || resolveValue(variant, ['barcode', 'stockCode', 'merchantSku', 'sku', 'productCode', 'asin', 'sellerSKU', 'id', 'productSellerCode', 'sellerSKU'])
    || `imp-${Date.now()}`;
  const description = resolveValue(root, ['description', 'itemDescription', 'shortDescription', 'summary', 'content', 'detail']) || resolveValue(variant, ['description', 'itemDescription', 'shortDescription', 'summary', 'content', 'detail']) || '';
  const quantity = resolveQuantity(raw);
  const images = normalizeImages((Array.isArray(root?.images) || Array.isArray(root?.imageUrls) || Array.isArray(root?.image)) ? root.images ?? root.imageUrls ?? root.image : variant?.images ?? variant?.imageUrls ?? variant?.image);
  const statusValue = resolveValue(root, ['status', 'isActive', 'onSale', 'saleStatus', 'isAvailable', 'approvalStatus', 'productStatus', 'productStatusName']) ?? resolveValue(variant, ['status', 'isActive', 'onSale', 'saleStatus', 'isAvailable', 'approvalStatus', 'productStatus', 'productStatusName']);
  const normalizedStatus = typeof statusValue === 'boolean'
    ? statusValue
    : typeof statusValue === 'number'
      ? statusValue > 0
      : typeof statusValue === 'string'
        ? !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval'].includes(statusValue.toLowerCase())
        : false;

  const { categoryName, categoryId } = resolveCategory(raw);
  const marketplaceConfig = {
    [mp]: {
      brand: resolveValue(root, ['brand.name', 'brand', 'brandName', 'manufacturer', 'brandName', 'sellerBrand']) ?? resolveValue(variant, ['brand.name', 'brand', 'brandName', 'manufacturer', 'brandName', 'sellerBrand']) ?? null,
      stock: quantity,
      currency: resolveValue(root, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? resolveValue(variant, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? 'TRY',
      status: statusValue ?? null,
      category: categoryName ?? null,
      category_id: categoryId ?? null,
      externalId: sku || null,
      raw,
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
    categoryId: typeof categoryId === 'number' ? categoryId : undefined,
    ...resolvePrice(raw),
  };
}
