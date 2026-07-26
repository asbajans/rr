import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

function createAxios(baseURL: string, headers: Record<string, string> = {}): AxiosInstance {
  const inst = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json', ...headers },
    timeout: 30000,
  });
  inst.interceptors.response.use(
    (res) => res,
    (err) => {
      logger.error({ err: err.message, url: err.config?.url, status: err.response?.status }, 'Marketplace API error');
      return Promise.reject(err);
    },
  );
  return inst;
}

export class TrendyolClient {
  private client: AxiosInstance;
  private orderClient: AxiosInstance;
  private supplierId: string;

  constructor(config: { apiKey: string; apiSecret: string; supplierId: string }) {
    const auth = `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`;
    this.supplierId = config.supplierId;
    this.client = createAxios('https://apigw.trendyol.com/integration/product', {
      'User-Agent': config.supplierId,
      Authorization: auth,
    });
    this.orderClient = createAxios('https://apigw.trendyol.com/integration/order', {
      'User-Agent': config.supplierId,
      Authorization: auth,
    });
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/orders`, { params });
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/orders/${orderId}`);
    return data;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    if (status === 'approved' || status === 'Picking') {
      const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/orders/${orderId}/approve`);
      return data;
    }
    if (status === 'shipped' || status === 'Invoiced') {
      const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/orders/${orderId}/invoice`);
      return data;
    }
    const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/orders/${orderId}`, { status });
    return data;
  }

  async updateTracking(orderId: string, trackingNumber: string, carrier: string): Promise<any> {
    const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/orders/${orderId}/ship`, {
      trackingNumber,
      cargoCompany: carrier,
    });
    return data;
  }
}

export class N11Client {
  private client: AxiosInstance;
  private headers: Record<string, string>;

  constructor(config: { appKey: string; appSecret: string }) {
    this.headers = { appKey: config.appKey, appSecret: config.appSecret };
    this.client = createAxios('https://api.n11.com');
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const { data } = await this.client.get('/rest/delivery/v1/shipmentPackages', { params, headers: this.headers });
    const content = data?.content ?? [];
    return Array.isArray(content) ? content : [];
  }

  async getOrder(packageId: string): Promise<any> {
    const orders = await this.getOrders({ packageIds: packageId });
    return orders.length > 0 ? orders[0] : null;
  }

  async updateOrderStatus(lineIds: number[], status: string = 'Picking'): Promise<any> {
    const { data } = await this.client.put('/rest/order/v1/update', {
      lines: lineIds.map((id) => ({ lineId: id })),
      status,
    }, { headers: { 'Content-Type': 'application/json', ...this.headers } });
    return data;
  }

  async updateTracking(packageId: string, trackingNumber: string, shippingCompany: string): Promise<any> {
    const { data } = await this.client.put('/rest/delivery/v1/shipmentPackage', {
      shipmentPackage: { id: Number(packageId), trackingNumber, shippingCompany },
    }, { headers: { 'Content-Type': 'application/json', ...this.headers } });
    return data;
  }
}

export class HepsiburadaClient {
  private client: AxiosInstance;
  private config: { username: string; password: string; merchantId: string };

  constructor(config: { username: string; password: string; merchantId: string }) {
    this.config = config;
    this.client = createAxios('https://api.hepsiburada.com');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const { page = 1, size = 50 } = params;
    const headers = await this.authHeaders();
    const { data } = await this.client.get(
      `/commerce/v1/orders?merchantId=${this.config.merchantId}&page=${page}&size=${size}`,
      { headers },
    );
    return data.content || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders();
    const { data } = await this.client.get(`/commerce/v1/orders/${orderId}?merchantId=${this.config.merchantId}`, { headers });
    return data;
  }
}

export class PazaramaClient {
  private client: AxiosInstance;
  private config: { clientId: string; clientSecret: string; apiKey: string };

  constructor(config: { clientId: string; clientSecret: string; apiKey: string }) {
    this.config = config;
    this.client = createAxios('https://api.pazarama.com');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      apiKey: this.config.apiKey,
    };
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const headers = await this.authHeaders();
    const { data } = await this.client.get('/order/getOrders', { params, headers });
    return data?.data || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders();
    const { data } = await this.client.get(`/order/getOrder/${orderId}`, { headers });
    return data;
  }
}

export class AmazonClient {
  private client: AxiosInstance;
  private config: { refreshToken: string; lwaClientId: string; lwaClientSecret: string; awsAccessKey: string; awsSecretKey: string; sellerId: string; marketplaceId: string };

  constructor(config: { refreshToken: string; lwaClientId: string; lwaClientSecret: string; awsAccessKey: string; awsSecretKey: string; sellerId: string; marketplaceId: string }) {
    this.config = config;
    this.client = createAxios('https://sellingpartnerapi.amazon.com');
  }

  private async signAndRequest(method: string, path: string, options: any = {}): Promise<any> {
    const { data } = await this.client.request({ method, url: path, ...options });
    return data;
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const path = `/orders/v0/orders?MarketplaceIds=${this.config.marketplaceId}&OrderStatuses=Unshipped,PartiallyShipped`;
    const data = await this.signAndRequest('GET', path);
    return data.Orders || [];
  }

  async getOrder(orderId: string): Promise<any> {
    return this.signAndRequest('GET', `/orders/v0/orders/${orderId}`);
  }
}

export class EtsyClient {
  private client: AxiosInstance;
  private config: { clientId: string; clientSecret: string; redirectUri: string; accessToken?: string; refreshToken?: string };

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string; accessToken?: string; refreshToken?: string }) {
    this.config = config;
    this.client = createAxios('https://api.etsy.com/v3');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    return { 'x-api-key': this.config.clientId, Authorization: `Bearer ${this.config.accessToken || ''}` };
  }

  private async getShopId(): Promise<number> {
    const headers = await this.authHeaders();
    const { data } = await this.client.get('/application/shops', { headers });
    return data?.results?.[0]?.shop_id || 0;
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const shopId = await this.getShopId();
    if (!shopId) return [];
    const headers = await this.authHeaders();
    const { data } = await this.client.get(`/shops/${shopId}/receipts`, { params, headers });
    return data.results || [];
  }

  async getOrder(receiptId: string): Promise<any> {
    const shopId = await this.getShopId();
    if (!shopId) return null;
    const headers = await this.authHeaders();
    const { data } = await this.client.get(`/shops/${shopId}/receipts/${receiptId}`, { headers });
    return data;
  }
}