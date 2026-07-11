import { IntegrationInterface } from '../IntegrationInterface';
import { mapToN11Product } from './mapper';
import { ProductData, StockUpdate, PriceUpdate, Order } from '../../types';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const SOAP_ENDPOINT = 'https://api.n11.com/wsdl/SellerProductService.wsdl';

interface N11Credentials {
  username: string;
  password: string;
}

export class N11IntegrationService extends IntegrationInterface {
  private creds: N11Credentials;
  private parser: XMLParser;

  constructor(username: string, password: string) {
    super('n11');
    this.creds = { username, password };
    this.parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  }

  private soapEnvelope(body: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/wsdl">
  <soapenv:Header/>
  <soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`;
  }

  private authNode(): string {
    return `<auth>
      <username>${this.creds.username}</username>
      <password>${this.creds.password}</password>
    </auth>`;
  }

  private async call(operation: string, bodyInner: string): Promise<any> {
    const envelope = this.soapEnvelope(`<${operation}>${bodyInner}</${operation}>`);
    const res = await axios.post(SOAP_ENDPOINT, envelope, {
      timeout: 30_000,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `http://www.n11.com/wsdl/${operation}`,
      },
    });
    return this.parser.parse(res.data);
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const body = `<productCreate>
        ${this.authNode()}
        <product>
          <productSellerCode>${data.sku}</productSellerCode>
          <title>${data.name}</title>
          <description>${data.description}</description>
          <price>${data.price}</price>
          <currencyType>${data.currency}</currencyType>
        </product>
      </productCreate>`;
      const parsed = await this.call('ProductCreate', body);
      const result = parsed?.Envelope?.Body?.ProductCreateResponse?.result;
      if (result?.status !== 'success') {
        return { success: false, error: `N11 ProductCreate: ${result?.errorMessage ?? 'failed'}` };
      }
      return { success: true, marketplaceId: String(result?.productId ?? '') };
    } catch (err) {
      return { success: false, error: `N11 sendProduct: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      const body = `<updateStockByProductSellerCode>
        ${this.authNode()}
        <productSellerCode>${sku}</productSellerCode>
        <stockItem>
          <quantity>${quantity}</quantity>
        </stockItem>
      </updateStockByProductSellerCode>`;
      const parsed = await this.call('UpdateStockByProductSellerCode', body);
      const result = parsed?.Envelope?.Body?.UpdateStockByProductSellerCodeResponse?.result;
      return { success: result?.status === 'success', error: result?.errorMessage };
    } catch (err) {
      return { success: false, error: `N11 updateStock: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      const body = `<updateProductPriceByProductSellerCode>
        ${this.authNode()}
        <productSellerCode>${sku}</productSellerCode>
        <price>${price}</price>
        <currencyType>${currency}</currencyType>
      </updateProductPriceByProductSellerCode>`;
      const parsed = await this.call('UpdateProductPriceByProductSellerCode', body);
      const result = parsed?.Envelope?.Body?.UpdateProductPriceByProductSellerCodeResponse?.result;
      return { success: result?.status === 'success', error: result?.errorMessage };
    } catch (err) {
      return { success: false, error: `N11 updatePrice: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    try {
      const params = sinceDate ? `<pagination><page>1</page><pageSize>50</pageSize></pagination>` : '';
      const body = `<orderList ${sinceDate ? `startDate="${sinceDate}"` : ''}>
        ${this.authNode()}
        ${params}
      </orderList>`;
      const parsed = await this.call('OrderList', body);
      const orders = parsed?.Envelope?.Body?.OrderListResponse?.orderList?.order ?? [];
      const arr = Array.isArray(orders) ? orders : [orders];
      return arr.map((o: any) => ({
        id: String(o.id ?? ''),
        marketplace: 'n11',
        status: o.status ?? '',
        items: (o.items?.item ?? []).map((i: any) => ({
          sku: i.productSellerCode ?? i.productId ?? '',
          name: i.title ?? '',
          quantity: Number(i.quantity ?? 0),
          price: Number(i.price ?? 0),
        })),
        customer: { name: o.customerName ?? '', email: o.customerEmail ?? '' },
        createdAt: o.orderDate ?? '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`N11 fetchOrders failed: ${message}`);
    }
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const body = `<getProductList>
        ${this.authNode()}
        <pagination>
          <page>${page + 1}</page>
          <pageSize>50</pageSize>
        </pagination>
      </getProductList>`;
      const parsed = await this.call('GetProductList', body);
      const response = parsed?.Envelope?.Body?.GetProductListResponse;
      const productList = response?.productList?.product ?? [];
      const arr = Array.isArray(productList) ? productList : productList ? [productList] : [];
      if (!arr.length) return [];
      return arr.map(mapToN11Product);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`N11 fetchProducts failed: ${message}`);
    }
  }
}
