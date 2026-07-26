import {
  TrendyolClient,
  N11Client,
  HepsiburadaClient,
  PazaramaClient,
  AmazonClient,
  EtsyClient,
} from './marketplaceClients.js';
import { logger } from './logger.js';

export interface MarketplaceCredentials {
  marketplace: string;
  storeId: number;
  config: Record<string, any>;
}

export function createMarketplaceClient(mp: string, config: Record<string, any>): any {
  switch (mp) {
    case 'trendyol':
      return new TrendyolClient({
        apiKey: config.apiKey || '',
        apiSecret: config.apiSecret || '',
        supplierId: config.supplierId || '',
      });
    case 'n11':
      return new N11Client({
        appKey: config.appKey || '',
        appSecret: config.appSecret || '',
      });
    case 'hepsiburada':
      return new HepsiburadaClient({
        username: config.username || '',
        password: config.password || '',
        merchantId: config.merchantId || '',
      });
    case 'pazarama':
      return new PazaramaClient({
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        apiKey: config.apiKey || '',
      });
    case 'amazon':
      return new AmazonClient({
        refreshToken: config.refreshToken || '',
        lwaClientId: config.lwaClientId || '',
        lwaClientSecret: config.lwaClientSecret || '',
        awsAccessKey: config.awsAccessKey || '',
        awsSecretKey: config.awsSecretKey || '',
        sellerId: config.sellerId || '',
        marketplaceId: config.marketplaceId || '',
      });
    case 'etsy':
      return new EtsyClient({
        clientId: config.clientId || '',
        clientSecret: config.clientSecret || '',
        redirectUri: config.redirectUri || '',
        accessToken: config.accessToken || '',
        refreshToken: config.refreshToken || '',
      });
    default:
      throw new Error(`Unknown marketplace: ${mp}`);
  }
}