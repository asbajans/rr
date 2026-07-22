import { BaseMarketplaceClient, MarketplaceClient } from './base.js';

export interface AmazonConfig {
  refreshToken: string;
  lwaClientId: string;
  lwaClientSecret: string;
  awsAccessKey: string;
  awsSecretKey: string;
  sellerId: string;
  marketplaceId: string;
}

interface AmazonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export class AmazonClient extends BaseMarketplaceClient implements MarketplaceClient {
  private config: AmazonConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: AmazonConfig) {
    super('https://sellingpartnerapi-eu.amazon.com', {});
    this.config = config;
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const data = await this.request<AmazonTokenResponse>({
      method: 'POST',
      url: '/auth/o2/token',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.config.refreshToken,
        client_id: this.config.lwaClientId,
        client_secret: this.config.lwaClientSecret,
      }),
    });

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken();
    return { Authorization: `Bearer ${token}`, 'x-amz-access-token': token };
  }

  private async signRequest(method: string, path: string, body?: string): Promise<Record<string, string>> {
    const AWS = require('aws-sdk');
    const signer = new AWS.Signers.V4('execute-api', 'eu-west-1');
    const request = new AWS.HttpRequest(`https://sellingpartnerapi-eu.amazon.com${path}`, 'eu-west-1');
    request.method = method;
    request.headers = { ...await this.getHeaders(), host: 'sellingpartnerapi-eu.amazon.com' };
    if (body) request.body = body;
    signer.addAuthorization(request, new AWS.Credentials(this.config.awsAccessKey, this.config.awsSecretKey));
    return request.headers;
  }

  async getCategories(): Promise<any[]> { return []; }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const headers = await this.signRequest('GET', `/catalog/2022-04-01/items?marketplaceIds=${this.config.marketplaceId}&includedData=attributes,identifiers,images,productTypes,salesRanks,summaries,vendorDetails&sellerId=${this.config.sellerId}`);
    const data = await this.request<any>({ method: 'GET', url: `/catalog/2022-04-01/items?marketplaceIds=${this.config.marketplaceId}&includedData=attributes,identifiers,images,productTypes,salesRanks,summaries,vendorDetails&sellerId=${this.config.sellerId}`, headers });
    return { products: data.items || [], hasMore: !!data.nextToken };
  }

  async createProduct(product: any): Promise<any> {
    const sku = product.barcode || product.stockCode || product.sku || `SKU-${Date.now()}`;
    const attributes: any = {
      item_name: [{ value: product.title, language_tag: 'en_US' }],
      product_description: [{ value: product.description || '', language_tag: 'en_US' }],
    };
    if (product.images?.length) {
      attributes.main_product_image_locator = [{ media_location: product.images[0] }];
    }
    const body = JSON.stringify({ productType: 'PRODUCT', requirements: 'LISTING', attributes });
    const headers = await this.signRequest('POST', `/listings/2021-08-01/items/${this.config.sellerId}?marketplaceIds=${this.config.marketplaceId}`, body);
    const data = await this.request<any>({ method: 'POST', url: `/listings/2021-08-01/items/${this.config.sellerId}?marketplaceIds=${this.config.marketplaceId}`, data: body, headers });
    return { externalId: sku, ...data };
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    const patches: any[] = [
      { op: 'replace', path: '/attributes/item_name', value: [{ value: product.title, language_tag: 'en_US' }] },
    ];
    if (product.description) {
      patches.push({ op: 'replace', path: '/attributes/product_description', value: [{ value: product.description, language_tag: 'en_US' }] });
    }
    if (product.images?.length) {
      patches[0] = { op: 'replace', path: '/attributes/main_product_image_locator', value: [{ media_location: product.images[0] }] };
    }
    const body = JSON.stringify({ productType: 'PRODUCT', patches });
    const headers = await this.signRequest('PATCH', `/listings/2021-08-01/items/${this.config.sellerId}/${productId}?marketplaceIds=${this.config.marketplaceId}`, body);
    return this.request<any>({ method: 'PATCH', url: `/listings/2021-08-01/items/${this.config.sellerId}/${productId}?marketplaceIds=${this.config.marketplaceId}`, data: body, headers });
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    const body = JSON.stringify([
      {
        sellerId: this.config.sellerId,
        updates: [{
          condition: 'New_new',
          status: 'Cad',
          availableQuantity: 999,
          value: {
            amount: price,
            currencyCode: 'TRY',
          },
          saleValue: {
            amount: price,
            currencyCode: 'TRY',
          },
        }],
      },
    ]);
    const headers = await this.signRequest('PUT', `/product/pricing/v0/listingOffers/B00${productId.slice(-8)}?sellerId=${this.config.sellerId}&marketplaceId=${this.config.marketplaceId}`, body);
    return this.request<any>({ method: 'PUT', url: `/product/pricing/v0/listingOffers/B00${productId.slice(-8)}?sellerId=${this.config.sellerId}&marketplaceId=${this.config.marketplaceId}`, data: body, headers });
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    const body = JSON.stringify(({
      productType: 'PRODUCT',
      patches: [{
        op: 'replace',
        path: '/attributes/fulfillment_availability',
        value: [{ fulfillment_channel_code: 'DEFAULT', quantity }],
      }],
    }) as any);
    const headers = await this.signRequest('PATCH', `/listings/2021-08-01/items/${this.config.sellerId}/${productId}?marketplaceIds=${this.config.marketplaceId}`, body);
    return this.request<any>({ method: 'PATCH', url: `/listings/2021-08-01/items/${this.config.sellerId}/${productId}?marketplaceIds=${this.config.marketplaceId}`, data: body, headers });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const headers = await this.signRequest('GET', `/orders/v0/orders?MarketplaceIds=${this.config.marketplaceId}&OrderStatuses=Unshipped,PartiallyShipped`);
    const data = await this.request<any>({ method: 'GET', url: `/orders/v0/orders?MarketplaceIds=${this.config.marketplaceId}&OrderStatuses=Unshipped,PartiallyShipped`, headers });
    return data.Orders || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const headers = await this.signRequest('GET', `/orders/v0/orders/${orderId}`);
    return this.request<any>({ method: 'GET', url: `/orders/v0/orders/${orderId}`, headers });
  }
}

export function createAmazonClient(config: AmazonConfig): AmazonClient {
  return new AmazonClient(config);
}