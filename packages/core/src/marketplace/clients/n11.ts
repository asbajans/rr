import { BaseMarketplaceClient, MarketplaceClient, generateHmacSHA256 } from './base.js';

export interface N11Config {
  appKey: string;
  appSecret: string;
}

export class N11Client extends BaseMarketplaceClient implements MarketplaceClient {
  private config: N11Config;

  constructor(config: N11Config) {
    super('https://api.n11.com/ws', { 'Content-Type': 'application/xml' });
    this.config = config;
  }

  private signRequest(xml: string): string {
    return generateHmacSHA256(xml, this.config.appSecret);
  }

  private async requestWithAuth<T>(action: string, body: string): Promise<T> {
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
<env:Header>
<ns1:auth xmlns:ns1="http://www.n11.com/ws/schemas">
<appKey>${this.config.appKey}</appKey>
<timeStamp>${new Date().toISOString()}</timeStamp>
<signature>${this.signRequest(body)}</signature>
</ns1:auth>
</env:Header>
<env:Body>
${body}
</env:Body>
</env:Envelope>`;

    const response = await this.client.post<{ data: T }>('', envelope, { params: { ws: action } });
    return response.data.data;
  }

  async getCategories(): Promise<any[]> {
    try {
      const body = '<categoryService><categoryListRequest><page>1</page><pageSize>1000</pageSize></categoryListRequest></categoryService>';
      const data = await this.requestWithAuth<any>('CategoryServicePort', body);
      return data?.categoryList?.category || [];
    } catch {
      return [];
    }
  }

  async getProducts(params: any = {}): Promise<{ products: any[]; hasMore: boolean }> {
    const body = `<productService>
<productRequest>
<page>${params.page || 1}</page>
<pageSize>${params.size || 50}</pageSize>
</productRequest>
</productService>`;
    const data = await this.requestWithAuth<any>('ProductServicePort', body);
    return { products: data?.productList?.product || [], hasMore: false };
  }

  async createProduct(product: any): Promise<any> {
    const body = `<productService>
<product>${this.serializeProduct(product)}</product>
</productService>`;
    return this.requestWithAuth<any>('ProductServicePort', body);
  }

  async updateProduct(productId: string, product: any): Promise<any> {
    return this.createProduct(product);
  }

  async updatePrice(productId: string, price: number): Promise<any> {
    const body = `<productService>
<productId>${productId}</productId>
<price>${price}</price>
</productService>`;
    return this.requestWithAuth<any>('ProductServicePort', body);
  }

  async updateStock(productId: string, quantity: number): Promise<any> {
    const body = `<productService>
<productId>${productId}</productId>
<quantity>${quantity}</quantity>
</productService>`;
    return this.requestWithAuth<any>('ProductServicePort', body);
  }

  async getOrders(params: any = {}): Promise<any[]> {
    try {
      const body = `<orderService><orderListRequest><page>${params.page || 1}</page><pageSize>${params.size || 50}</pageSize></orderListRequest></orderService>`;
      const data = await this.requestWithAuth<any>('OrderServicePort', body);
      return data?.orderList?.order || [];
    } catch {
      return [];
    }
  }

  async getOrder(orderId: string): Promise<any> {
    try {
      const body = `<orderService><orderDetailRequest><orderId>${orderId}</orderId></orderDetailRequest></orderService>`;
      return this.requestWithAuth<any>('OrderServicePort', body);
    } catch {
      return null;
    }
  }

  private serializeProduct(product: any): string {
    return `<title>${product.title}</title><subtitle>${product.subtitle || ''}</subtitle>
<description>${product.description || ''}</description><categoryId>${product.categoryId}</categoryId>
<price>${product.price}</price><quantity>${product.quantity}</quantity>
<stockCode>${product.sku}</stockCode><currencyType>TRY</currencyType>`;
  }
}

export function createN11Client(config: N11Config): N11Client {
  return new N11Client(config);
}