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

  async getOrdersV2(params: any = {}): Promise<{ content: any[]; last: boolean; totalElements: number }> {
    const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/v2/orders`, { params });
    return { content: data.content || [], last: data.last !== false, totalElements: data.totalElements || 0 };
  }

  async getOrder(orderId: string): Promise<any> {
    const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/orders/${orderId}`);
    return data;
  }

  async getOrderByPackageId(packageId: string): Promise<any> {
    const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/shipment-packages/${packageId}`);
    return data;
  }

  async getPackageStatus(orderNumber: string, packageId?: string): Promise<string | null> {
    try {
      const { data } = await this.orderClient.get(`/sellers/${this.supplierId}/orders`, {
        params: { orderNumber, size: 10 },
      });
      const packages = data.shipmentPackages || data.content || [];
      const pkg = packageId
        ? packages.find((p: any) => String(p.id) === String(packageId))
        : packages[0];
      return pkg?.status || pkg?.shipmentPackageStatus || null;
    } catch {
      return null;
    }
  }

  async updatePackageStatus(packageId: string, status: string, lines: Array<{ lineId: number; quantity: number }> = []): Promise<any> {
    const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/shipment-packages/${packageId}`, { status, lines });
    return data;
  }

  async approveOrder(packageId: string, lines?: Array<{ lineId: number; quantity: number }>): Promise<any> {
    let payloadLines = lines;
    if (!payloadLines || payloadLines.length === 0) {
      const pkg = await this.getOrderByPackageId(packageId).catch(() => null);
      payloadLines = (pkg?.lines || []).map((line: any) => ({
        lineId: line.id,
        quantity: line.quantity || 1,
      }));
    }
    return this.updatePackageStatus(packageId, 'Picking', payloadLines);
  }

  async updateOrderStatus(orderId: string, status: string): Promise<any> {
    if (status === 'approved' || status === 'Picking') {
      return this.approveOrder(orderId);
    }
    throw new Error(`Trendyol does not support manual status change to '${status}'. Use approveOrder for Picking.`);
  }

  async updateTracking(orderId: string, trackingNumber: string, carrier: string): Promise<any> {
    const { data } = await this.orderClient.put(`/sellers/${this.supplierId}/orders/${orderId}/ship`, {
      trackingNumber,
      cargoCompany: carrier,
    });
    return data;
  }

  async getOrderLabel(arg: string | { packageId?: string; trackingNumber?: string }): Promise<{ labelUrl?: string; labelZpl?: string; cargoCompany?: string } | null> {
    const options = typeof arg === 'string' ? { packageId: arg } : arg;
    const trackingNumber = options.trackingNumber;

    if (trackingNumber) {
      try {
        const { data } = await axios.get(`https://apigw.trendyol.com/integration/sellers/${this.supplierId}/common-label/query`, {
          params: { id: trackingNumber },
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.supplierId,
            'Authorization': (this.orderClient.defaults.headers.common['Authorization'] as string) || '',
          },
          timeout: 30000,
        });
        const labels = data?.data || [];
        if (labels.length > 0 && labels[0]?.label) {
          return { labelUrl: labels[0].label, cargoCompany: '' };
        }
      } catch {}
    }

    return null;
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
  private authClient: AxiosInstance;
  private config: { clientId: string; clientSecret: string; apiKey: string };
  private bearerToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: { clientId: string; clientSecret: string; apiKey: string }) {
    this.config = config;
    this.client = createAxios('https://isortagimapi.pazarama.com');
    this.authClient = axios.create({ baseURL: 'https://isortagimgiris.pazarama.com/connect/token', timeout: 15000 });
  }

  private async ensureToken(): Promise<string> {
    if (this.bearerToken && Date.now() < this.tokenExpiry) return this.bearerToken;

    const tryBasic = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
      }), {
        auth: { username: this.config.clientId, password: this.config.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    const tryBodyAuth = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    const tryApiKey = async (): Promise<any> => {
      const res = await this.authClient.post<any>('', new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'merchantgatewayapi.fullaccess',
        client_id: this.config.apiKey,
        client_secret: this.config.clientSecret,
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return res.data;
    };

    for (const attempt of [tryBasic, tryBodyAuth, tryApiKey]) {
      try {
        const body = await attempt();
        if (body?.success === true && body?.data?.accessToken) {
          this.bearerToken = body.data.accessToken;
          this.tokenExpiry = Date.now() + ((body.data.expiresIn || 3600) - 60) * 1000;
          return this.bearerToken!;
        }
        if (body?.access_token) {
          this.bearerToken = body.access_token;
          this.tokenExpiry = Date.now() + ((body.expires_in || 3600) - 60) * 1000;
          return this.bearerToken!;
        }
      } catch {}
    }

    throw new Error('Pazarama auth failed: all 3 OAuth2 methods rejected');
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureToken();
    return { Authorization: `Bearer ${token}` };
  }

  async getOrders(params: any = {}): Promise<any[]> {
    const headers = await this.authHeaders();
    const body = {
      StartDate: params.startDate || new Date(Date.now() - 30 * 86400000).toISOString(),
      EndDate: params.endDate || new Date().toISOString(),
      Page: params.page != null ? params.page + 1 : 1,
      Size: Math.min(params.size || 100, 100),
    };
    const { data } = await this.client.post('/order/getOrdersForApi', body, { headers });
    return data?.data || [];
  }

  async getOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders();
    const { data } = await this.client.get(`/order/getOrder/${orderId}`, { headers });
    return data?.data || data;
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