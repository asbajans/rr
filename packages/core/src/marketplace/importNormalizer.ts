type MarketplaceRawProduct = Record<string, any>;

function normalizeImages(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => (typeof item === 'string' ? item : item?.url || item?.imageUrl || item?.imageurl || item?.url_fullxfull || item?.url_570xN || item?.src || ''))
      .filter(Boolean);
  }

  if (raw?.Images && Array.isArray(raw.Images) && !raw?.images) {
    const arr = raw.Images;
    return arr
      .map((item: any) => (typeof item === 'string' ? item : item?.url || item?.imageUrl || item?.imageurl || item?.url_fullxfull || item?.url_570xN || item?.src || ''))
      .filter(Boolean);
  }

  if (Array.isArray(raw?.images)) {
    return raw.images
      .map((item: any) => (typeof item === 'string' ? item : item?.url || item?.imageUrl || item?.imageurl || item?.url_fullxfull || item?.url_570xN || item?.src || ''))
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
  const salePrice = resolveValue(root, ['salePrice', 'listPrice', 'price.salePrice', 'price.listPrice', 'price.amount', 'price.value', 'price.price', 'price', 'sellingPrice', 'SalePrice', 'ListPrice', 'DiscountedPrice', 'Price'])
    ?? resolveValue(variant, ['salePrice', 'listPrice', 'price.salePrice', 'price.listPrice', 'price.amount', 'price.value', 'price.price', 'price', 'sellingPrice', 'SalePrice', 'ListPrice', 'DiscountedPrice', 'Price'])
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
  // NOTE: specific nested paths (stock.quantity, inventory.available) MUST come
  // before their generic parents (stock, inventory) — otherwise `resolveValue`
  // returns the whole object `{ quantity: 42 }` and `Number(object)` is NaN,
  // so the quantity incorrectly falls through to 0. This was the Trendyol V2 bug
  // where every imported product had stock 0 even though `variants[].stock.quantity`
  // was present (src/queues → inventory-and-price flatten was correct, but
  // normalizer still returned 0).
  const quantityKeys = ['quantity', 'stock.quantity', 'stockAmount', 'stockQuantity', 'stockCount', 'availableStock', 'fulfillmentAvailability.availability.availableQuantity', 'inventory.available', 'productStock', 'stock', 'inventory', 'stockCount', 'StockCount'];
  const candidates = [
    resolveValue(root, quantityKeys),
    resolveValue(variant, quantityKeys),
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
  const sku = resolveValue(root, ['barcode', 'stockCode', 'merchantSku', 'sku', 'productCode', 'asin', 'sellerSKU', 'id', 'productSellerCode', 'sellerSKU', 'code'])
    || resolveValue(variant, ['barcode', 'stockCode', 'merchantSku', 'sku', 'productCode', 'asin', 'sellerSKU', 'id', 'productSellerCode', 'sellerSKU', 'code'])
    || `imp-${Date.now()}`;
  const description = resolveValue(root, ['description', 'itemDescription', 'shortDescription', 'summary', 'content', 'detail']) || resolveValue(variant, ['description', 'itemDescription', 'shortDescription', 'summary', 'content', 'detail']) || '';
  const quantity = resolveQuantity(raw);
  const imageCandidate = (obj: any) =>
    obj?.images ?? obj?.imageUrls ?? obj?.imageUrl ?? obj?.image ?? obj?.Images ?? obj?.productImages ?? obj?.mainImage ?? obj?.imageList;
  const rootImgs = imageCandidate(root);
  const variantImgs = imageCandidate(variant);
  const images = normalizeImages(
    Array.isArray(rootImgs) ? rootImgs
      : Array.isArray(variantImgs) ? variantImgs
      : typeof rootImgs === 'string' ? rootImgs
      : typeof variantImgs === 'string' ? variantImgs
      : undefined
  );
  // ── Status resolution — per-marketplace aware ──────────────────────────
  // Each marketplace uses different fields for “on sale / active” signal:
  //  Trendyol: onSale (bool), saleStatus/approvalStatus, status string
  //  Hepsiburada: isSalable (bool), isSuspended/isLocked/isFrozen (bool true=>off), availableStock-related
  //  Pazarama: Approved (bool), isActive/status
  //  N11: saleStatus (On_Sale/Out_Of_Stock/Sale_Closed/Before_Sale), productStatus (Active/...), status (Active)
  //  Etsy: state (active/draft/expired/sold_out/inactive), isActive
  //  Amazon: state/status or quantity-based
  let statusValue: any = resolveValue(root, ['status', 'isActive', 'onSale', 'saleStatus', 'isAvailable', 'approvalStatus', 'productStatus', 'productStatusName', 'state', 'Approved', 'approved', 'isSalable', 'isSuspended', 'isLocked', 'isFrozen', 'availability', 'sale_status', 'product_status'])
    ?? resolveValue(variant, ['status', 'isActive', 'onSale', 'saleStatus', 'isAvailable', 'approvalStatus', 'productStatus', 'productStatusName', 'state', 'Approved', 'approved', 'isSalable', 'isSuspended', 'isLocked', 'isFrozen', 'availability', 'sale_status', 'product_status']);

  // Per-marketplace overrides for combined boolean flags (Hepsiburada) and
  // marketplace-specific string enums (N11, Etsy, Pazarama).
  let normalizedStatus: boolean;
  if (mp === 'hepsiburada') {
    const isSalable = resolveValue(root, ['isSalable']) ?? resolveValue(variant, ['isSalable']);
    const isSuspended = resolveValue(root, ['isSuspended']) ?? resolveValue(variant, ['isSuspended']);
    const isLocked = resolveValue(root, ['isLocked']) ?? resolveValue(variant, ['isLocked']);
    const isFrozen = resolveValue(root, ['isFrozen']) ?? resolveValue(variant, ['isFrozen']);
    if (isSalable === false) normalizedStatus = false;
    else if (isSuspended === true || isLocked === true || isFrozen === true) normalizedStatus = false;
    else if (typeof isSalable === 'boolean') normalizedStatus = isSalable;
    else if (statusValue == null) normalizedStatus = true;
    else if (typeof statusValue === 'boolean') normalizedStatus = statusValue;
    else if (typeof statusValue === 'number') normalizedStatus = statusValue > 0;
    else if (typeof statusValue === 'string') {
      const s = statusValue.toLowerCase();
      normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'suspended', 'locked', 'frozen', 'expired', 'draft', 'sold_out', 'soldout', 'out_of_stock', 'outofstock', 'sale_closed', 'saleclosed', 'before_sale', 'beforesale', 'prohibited', 'unlisted', 'inapproval', 'incatalogapproval', 'catalogrejected', 'archived', 'blacklisted'].includes(s);
    } else normalizedStatus = true;
  } else if (mp === 'n11') {
    const saleStatusRaw = resolveValue(root, ['saleStatus', 'sale_status']) ?? resolveValue(variant, ['saleStatus', 'sale_status']);
    const productStatusRaw = resolveValue(root, ['productStatus', 'product_status', 'status']) ?? resolveValue(variant, ['productStatus', 'product_status', 'status']);
    const saleStatus = saleStatusRaw != null ? String(saleStatusRaw).toLowerCase() : null;
    const productStatus = productStatusRaw != null ? String(productStatusRaw).toLowerCase() : null;
    // For N11 both signals must be “on sale”: productStatus Active AND saleStatus On_Sale.
    // If either indicates not saleable, the product is not active.
    if (saleStatus && productStatus) {
      const saleOk = saleStatus === 'on_sale' || saleStatus === 'onsale';
      const productOk = ['active', 'onsale', 'approved', 'on_sale'].includes(productStatus);
      normalizedStatus = saleOk && productOk;
    } else if (saleStatus) {
      if (saleStatus === 'on_sale' || saleStatus === 'onsale') normalizedStatus = true;
      else if (['out_of_stock', 'outofstock', 'sale_closed', 'saleclosed', 'before_sale', 'beforesale'].includes(saleStatus)) normalizedStatus = false;
      else normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'suspended', 'prohibited', 'unlisted', 'inapproval', 'incatalogapproval', 'catalogrejected', 'archived', 'blacklisted', 'draft', 'expired', 'sold_out'].includes(saleStatus);
    } else if (productStatus) {
      normalizedStatus = ['active', 'onsale', 'approved', 'on_sale'].includes(productStatus);
    } else if (statusValue == null) normalizedStatus = true;
    else if (typeof statusValue === 'boolean') normalizedStatus = statusValue;
    else if (typeof statusValue === 'number') normalizedStatus = statusValue > 0;
    else if (typeof statusValue === 'string') normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'suspended', 'locked', 'frozen', 'expired', 'draft', 'sold_out', 'out_of_stock', 'sale_closed', 'before_sale', 'prohibited', 'unlisted', 'inapproval', 'incatalogapproval', 'catalogrejected', 'archived', 'blacklisted'].includes(statusValue.toLowerCase());
    else normalizedStatus = true;
  } else if (mp === 'etsy') {
    const stateRaw = resolveValue(root, ['state']) ?? resolveValue(variant, ['state']);
    const state = stateRaw != null ? String(stateRaw).toLowerCase() : null;
    if (state) {
      normalizedStatus = state === 'active';
    } else if (statusValue == null) normalizedStatus = true;
    else if (typeof statusValue === 'boolean') normalizedStatus = statusValue;
    else if (typeof statusValue === 'string') normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'draft', 'expired', 'sold_out', 'soldout', 'archived', 'blacklisted', 'removed'].includes(statusValue.toLowerCase());
    else normalizedStatus = true;
  } else if (mp === 'pazarama') {
    const approvedRaw = resolveValue(root, ['Approved', 'approved', 'isActive', 'isApproved', 'IsActive']) ?? resolveValue(variant, ['Approved', 'approved', 'isActive', 'isApproved', 'IsActive']);
    // Pazarama: StockCount 0 means “stok yok” → not on sale (user bug report).
    // Also respect explicit sale-closed signals (IsActive false, Status passive etc.)
    const stockIsZero = quantity === 0;
    if (typeof approvedRaw === 'boolean' && approvedRaw === false) normalizedStatus = false;
    else if (stockIsZero) normalizedStatus = false;
    else if (typeof approvedRaw === 'boolean') normalizedStatus = approvedRaw;
    else if (statusValue == null) normalizedStatus = true;
    else if (typeof statusValue === 'boolean') normalizedStatus = statusValue;
    else if (typeof statusValue === 'number') normalizedStatus = statusValue > 0;
    else if (typeof statusValue === 'string') normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'archived', 'blacklisted', 'suspended', 'prohibited', 'out_of_stock', 'outofstock', 'sale_closed', 'saleclosed', 'before_sale', 'beforesale'].includes(statusValue.toLowerCase());
    else normalizedStatus = true;
  } else {
    // Generic (trendyol, amazon, hepsiburada fallback handled above)
    if (statusValue == null) normalizedStatus = true;
    else if (typeof statusValue === 'boolean') normalizedStatus = statusValue;
    else if (typeof statusValue === 'number') normalizedStatus = statusValue > 0;
    else if (typeof statusValue === 'string') normalizedStatus = !['inactive', 'disabled', 'false', '0', 'off', 'pasif', 'passive', 'unavailable', 'notapproved', 'rejected', 'pending', 'waitingforapproval', 'onhold', 'suspended', 'locked', 'frozen', 'expired', 'draft', 'sold_out', 'soldout', 'out_of_stock', 'outofstock', 'sale_closed', 'saleclosed', 'before_sale', 'beforesale', 'prohibited', 'unlisted', 'inapproval', 'incatalogapproval', 'catalogrejected', 'archived', 'blacklisted', 'removed'].includes(statusValue.toLowerCase());
    else normalizedStatus = true;
  }

  const { categoryName, categoryId } = resolveCategory(raw);
  const attributes = Array.isArray(raw.attributes) ? raw.attributes : undefined;
  const marketplaceConfig = {
    [mp]: {
      brand: resolveValue(root, ['brand.name', 'brand', 'brandName', 'manufacturer', 'brandName', 'sellerBrand']) ?? resolveValue(variant, ['brand.name', 'brand', 'brandName', 'manufacturer', 'brandName', 'sellerBrand']) ?? null,
      stock: quantity,
      currency: resolveValue(root, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? resolveValue(variant, ['currency', 'currencyType', 'price.currency', 'price.currencyType']) ?? 'TRY',
      status: statusValue ?? null,
      category: categoryName ?? null,
      category_id: categoryId ?? null,
      externalId: sku || null,
      attributes,
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
