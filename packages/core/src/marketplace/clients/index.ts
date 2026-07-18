import { MarketplaceClient } from './base.js';
import { TrendyolClient, type TrendyolConfig } from './trendyol.js';
import { HepsiburadaClient, type HepsiburadaConfig } from './hepsiburada.js';
import { N11Client, type N11Config } from './n11.js';
import { PazaramaClient, type PazaramaConfig } from './pazarama.js';
import { AmazonClient, type AmazonConfig } from './amazon.js';
import { EtsyClient, type EtsyConfig } from './etsy.js';

export type MarketplaceType = 'trendyol' | 'hepsiburada' | 'pazarama' | 'n11' | 'amazon' | 'etsy';

export type MarketplaceConfig = 
  | { type: 'trendyol'; config: TrendyolConfig }
  | { type: 'hepsiburada'; config: HepsiburadaConfig }
  | { type: 'pazarama'; config: PazaramaConfig }
  | { type: 'n11'; config: N11Config }
  | { type: 'amazon'; config: AmazonConfig }
  | { type: 'etsy'; config: EtsyConfig };

export function createMarketplaceClient(marketplace: MarketplaceType, config: any): MarketplaceClient {
  switch (marketplace) {
    case 'trendyol':
      return new TrendyolClient(config as TrendyolConfig);
    case 'hepsiburada':
      return new HepsiburadaClient(config as HepsiburadaConfig);
    case 'pazarama':
      return new PazaramaClient(config as PazaramaConfig);
    case 'n11':
      return new N11Client(config as N11Config);
    case 'amazon':
      return new AmazonClient(config as AmazonConfig);
    case 'etsy':
      return new EtsyClient(config as EtsyConfig);
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}

export function getMarketplaceConfig(marketplace: MarketplaceType, integration: any): any {
  const baseConfig = integration.config || {};
  
  switch (marketplace) {
    case 'trendyol':
      return {
        apiKey: baseConfig.apiKey || process.env.TRENDYOL_API_KEY,
        apiSecret: baseConfig.apiSecret || process.env.TRENDYOL_API_SECRET,
        supplierId: baseConfig.supplierId || process.env.TRENDYOL_SUPPLIER_ID,
      };
    case 'hepsiburada':
      return {
        username: baseConfig.username || process.env.HEPSIBURADA_USERNAME,
        password: baseConfig.password || process.env.HEPSIBURADA_PASSWORD,
        merchantId: baseConfig.merchantId || process.env.HEPSIBURADA_MERCHANT_ID,
      };
    case 'pazarama':
      return {
        clientId: baseConfig.clientId || process.env.PAZARAMA_CLIENT_ID,
        clientSecret: baseConfig.clientSecret || process.env.PAZARAMA_CLIENT_SECRET,
        apiKey: baseConfig.apiKey || process.env.PAZARAMA_API_KEY,
      };
    case 'n11':
      return {
        appKey: baseConfig.appKey || process.env.N11_APPKEY,
        appSecret: baseConfig.appSecret || process.env.N11_APPSECRET,
      };
    case 'amazon':
      return {
        refreshToken: baseConfig.refreshToken || process.env.AMAZON_REFRESH_TOKEN,
        lwaClientId: baseConfig.lwaClientId || process.env.AMAZON_LWA_CLIENT_ID,
        lwaClientSecret: baseConfig.lwaClientSecret || process.env.AMAZON_LWA_CLIENT_SECRET,
        awsAccessKey: baseConfig.awsAccessKey || process.env.AMAZON_AWS_ACCESS_KEY,
        awsSecretKey: baseConfig.awsSecretKey || process.env.AMAZON_AWS_SECRET_KEY,
        sellerId: baseConfig.sellerId || process.env.AMAZON_SELLER_ID,
        marketplaceId: baseConfig.marketplaceId || 'A1F83G8C2ARO7P',
      };
    case 'etsy':
      return {
        clientId: baseConfig.clientId || process.env.ETSY_CLIENT_ID,
        clientSecret: baseConfig.clientSecret || process.env.ETSY_CLIENT_SECRET,
        redirectUri: baseConfig.redirectUri || process.env.ETSY_REDIRECT_URI,
        accessToken: baseConfig.accessToken,
        refreshToken: baseConfig.refreshToken,
        tokenExpiry: baseConfig.tokenExpiry,
      };
    default:
      return {};
  }
}