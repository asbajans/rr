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

export function mapProductForTrendyol(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'trendyol');
  const intConfig = integration?.config || {};
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? { url: u } : u) : [];

  const attrs = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => {
    if (a.customValue) {
      return { attributeId: a.attributeId, customValue: a.customValue };
    }
    if (a.attributeId && a.attributeValueId) {
      return { attributeId: a.attributeId, attributeValueId: a.attributeValueId };
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

  const cargoCompanyId = Number(entry.cargoCompanyId || intConfig.cargoCompanyId || 0);
  const shipmentAddressId = Number(entry.shipmentAddressId || intConfig.shipmentAddressId || 0);
  const returnAddressId = Number(entry.returnAddressId || intConfig.returnAddressId || 0);

  return {
    barcode: product.sku || '',
    title: product.title,
    productMainId: product.sku,
    brandId,
    categoryId,
    quantity: Number(product.quantity ?? 0),
    stockCode: product.sku,
    dimensionalWeight: Number(entry.dimensionalWeight || intConfig.dimensionalWeight || 1),
    description: product.description || '',
    currencyType: 'TRY',
    listPrice: Number(price),
    salePrice: Number(price),
    vatRate: Number(entry.vatRate ?? intConfig.vatRate ?? 10),
    cargoCompanyId,
    shipmentAddressId,
    returnAddressId,
    images,
    attributes: attrs,
  };
}

export function mapProductForN11(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'n11');
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => {
    const url = typeof u === 'string' ? u : (u.url || u);
    return { url, order: 0 };
  }).filter((i: any) => i.url) : [];

  const attrs: any[] = Array.isArray(entry.attributes) ? entry.attributes.map((a: any) => ({
    id: a.id || a.attributeId,
    valueId: a.valueId || a.attributeValueId,
  })).filter((a: any) => a.id) : [];

  const brandName = entry.brand || '';
  const hasBrandAttr = attrs.some((a: any) => a.id === 1);
  if (brandName && !hasBrandAttr) {
    attrs.push({ id: 1, valueId: null, customValue: brandName });
  }

  const categoryId = entry.categoryId || entry.category_id;
  if (!categoryId) return { _skip: true, reason: 'N11 category not mapped' };

  return {
    title: product.title,
    description: product.description || '',
    categoryId: Number(categoryId),
    currencyType: 'TL',
    productMainId: product.sku,
    preparingDay: Number(entry.preparingDay ?? 3),
    shipmentTemplate: String(entry.shipmentTemplate || '1'),
    stockCode: product.sku,
    quantity: Number(product.quantity ?? 0),
    barcode: product.sku,
    images,
    attributes: attrs,
    salePrice: Number(price),
    listPrice: Number(price),
    vatRate: Number(entry.vatRate ?? 10),
    maxPurchaseQuantity: entry.maxPurchaseQuantity || null,
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
    quantity: Number(product.quantity ?? 0),
    cargoCompanyId: Number(entry.cargoCompanyId || 0),
    dispatchDuration: Number(entry.dispatchDuration ?? 3),
    vatRate: Number(entry.vatRate ?? 10),
  };
}

export function mapProductForPazarama(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'pazarama');
  const price = product.priceTRY ?? product.priceUSD ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? u : (u.url || u)).filter(Boolean) : [];

  return {
    barcode: product.sku,
    productName: product.title,
    description: product.description || '',
    categoryId: Number(entry.categoryId || entry.category_id || 0),
    salePrice: Number(price),
    listPrice: Number(price),
    quantity: Number(product.quantity ?? 0),
    cargoCompanyId: Number(entry.cargoCompanyId || 0),
    dispatchDuration: Number(entry.dispatchDuration ?? 3),
    vatRate: Number(entry.vatRate ?? 10),
    images,
    attributes: entry.attributes || [],
    brand: entry.brand || '',
  };
}

export function mapProductForAmazon(product: any, integration: any): Record<string, any> {
  const entry = getMarketplaceEntry(product, 'amazon');
  const price = product.priceUSD ?? product.priceTRY ?? 0;
  const images = Array.isArray(product.images) ? product.images.map((u: any) => typeof u === 'string' ? u : (u.url || u)).filter(Boolean) : [];

  return {
    sellerSKU: product.sku,
    title: product.title,
    description: product.description || '',
    categoryId: Number(entry.categoryId || entry.category_id || 0),
    brand: entry.brand || '',
    images,
    listPrice: Number(price),
    salePrice: Number(price),
    quantity: Number(product.quantity ?? 0),
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
    quantity: Number(product.quantity ?? 0),
    tags: product.tags || entry.tags || [],
    images,
    categoryId: Number(entry.categoryId || entry.category_id || 0),
    brand: entry.brand || '',
    whoMade: 'someone_else',
    whenMade: '2020_2024',
    taxonomyId: entry.taxonomyId,
  };
}

export function mapProductForMarketplace(mp: string, product: any, integration: any): Record<string, any> {
  switch (mp) {
    case 'trendyol': return mapProductForTrendyol(product, integration);
    case 'n11': return mapProductForN11(product, integration);
    case 'hepsiburada': return mapProductForHepsiburada(product, integration);
    case 'pazarama': return mapProductForPazarama(product, integration);
    case 'amazon': return mapProductForAmazon(product, integration);
    case 'etsy': return mapProductForEtsy(product, integration);
    default: return { title: product.title, salePrice: product.priceTRY ?? product.priceUSD ?? 0 };
  }
}