import axios from 'axios';
import crypto from 'crypto';
import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface AmazonConfig {
  refreshToken: string;
  lwaClientId: string;
  lwaClientSecret: string;
  awsAccessKey: string;
  awsSecretKey: string;
  sellerId: string;
  marketplaceId: string;
  region?: string;
  applicationId?: string;
  iamRoleArn?: string;
}

interface AmazonTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

const LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const DEFAULT_MARKETPLACE_TR = 'A33AVAJ2PDY3EV'; // Turkey
const DEFAULT_REGION = 'eu-west-1';
const SP_API_HOST = 'sellingpartnerapi-eu.amazon.com';

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmacSHA256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}
function signKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacSHA256(secret, dateStamp);
  const kRegion = hmacSHA256(kDate, region);
  const kService = hmacSHA256(kRegion, service);
  return hmacSHA256(kService, 'aws4_request');
}

function buildSignedHeaders(method: string, url: string, region: string, service: string, credentials: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }, accessToken: string, body: string = ''): { url: string; headers: Record<string, string> } {
  const u = new URL(url);
  const host = u.host;
  const canonicalUri = u.pathname || '/';
  const canonicalQuery = u.searchParams.toString().split('&').filter(Boolean).sort().join('&');
  const payloadHash = sha256Hex(body);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headersToSign: Record<string, string> = {
    host,
    'x-amz-access-token': accessToken,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };
  if (credentials.sessionToken) headersToSign['x-amz-security-token'] = credentials.sessionToken;
  const sortedKeys = Object.keys(headersToSign).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headersToSign[k]}\n`).join('');
  const signedHeaderNames = sortedKeys.join(';');
  const canonicalRequest = [method.toUpperCase(), canonicalUri, canonicalQuery, canonicalHeaders, signedHeaderNames, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const signature = crypto.createHmac('sha256', signKey(credentials.secretAccessKey, dateStamp, region, service)).update(stringToSign).digest('hex');
  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;
  const finalHeaders: Record<string, string> = { ...headersToSign, Authorization: authorizationHeader };
  const finalUrl = canonicalQuery ? `${url.split('?')[0]}?${canonicalQuery}` : url;
  return { url: finalUrl, headers: finalHeaders };
}

export class AmazonClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: AmazonConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private region: string;

  constructor(config: AmazonConfig) {
    super(`https://${SP_API_HOST}`, {});
    this.marketplaceName = 'amazon';
    this.region = config.region || DEFAULT_REGION;
    this.config = {
      region: this.region,
      ...config,
      marketplaceId: config.marketplaceId || DEFAULT_MARKETPLACE_TR,
    };
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) return this.accessToken;
    if (!this.config.refreshToken) throw new Error('Amazon refreshToken missing. Complete OAuth.');
    if (!this.config.lwaClientId || !this.config.lwaClientSecret) throw new Error('Amazon LWA Client ID/Secret missing. Configure in Superadmin > Global API Settings.');
    const res = await axios.post<AmazonTokenResponse>(LWA_TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.lwaClientId,
      client_secret: this.config.lwaClientSecret,
    }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });
    this.accessToken = res.data.access_token;
    this.tokenExpiry = Date.now() + res.data.expires_in * 1000;
    return this.accessToken;
  }

  // Exchange authorization_code (from OAuth callback) for refresh_token
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<AmazonTokenResponse> {
    if (!this.config.lwaClientId || !this.config.lwaClientSecret) throw new Error('LWA credentials missing');
    const res = await axios.post<AmazonTokenResponse>(LWA_TOKEN_URL, new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.lwaClientId,
      client_secret: this.config.lwaClientSecret,
      redirect_uri: redirectUri,
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 });
    return res.data;
  }

  static buildAuthorizationUrl(applicationId: string, state: string, redirectUri: string): string {
    // SP-API Selling Partner OAuth: sellercentral.amazon.com/apps/authorize/consent
    const params = new URLSearchParams({ application_id: applicationId, state, redirect_uri: redirectUri, version: 'beta' });
    return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
  }

  private async signedRequest(method: string, pathWithQuery: string, bodyStr: string = ''): Promise<{ url: string; headers: Record<string, string> }> {
    const token = await this.ensureToken();
    if (!this.config.awsAccessKey || !this.config.awsSecretKey) throw new Error('AWS AccessKey/SecretKey missing. Configure in Superadmin > Global API Settings.');
    const fullUrl = `https://${SP_API_HOST}${pathWithQuery}`;
    return buildSignedHeaders(method, fullUrl, this.region, 'execute-api', { accessKeyId: this.config.awsAccessKey, secretAccessKey: this.config.awsSecretKey }, token, bodyStr);
  }

  private async spRequest<T>(method: string, pathWithQuery: string, body?: any): Promise<T> {
    const bodyStr = body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const { url, headers } = await this.signedRequest(method, pathWithQuery, bodyStr);
    const res = await axios.request<T>({
      method,
      url,
      headers: { ...headers, 'Content-Type': bodyStr ? 'application/json' : 'application/json' },
      data: bodyStr || undefined,
      timeout: 30000,
    });
    return res.data;
  }

  async getCategories(): Promise<any[]> {
    // Amazon uses Product Types as categories. Fetch via Product Type Definitions API
    // Fallback to a curated list if API fails (so UI never stays empty)
    const fallback = [
      { id: 'PRODUCT', name: 'Generic Product', parent_id: '0' },
      { id: 'COFFEE_MAKER', name: 'Coffee Maker', parent_id: '0' },
      { id: 'SCREWDRIVER', name: 'Screwdriver', parent_id: '0' },
      { id: 'LITTER_BOX', name: 'Litter Box', parent_id: '0' },
      { id: 'HOME', name: 'Home', parent_id: '0' },
      { id: 'TOOLS', name: 'Tools', parent_id: '0' },
    ];
    try {
      const path = `/definitions/2020-09-01/productTypes?marketplaceIds=${encodeURIComponent(this.config.marketplaceId)}`;
      const data: any = await this.spRequest('GET', path);
      const types: any[] = data.productTypes || data.product_types || data.items || [];
      if (Array.isArray(types) && types.length > 0) {
        return types.map((pt: any) => {
          const id = pt.productType || pt.name || pt.value || String(pt);
          const name = pt.displayName || pt.productType || pt.name || String(pt);
          return { id: String(id), marketplace_category_id: String(id), name: String(name), parent_id: '0', parentId: '0', level: 0, path: String(name) };
        });
      }
    } catch (e) { /* fallback */ }
    // Try to enrich fallback with already-seen productTypes from seller's listings (so atabayonline's types appear)
    try {
      const res: any = await this.spRequest('GET', `/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}?marketplaceIds=${encodeURIComponent(this.config.marketplaceId)}&includedData=summaries&pageSize=20`);
      const items: any[] = res.items || [];
      const seen = new Map<string, string>();
      for (const it of items) {
        const pt = it.summaries?.[0]?.productType;
        if (pt && !seen.has(pt)) seen.set(pt, pt);
      }
      if (seen.size > 0) return Array.from(seen.entries()).map(([id, name]) => ({ id, marketplace_category_id: id, name, parent_id: '0', parentId: '0', level: 0, path: name }));
    } catch {}
    return fallback;
  }

  async getBrands(search?: string): Promise<{ id: string; name: string }[]> {
    // Amazon has no brands API - return seller's distinct brands from listings so UI has suggestions, otherwise empty (free-text brand)
    try {
      const res: any = await this.spRequest('GET', `/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}?marketplaceIds=${encodeURIComponent(this.config.marketplaceId)}&includedData=attributes&pageSize=20`);
      const items: any[] = res.items || [];
      const brands = new Map<string, string>();
      for (const it of items) {
        const b = it.attributes?.brand?.[0]?.value;
        if (b && !brands.has(b.toLowerCase())) brands.set(b.toLowerCase(), b);
      }
      let list = Array.from(brands.values()).map((name) => ({ id: name, name }));
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((b) => b.name.toLowerCase().includes(q));
      }
      return list;
    } catch { return []; }
  }

  async getCategoryAttributes(categoryId: string | number): Promise<any[]> {
    const productType = String(categoryId);
    try {
      // Product Type Definitions: get definition for a productType to extract required attributes
      const path = `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}?marketplaceIds=${encodeURIComponent(this.config.marketplaceId)}&requirements=LISTING&requirementsEnforced=false&locale=tr_TR`;
      const data: any = await this.spRequest('GET', path);
      // Definitions API returns schema with properties
      const schema = data.schema || data.productTypeDefinition?.schema || data;
      const props = schema?.properties || schema?.definitions || {};
      // Also try defs from response directly
      const attributes: any[] = [];
      const addAttr = (name: string, def: any) => {
        if (!name || name.startsWith('_')) return;
        // Skip internal
        if (['marketplace_id', 'version'].includes(name)) return;
        attributes.push({
          id: name,
          attributeId: name,
          name,
          label: def?.title || name,
          required: Array.isArray(schema.required) ? schema.required.includes(name) : false,
          type: def?.type || 'string',
          description: def?.description || '',
          enum: def?.enum || def?.options || undefined,
        });
      };
      if (props && typeof props === 'object') {
        for (const [k, v] of Object.entries(props)) addAttr(k, v as any);
      }
      // If still empty, try parsing definitions
      if (attributes.length === 0 && data.propertyGroups) {
        for (const g of data.propertyGroups) {
          for (const p of g.properties || []) addAttr(p.name || p.propertyName, p);
        }
      }
      // Fallback: return common Amazon attributes so UI not empty
      if (attributes.length === 0) {
        return [
          { id: 'brand', attributeId: 'brand', name: 'brand', label: 'Marka', required: true, type: 'string' },
          { id: 'item_name', attributeId: 'item_name', name: 'item_name', label: 'Ürün Adı', required: true, type: 'string' },
          { id: 'product_description', attributeId: 'product_description', name: 'product_description', label: 'Açıklama', required: false, type: 'string' },
          { id: 'main_product_image_locator', attributeId: 'main_product_image_locator', name: 'main_product_image_locator', label: 'Ana Görsel', required: true, type: 'string' },
          { id: 'purchasable_offer', attributeId: 'purchasable_offer', name: 'purchasable_offer', label: 'Fiyat', required: true, type: 'object' },
          { id: 'fulfillment_availability', attributeId: 'fulfillment_availability', name: 'fulfillment_availability', label: 'Stok', required: true, type: 'object' },
        ];
      }
      return attributes;
    } catch (e: any) {
      // On error, return minimal attributes so product creation still works
      return [
        { id: 'brand', attributeId: 'brand', name: 'brand', label: 'Marka', required: true, type: 'string' },
        { id: 'item_name', attributeId: 'item_name', name: 'item_name', label: 'Ürün Adı', required: true, type: 'string' },
        { id: 'product_description', attributeId: 'product_description', name: 'product_description', label: 'Açıklama', required: false, type: 'string' },
      ];
    }
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean; nextToken?: string }> {
    if (!this.config.sellerId) throw new Error('Amazon sellerId missing');
    const size = Math.min(Number(params.size ?? params.limit ?? 50), 20);
    const token = params.nextToken ?? params.pageToken ?? undefined;
    // Listings Items API: searchListingsItems = GET /listings/2021-08-01/items/{sellerId}
    const query = new URLSearchParams({
      marketplaceIds: this.config.marketplaceId,
      includedData: 'summaries,offers,attributes,issues',
      pageSize: String(size),
    });
    if (token) query.set('pageToken', String(token));
    // Optional filters forwarded from queues (e.g., createdAfter)
    if (params.sku) query.set('sku', String(params.sku));
    const path = `/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}?${query.toString()}`;
    const data: any = await this.spRequest('GET', path);
    const items = data.items || data.listings || [];
    const next = data.pagination?.nextToken || data.nextToken || undefined;
    // Normalize to importNormalizer expected shape - map Amazon's nested structures to flat fields that normalizeMarketplaceProduct understands
    const products = (Array.isArray(items) ? items : []).map((it: any) => {
      const summary = it.summaries?.[0] || {};
      const offer = it.offers?.[0] || {};
      const attrs = it.attributes || {};
      // Images: main + other locators
      const images: string[] = [];
      const mainImgs = attrs.main_product_image_locator || attrs.main_offer_image_locator || [];
      const otherImgs = attrs.other_product_image_locator || attrs.other_offer_image_locator || [];
      for (const img of [...(Array.isArray(mainImgs) ? mainImgs : []), ...(Array.isArray(otherImgs) ? otherImgs : [])]) {
        const url = img?.media_location || img?.url || img?.value || (typeof img === 'string' ? img : null);
        if (url && typeof url === 'string' && url.startsWith('http')) images.push(url);
      }
      // Fallback: summary may contain images
      if (images.length === 0 && summary.mainImage?.link) images.push(summary.mainImage.link);
      // Brand
      const brand = attrs.brand?.[0]?.value || summary.brand || attrs.brand_name?.[0]?.value || '';
      // Category = productType (Amazon uses productType, not numeric categoryId)
      const category = summary.productType || it.productTypes?.[0]?.productType || attrs.product_type?.[0]?.value || '';
      const categoryId = summary.productType || it.productTypes?.[0]?.productType || undefined;
      // Description
      const description = attrs.product_description?.[0]?.value || attrs.description?.[0]?.value || summary.productName || '';
      // Price: offers.price.amount or purchasable_offer.our_price[0].schedule[0].value_with_tax
      let price: number | undefined;
      let currency: string | undefined;
      if (offer?.price?.amount) { price = Number(offer.price.amount); currency = offer.price.currency || offer.price.currencyCode; }
      else if (offer?.ourPrice?.amount) { price = Number(offer.ourPrice.amount); currency = offer.ourPrice.currency; }
      else {
        const po = attrs.purchasable_offer?.[0];
        const sched = po?.our_price?.[0]?.schedule?.[0] || po?.ourPrice?.[0]?.schedule?.[0];
        if (sched?.value_with_tax != null) { price = Number(sched.value_with_tax); currency = po?.currency || 'TRY'; }
        else if (po?.our_price?.[0]?.schedule?.[0]?.value != null) { price = Number(po.our_price[0].schedule[0].value); currency = po?.currency || 'TRY'; }
      }
      // Quantity
      const quantity = offer.availableQuantity ?? attrs.fulfillment_availability?.[0]?.quantity ?? offer.quantity ?? 0;
      const skuVal = it.sku || summary.sku || it.sellerSku || it.sellerSKU || '';
      const titleVal = summary.itemName || summary.productName || attrs.item_name?.[0]?.value || attrs.title?.[0]?.value || skuVal || 'Imported Amazon Product';
      return {
        sku: skuVal,
        sellerSKU: it.sku,
        asin: summary.asin || it.asin,
        title: titleVal,
        name: titleVal,
        productName: summary.itemName || titleVal,
        description,
        quantity: Number(quantity) || 0,
        price,
        salePrice: price,
        listPrice: price,
        currency: currency || 'TRY',
        currencyType: currency || 'TRY',
        brand,
        brandName: brand,
        category,
        categoryId,
        productType: category,
        images,
        imageUrl: images[0] || undefined,
        imageUrls: images,
        attributes: it.attributes,
        summaries: it.summaries,
        offers: it.offers,
        issues: it.issues,
        productTypes: it.productTypes,
        raw: it,
      };
    });
    return { products, hasMore: !!next, nextToken: next };
  }

  async createProduct(product: any): Promise<any> {
    if (!this.config.sellerId) throw new Error('Amazon sellerId missing');
    const sku = String(product.sellerSKU || product.sku || product.barcode || product.stockCode || `SKU-${Date.now()}`);
    const marketplaceId = this.config.marketplaceId;
    // Build attributes per SP-API: productType required. Fallback to PRODUCT for partial
    const attributes: any = {};
    if (product.title) attributes.item_name = [{ value: product.title, language_tag: 'en_US', marketplace_id: marketplaceId }];
    if (product.description) attributes.product_description = [{ value: product.description, language_tag: 'en_US', marketplace_id: marketplaceId }];
    if (product.brand) attributes.brand = [{ value: product.brand, language_tag: 'en_US', marketplace_id: marketplaceId }];
    // Images: main_product_image_locator expects media_location
    const imageUrl = Array.isArray(product.images) ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url) : product.imageUrl || null;
    if (imageUrl) attributes.main_product_image_locator = [{ media_location: String(imageUrl), marketplace_id: marketplaceId }];
    // Price and inventory are handled via purchasable_offer / fulfillment_availability but we include as attributes for initial create if productType supports
    // For generic PRODUCT we use purchasable_offer and fulfillment_availability
    const price = Number(product.salePrice ?? product.listPrice ?? product.price ?? 0);
    const quantity = Number(product.quantity ?? 0);
    if (price > 0) {
      attributes.purchasable_offer = [{
        marketplace_id: marketplaceId,
        currency: product.currency || 'TRY',
        our_price: [{ schedule: [{ value_with_tax: price }] }],
      }];
    }
    if (quantity >= 0) {
      attributes.fulfillment_availability = [{ fulfillment_channel_code: 'DEFAULT', quantity }];
    }
    // Merge extra attributes if provided
    if (Array.isArray(product.attributes)) {
      for (const a of product.attributes) {
        if (a?.key && a?.value) attributes[a.key] = a.value;
      }
    }
    const productType = product.productType || 'PRODUCT';
    const body: any = {
      productType,
      requirements: 'LISTING',
      attributes,
    };
    const path = `/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;
    const data: any = await this.spRequest('PUT', path, body);
    // SP-API returns submissionId and issues, not externalId yet. Return sku as externalId for listing tracking
    return { externalId: sku, sku, submissionId: data.submissionId || data.submission_id, status: data.status, issues: data.issues, ...data };
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    if (!this.config.sellerId) throw new Error('Amazon sellerId missing');
    const sku = String(productId);
    const marketplaceId = this.config.marketplaceId;
    const patches: any[] = [];
    if (product.title) patches.push({ op: 'replace', path: '/attributes/item_name', value: [{ value: product.title, language_tag: 'en_US', marketplace_id: marketplaceId }] });
    if (product.description) patches.push({ op: 'replace', path: '/attributes/product_description', value: [{ value: product.description, language_tag: 'en_US', marketplace_id: marketplaceId }] });
    if (product.brand) patches.push({ op: 'replace', path: '/attributes/brand', value: [{ value: product.brand, language_tag: 'en_US', marketplace_id: marketplaceId }] });
    const imageUrl2 = Array.isArray(product.images) ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url) : null;
    if (imageUrl2) patches.push({ op: 'replace', path: '/attributes/main_product_image_locator', value: [{ media_location: String(imageUrl2), marketplace_id: marketplaceId }] });
    // Price/stock via patches if present
    const price = product.salePrice ?? product.listPrice ?? product.price;
    if (price !== undefined && price !== null) {
      patches.push({ op: 'replace', path: '/attributes/purchasable_offer', value: [{ marketplace_id: marketplaceId, currency: product.currency || 'TRY', our_price: [{ schedule: [{ value_with_tax: Number(price) }] }] }] });
    }
    if (product.quantity !== undefined && product.quantity !== null) {
      patches.push({ op: 'replace', path: '/attributes/fulfillment_availability', value: [{ fulfillment_channel_code: 'DEFAULT', quantity: Number(product.quantity) }] });
    }
    if (patches.length === 0) return { sku, noOp: true };
    const body: any = { productType: product.productType || 'PRODUCT', patches };
    const path = `/listings/2021-08-01/items/${encodeURIComponent(this.config.sellerId)}/${encodeURIComponent(sku)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;
    const data: any = await this.spRequest('PATCH', path, body);
    return { sku, ...data };
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    return this.updateProduct(productId, { salePrice: price, currency: 'TRY' });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    return this.updateProduct(productId, { quantity });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    // Orders API v2026-01-01: searchOrders
    const marketplaceId = this.config.marketplaceId;
    const query = new URLSearchParams();
    query.set('marketplaceIds', marketplaceId);
    // SP-API requires CreatedAfter or LastUpdatedAfter
    const createdAfter = params.startDate || params.CreatedAfter || params.createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query.set('createdAfter', new Date(createdAfter).toISOString());
    if (params.endDate || params.CreatedBefore) query.set('createdBefore', new Date(params.endDate || params.CreatedBefore).toISOString());
    if (params.status) query.set('orderStatuses', String(params.status));
    else if (params.OrderStatuses) query.set('orderStatuses', String(params.OrderStatuses));
    // For backwards compat: map old v0 status filter
    // Default to fetch open orders if no status filter and no date range beyond 7 days
    if (params.nextToken) query.set('nextToken', String(params.nextToken));
    if (params.maxResults) query.set('maxResults', String(Math.min(Number(params.maxResults), 100)));
    else query.set('maxResults', '50');

    // Try v2026 first, fallback to v0 for older credentials if 404
    const tryFetch = async (version: string, pathSuffix: string) => {
      const path = `/orders/${version}/orders${pathSuffix}?${query.toString()}`;
      try {
        const data: any = await this.spRequest('GET', path);
        // v2026: { orders: [...], nextToken }, v0: { payload: { Orders: [...] }, Orders: [...] }
        if (Array.isArray(data.orders)) return data.orders;
        if (Array.isArray(data.Orders)) return data.Orders;
        if (data.payload?.Orders) return data.payload.Orders;
        return [];
      } catch (e: any) {
        if (version === 'v2026-01-01' && e?.response?.status === 404) throw e;
        throw e;
      }
    };

    try {
      const orders = await tryFetch('v2026-01-01', '');
      return orders;
    } catch (e: any) {
      // Fallback to v0 if v2026 not available
      if (e?.response?.status === 404 || e?.response?.data?.errors?.[0]?.code === 'NotFound') {
        const v0Path = `/orders/v0/orders?MarketplaceIds=${encodeURIComponent(marketplaceId)}&CreatedAfter=${encodeURIComponent(new Date(createdAfter).toISOString())}`;
        try {
          const data: any = await this.spRequest('GET', v0Path);
          return data.payload?.Orders || data.Orders || [];
        } catch {}
      }
      throw e;
    }
  }

  async getOrder(orderId: string): Promise<any> {
    // Try v2026 first
    try {
      const data: any = await this.spRequest('GET', `/orders/v2026-01-01/orders/${encodeURIComponent(orderId)}`);
      return data.order || data.payload || data;
    } catch {
      const data: any = await this.spRequest('GET', `/orders/v0/orders/${encodeURIComponent(orderId)}`);
      return data.payload || data;
    }
  }

  // For order sync we also need getOrderItems
  async getOrderItems(orderId: string): Promise<any[]> {
    try {
      const data: any = await this.spRequest('GET', `/orders/v2026-01-01/orders/${encodeURIComponent(orderId)}/orderItems`);
      return data.orderItems || data.payload?.OrderItems || [];
    } catch {
      try {
        const data: any = await this.spRequest('GET', `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`);
        return data.payload?.OrderItems || data.OrderItems || [];
      } catch { return []; }
    }
  }
}

export function createAmazonClient(config: AmazonConfig): AmazonClient {
  return new AmazonClient(config);
}
