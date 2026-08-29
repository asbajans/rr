export interface ProductData {
  id?: number;
  title: string;
  sku: string;
  barcode?: string;
  description?: string;
  priceTRY?: number;
  priceUSD?: number;
  quantity?: number;
  images?: string[];
  categoryId?: number;
  marketplaceConfig?: Record<string, any>;
}

export interface MarketplaceEntry {
  category_id?: number;
  categoryId?: number;
  brand?: string;
  brandId?: number;
  attributes?: any[];
  [key: string]: any;
}

export function getMarketplaceEntry(product: any, mp: string): MarketplaceEntry {
  return product?.marketplaceConfig?.[mp] || {};
}

/**
 * When the product is marked as not-for-sale in Rahatio (isActive=false) or for a
 * specific marketplace (entry.on_sale=false / entry.status=0) we must reflect that
 * on the marketplace. Most marketplaces have no "deactivate listing" endpoint, so
 * the reliable cross-platform signal is stock = 0 (out of stock → not purchasable).
 * N11 additionally gets `status: 'Suspended'`; Etsy gets `is_active:false`.
 */
export function isProductOnSale(product: any): boolean {
  return product?.isActive !== false;
}

export function isMarketplaceOnSale(product: any, entry: MarketplaceEntry): boolean {
  if (!isProductOnSale(product)) return false;
  if (entry?.on_sale === false || entry?.on_sale === 0) return false;
  if (entry?.status === 0 || entry?.status === false || entry?.status === '0' || entry?.status === 'passive') return false;
  return true;
}

export function marketplaceQuantity(product: any, entry?: MarketplaceEntry): number {
  const onSale = entry ? isMarketplaceOnSale(product, entry) : isProductOnSale(product);
  return onSale ? Number(product.quantity ?? 0) : 0;
}

export function mapProductForTrendyol(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'trendyol');
  const intConfig = integration?.config || {};
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? { url: u } : u) : [];
  const onSale = isMarketplaceOnSale(product, entry);

  const attrs = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => {
    // V2 format: multi-value arrays (attributeValueIds) + custom text (customAttributeValue).
    // Accept legacy singular input (attributeValueId) from older UIs / imports.
    const customVal = a.customValue || a.customAttributeValue;
    if (customVal) {
      return { attributeId: a.attributeId, customAttributeValue: customVal };
    }
    const vids = Array.isArray(a.attributeValueIds)
      ? a.attributeValueIds
      : a.attributeValueId != null
        ? [a.attributeValueId]
        : a.attributeValue != null
          ? [a.attributeValue]
          : [];
    const numeric = vids.map((v: any) => Number(v)).filter((n: number) => !isNaN(n));
    if (a.attributeId && numeric.length > 0) {
      return { attributeId: a.attributeId, attributeValueIds: numeric };
    }
    return null;
  }).filter(Boolean) : [];

  const rawCategoryId = entry.categoryId || entry.category_id;
  const rawBrandId = entry.brandId || entry.brand_id;

  if (!rawCategoryId) return { _skip: true, reason: 'Trendyol kategorisi atanmamış' };
  if (!rawBrandId) return { _skip: true, reason: 'Trendyol marka ID atanmamış' };

  const numericBrandId = Number(rawBrandId);
  const brandId = !isNaN(numericBrandId) && numericBrandId > 0 ? numericBrandId : rawBrandId;
  const categoryId = Number(rawCategoryId);
  if (!categoryId) return { _skip: true, reason: 'Trendyol kategori ID geçersiz' };

  const shipmentAddressId = Number(entry.shipmentAddressId || intConfig.shipmentAddressId || 0);
  const returningAddressId = Number(entry.returnAddressId || entry.returningAddressId || intConfig.returnAddressId || intConfig.returningAddressId || 0);

  // Trendyol V2 accepts only these VAT rates; an invalid value returns
  // ClientApiBusinessException bad.request on create/update.
  const validVats = [0, 1, 8, 10, 18, 20];
  const vatRate = validVats.includes(Number(entry.vatRate ?? intConfig.vatRate ?? 10))
    ? Number(entry.vatRate ?? intConfig.vatRate ?? 10)
    : 10;

  const result: Record<string, any> = {
    barcode: product.sku || '',
    title: product.title,
    productMainId: product.sku,
    brandId,
    categoryId,
    quantity: onSale ? Number(product.quantity ?? 0) : 0,
    stockCode: product.sku,
    dimensionalWeight: Number(entry.dimensionalWeight || intConfig.dimensionalWeight || 1),
    description: product.description || '',
    currencyType: 'TRY',
    listPrice: Number(price),
    salePrice: Number(price),
    vatRate,
    images,
    attributes: attrs,
  };

  if (shipmentAddressId) result.shipmentAddressId = shipmentAddressId;
  if (returningAddressId) result.returningAddressId = returningAddressId;

  return result;
}

