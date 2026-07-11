import { IntegrationInterface } from '../IntegrationInterface';
import { mapToAmazonProduct } from './mapper';
import { getLwaAccessToken, signRequest, AwsCredentials, LwaCredentials } from './sigv4';
import { ProductData, StockUpdate, PriceUpdate, Order } from '../../types';
import axios from 'axios';

interface AmazonConfig {
  refreshToken: string;
  lwaClientId: string;
  lwaClientSecret: string;
  awsAccessKey: string;
  awsSecretKey: string;
  sellerId: string;
  marketplaceId: string;
  region?: string;
}

const MARKETPLACE_TR = 'A1O49J7X5Y7RJA';
const DEFAULT_REGION = 'eu-west-1';
const SERVICE = 'execute-api';

export class AmazonSpApiIntegrationService extends IntegrationInterface {
  private cfg: AmazonConfig;
  private region: string;

  constructor(config: AmazonConfig) {
    super('amazon');
    this.cfg = config;
    this.region = config.region || DEFAULT_REGION;
  }

  private serviceBase(): string {
    return `https://sellingpartnerapi-${this.region}.amazon.com`;
  }

  private awsCreds(): AwsCredentials {
    return {
      accessKeyId: this.cfg.awsAccessKey,
      secretAccessKey: this.cfg.awsSecretKey,
    };
  }

  private async signedGet(path: string, query: Record<string, string> = {}): Promise<any> {
    const base = this.serviceBase();
    const queryString = new URLSearchParams(query).toString();
    const url = `${base}${path}${queryString ? `?${queryString}` : ''}`;
    const accessToken = await getLwaAccessToken(this.lwaCreds());
    const signed = signRequest('GET', url, this.region, SERVICE, this.awsCreds(), accessToken, '');
    const res = await axios.get(signed.url, { headers: signed.headers, timeout: 30_000 });
    return res.data;
  }

  private lwaCreds(): LwaCredentials {
    return {
      refreshToken: this.cfg.refreshToken,
      clientId: this.cfg.lwaClientId,
      clientSecret: this.cfg.lwaClientSecret,
    };
  }

  async sendProduct(data: ProductData): Promise<{ success: boolean; marketplaceId?: string; error?: string }> {
    try {
      const accessToken = await getLwaAccessToken(this.lwaCreds());
      const path = `/listings/2021-08-01/items/${this.cfg.sellerId}/${encodeURIComponent(data.sku)}`;
      const url = `${this.serviceBase()}${path}`;
      const signed = signRequest(
        'PUT',
        url,
        this.region,
        SERVICE,
        this.awsCreds(),
        accessToken,
        ''
      );
      await axios.put(signed.url, { productType: 'PRODUCT', ...data }, { headers: signed.headers });
      return { success: true, marketplaceId: data.sku };
    } catch (err) {
      return { success: false, error: `Amazon sendProduct: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updateStock(sku: string, quantity: number): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await getLwaAccessToken(this.lwaCreds());
      const path = `/listings/2021-08-01/items/${this.cfg.sellerId}/${encodeURIComponent(sku)}`;
      const url = `${this.serviceBase()}${path}`;
      const signed = signRequest('POST', url, this.region, SERVICE, this.awsCreds(), accessToken, '');
      await axios.post(signed.url, { quantity }, { headers: signed.headers });
      return { success: true };
    } catch (err) {
      return { success: false, error: `Amazon updateStock: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async updatePrice(sku: string, price: number, currency: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await getLwaAccessToken(this.lwaCreds());
      const path = `/listings/2021-08-01/items/${this.cfg.sellerId}/${encodeURIComponent(sku)}`;
      const url = `${this.serviceBase()}${path}`;
      const signed = signRequest('POST', url, this.region, SERVICE, this.awsCreds(), accessToken, '');
      await axios.post(signed.url, { price: { amount: price, currencyCode: currency } }, { headers: signed.headers });
      return { success: true };
    } catch (err) {
      return { success: false, error: `Amazon updatePrice: ${err instanceof Error ? err.message : 'Unknown'}` };
    }
  }

  async fetchOrders(sinceDate?: string): Promise<Order[]> {
    try {
      const query: Record<string, string> = { MarketplaceIds: this.cfg.marketplaceId || MARKETPLACE_TR };
      if (sinceDate) query.CreatedAfter = sinceDate;
      const data = await this.signedGet('/orders/v0/orders', query);
      const raw = (data?.Orders ?? []) as any[];
      return raw.map((o) => ({
        id: String(o.AmazonOrderId ?? ''),
        marketplace: 'amazon',
        status: o.OrderStatus ?? '',
        items: [],
        customer: { name: o.BuyerInfo?.BuyerEmail ?? '', email: o.BuyerInfo?.BuyerEmail ?? '' },
        createdAt: o.PurchaseDate ?? '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Amazon fetchOrders failed: ${message}`);
    }
  }

  async fetchProducts(page: number = 0): Promise<ProductData[]> {
    try {
      const marketplaceId = this.cfg.marketplaceId || MARKETPLACE_TR;
      const listQuery: Record<string, string> = {
        marketplaceIds: marketplaceId,
        includedData: 'summaries,offers,attributeSummaries',
        pageSize: '20',
      };
      if (page > 0) {
        // Amazon uses pagination token; for simplicity we only fetch first page here.
      }

      const listData = await this.signedGet('/listings/2021-08-01/items', listQuery);
      const items = (listData?.items ?? []) as any[];
      if (!items.length) return [];

      const products: ProductData[] = [];
      for (const item of items.slice(0, 20)) {
        try {
          const asin = item.asin ?? item.summaries?.[0]?.asin;
          let catalog: any = {};
          if (asin) {
            catalog = await this.signedGet(`/catalog/2022-04-01/items/${asin}`, {
              marketplaceIds: marketplaceId,
              includedData: 'attributes,images,summaries',
            });
          }
          products.push(mapToAmazonProduct(item, catalog));
        } catch {
          products.push(mapToAmazonProduct(item));
        }
      }
      return products;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`Amazon fetchProducts failed: ${message}`);
    }
  }
}