export function mapProductForN11(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'n11');
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => {
    const url = typeof u === 'string' ? u : (u.url || u);
    if (!url) return null;
    return { url: url.replace(/^http:\/\//i, 'https://'), order: 0 };
  }).filter((i: any) => i?.url) : [];
  const onSale = isMarketplaceOnSale(product, entry);

  const attrs: any[] = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => ({
    id: Number(a.id || a.attributeId),
    valueId: a.valueId || a.attributeValueId || null,
    customValue: a.customValue || null,
  })).filter((a: any) => a.id) : [];

  const brandName = entry.brand || '';
  const hasBrandAttr = attrs.some((a: any) => a.id === 1);
  if (brandName && !hasBrandAttr) {
    attrs.push({ id: 1, valueId: null, customValue: brandName });
  }

  const categoryId = entry.categoryId || entry.category_id;
  if (!categoryId) return { _skip: true, reason: 'N11 category not mapped' };

  // N11 rejects the create task if shipmentTemplate is not a real template name
  // that exists in the seller's "Hesabım > Teslimat Bilgileri".
  const shipmentTemplate = String(entry.shipmentTemplate ?? '').trim();
  if (!shipmentTemplate) {
    return { _skip: true, reason: 'N11 kargo şablonu (shipmentTemplate) atanmamış — ürün düzenlemeden seçin' };
  }

  const validVat = [0, 1, 10, 20];
  const vatRate = validVat.includes(Number(entry.vatRate ?? 10)) ? Number(entry.vatRate ?? 10) : 10;

  return {
    title: product.title,
    description: product.description || '',
    categoryId: Number(categoryId),
    currencyType: 'TL',
    productMainId: product.sku,
    preparingDay: Number(entry.preparingDay ?? 3),
    shipmentTemplate,
    stockCode: product.sku,
    quantity: onSale ? Number(product.quantity ?? 0) : 0,
    images,
    attributes: attrs,
    salePrice: Number(price),
    listPrice: Number(price),
    vatRate,
    maxPurchaseQuantity: entry.maxPurchaseQuantity ?? 5,
    status: onSale ? 'Active' : 'Suspended',
  };
}

export function mapProductForHepsiburada(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'hepsiburada');
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? u : (u.url || u)).filter(Boolean) : [];

  const attrs = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => ({
    attributeId: a.attributeId,
    valueId: a.valueId || a.attributeValueId,
  })) : [];
  const onSale = isMarketplaceOnSale(product, entry);

  return {
    merchantSku: product.sku,
    name: product.title,
    description: product.description || '',
    categoryId: Number(entry.categoryId || entry.category_id || 0),
    brandId: Number(entry.brandId || entry.brand_id || 0),
    attributes: attrs,
    images,
    listPrice: Number(price),
    salePrice: Number(price),
    quantity: onSale ? Number(product.quantity ?? 0) : 0,
    cargoCompanyId: Number(entry.cargoCompanyId || 0),
    dispatchDuration: Number(entry.dispatchDuration ?? 3),
    vatRate: Number(entry.vatRate ?? 10),
  };
}

export function mapProductForPazarama(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'pazarama');
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => {
    const url = typeof u === 'string' ? u : (u.url || u);
    if (!url) return null;
    return { imageurl: url.replace(/^http:\/\//i, 'https://') };
  }).filter((i: any) => i?.imageurl) : [];

  const attrs: any[] = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => ({
    attributeId: a.attributeId || a.id || null,
    attributeValueId: a.attributeValueId || a.valueId || null,
  })).filter((a: any) => a.attributeId) : [];

  const validVat = [0, 1, 10, 20];
  const vatRate = validVat.includes(Number(entry.vatRate ?? 10)) ? Number(entry.vatRate ?? 10) : 10;

  const brandId = entry.brandId || entry.brand_id || '';
  const categoryId = entry.categoryId || entry.category_id || '';
  const onSale = isMarketplaceOnSale(product, entry);

  if (!categoryId) {
    return { _skip: true, reason: 'Pazarama kategorisi atanmamış' };
  }
  if (!brandId) {
    return { _skip: true, reason: 'Pazarama marka ID atanmamış' };
  }

  return {
    Name: product.title,
    DisplayName: product.title,
    Description: product.description || '',
    BrandId: brandId,
    Desi: Number(entry.desi || entry.dimensionalWeight || 1),
    Code: product.sku,
GroupCode: entry.groupCode || product.mainSku || product.sku,
    StockCount: onSale ? Number(product.StockCount || product.stockCount || product.quantity || 0) : 0,
    VatRate: vatRate,
    ListPrice: Number(price),
    SalePrice: Number(price),
    CategoryId: categoryId,
    images,
    attributes: attrs,
    };
}

export function mapProductForAmazon(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'amazon');
  const price = product.priceUSD ?? product.priceTRY ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? u : (u.url || u)).filter(Boolean) : [];

  const onSale = isMarketplaceOnSale(product, entry);

  return {
    sellerSKU: product.sku,
    title: product.title,
    description: product.description || '',
    categoryId: Number(entry.categoryId || entry.category_id || 0),
brand: entry.brand || '',
    images,
    listPrice: Number(price),
    salePrice: Number(price),
    quantity: onSale ? Number(product.quantity ?? 0) : 0,
    attributes: entry.attributes || [],
    };
}

export function mapProductForEtsy(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'etsy');
  const price = product.priceUSD ?? product.priceTRY ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? u : (u.url || u)).filter(Boolean) : [];

  return {
    title: product.title,
    description: product.description || '',
    price: Number(price),
    quantity: marketplaceQuantity(product),
    tags: product.tags || entry.tags || [],
    images,
    categoryId: Number(entry.categoryId || entry.category_id || 0),
brand: entry.brand || '',
    whoMade: 'someone_else',
    whenMade: '2020_2024',
    taxonomyId: entry.taxonomyId,
    is_active: isMarketplaceOnSale(product, entry),
    };
}

function firstImageUrl(product: any): string {
  const images = Array.isArray(product.images) ? product.images : [];
  const raw = images.map((u: any) => (typeof u === 'string' ? u : (u?.url || u))).find(Boolean) || '';
  if (!raw) return '';
  if (String(raw).startsWith('//')) return `https:${raw}`;
  if (String(raw).startsWith('http://')) return `https://${String(raw).slice(7)}`;
  return String(raw);
}

function withTracking(base: string, source: string, pid: string | number): string {
  try {
    const url = new URL(base);
    url.searchParams.set('utm_source', source);
    url.searchParams.set('utm_medium', source === 'facebook_catalog' ? 'catalog' : 'social');
    url.searchParams.set('rh_src', source);
    if (pid) url.searchParams.set('rh_pid', String(pid));
    return url.toString();
  } catch { return base; }
}

export function mapProductForFacebook(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'facebook');
  const igEntry = getMarketplaceEntry(product, 'instagram');
  const brand = entry.brand || igEntry.brand || product.brand || '';
  const qty = marketplaceQuantity(product, entry);
  const image = firstImageUrl(product);
  const extra = (Array.isArray(product.images) ? product.images : [])
    .map((u: any) => (typeof u === 'string' ? u : u?.url))
    .filter(Boolean)
    .slice(1, 10);
  const cfg = integration?.config || {};
  const rawUrl = product.storefrontUrl || entry.url || (cfg.storefrontBase && product.id ? `${String(cfg.storefrontBase).replace(/\/$/, '')}/products/${product.id}` : '');
  // Catalog clicks go to site — add tracking so checkout attribution knows it came from FB catalog
  const url = rawUrl ? withTracking(rawUrl, 'facebook_catalog', product.id) : '';
  const price = Number(product.priceTRY ?? product.priceUSD ?? 0);

  if (!cfg.catalogId) return { _skip: true, reason: 'Meta katalog seçilmedi' };
  if (!image) return { _skip: true, reason: 'Meta katalog için HTTPS görsel yok' };
  if (!url) return { _skip: true, reason: 'Meta katalog için ürün URL yok' };

  return {
    retailer_id: product.sku,
    name: product.title,
    description: product.description || product.title,
    availability: qty > 0 ? 'in stock' : 'out of stock',
    condition: 'new',
    price: `${price.toFixed(2)} TRY`,
    currency: 'TRY',
    url,
    image_url: image,
    additional_image_urls: extra,
    brand,
    quantity: qty,
    inventory: qty,
    salePrice: price,
    item_group_id: product.sku ? String(product.sku).split('-')[0] : undefined,
  };
}

export function mapProductForInstagram(product: any, integration: any): Record<string, any> {
  const mapped = mapProductForFacebook(product, integration);
  if ((mapped as any)._skip) {
    const reason = String((mapped as any).reason || '').replace('Meta katalog', 'Instagram Shop katalog');
    return { _skip: true, reason };
  }
  return mapped;
}

export function mapProductForMarketplace(mp: string, product: any, integration: any): Record<string, any> {
  switch (mp) {
    case 'trendyol': return mapProductForTrendyol(product, integration);
    case 'n11': return mapProductForN11(product, integration);
    case 'hepsiburada': return mapProductForHepsiburada(product, integration);
    case 'pazarama': return mapProductForPazarama(product, integration);
    case 'amazon': return mapProductForAmazon(product, integration);
    case 'etsy': return mapProductForEtsy(product, integration);
    case 'facebook': return mapProductForFacebook(product, integration);
    case 'instagram': return mapProductForInstagram(product, integration);
    default: return { title: product.title, salePrice: product.priceTRY ?? product.priceUSD ?? 0 };
  }
}