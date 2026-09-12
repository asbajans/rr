import { MarketplaceClient } from './base.js';
import { TrendyolClient, type TrendyolConfig } from './trendyol.js';
import { HepsiburadaClient, type HepsiburadaConfig } from './hepsiburada.js';
import { N11Client, type N11Config } from './n11.js';
import { PazaramaClient, type PazaramaConfig } from './pazarama.js';
import { AmazonClient, type AmazonConfig } from './amazon.js';
import { EtsyClient, type EtsyConfig } from './etsy.js';
import { FacebookClient, InstagramClient, type MetaConfig } from './facebook.js';

export type MarketplaceType = 'trendyol' | 'hepsiburada' | 'pazarama' | 'n11' | 'amazon' | 'etsy' | 'facebook' | 'instagram';

export type MarketplaceConfig = 
  | { type: 'trendyol'; config: TrendyolConfig }
  | { type: 'hepsiburada'; config: HepsiburadaConfig }
  | { type: 'pazarama'; config: PazaramaConfig }
  | { type: 'n11'; config: N11Config }
  | { type: 'amazon'; config: AmazonConfig }
  | { type: 'etsy'; config: EtsyConfig }
  | { type: 'facebook'; config: MetaConfig }
  | { type: 'instagram'; config: MetaConfig };

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
    case 'facebook':
      return new FacebookClient(config as MetaConfig);
    case 'instagram':
      return new InstagramClient(config as MetaConfig);
    default:
      throw new Error(`Unknown marketplace: ${marketplace}`);
  }
}

export async function getMarketplaceConfig(marketplace: MarketplaceType, integration: any): Promise<any> {
  const baseConfig = integration?.config || {};
  
  // helper to read global Setting fallback for Amazon (superadmin > Global API Settings)
  async function getAmazonGlobals(): Promise<Record<string, string>> {
    try {
      const { Setting } = await import('../../models/Setting.model.js');
      const keys = ['amazon_lwa_client_id','amazon_lwa_client_secret','amazon_aws_access_key','amazon_aws_secret_key','amazon_iam_role_arn','amazon_application_id','amazon_marketplace_id','amazon_aws_region'];
      const rows = await Setting.findAll({ where: { key: keys } as any });
      const map: Record<string, string> = {};
      for (const r of rows) map[(r as any).key] = String((r as any).value || '');
      return map;
    } catch { return {}; }
  }

  switch (marketplace) {
    case 'trendyol':
      return {
        apiKey: baseConfig.apiKey || process.env.TRENDYOL_API_KEY,
        apiSecret: baseConfig.apiSecret || process.env.TRENDYOL_API_SECRET,
        supplierId: baseConfig.supplierId || process.env.TRENDYOL_SUPPLIER_ID,
        cariId: baseConfig.cariId || baseConfig.saticiId || undefined,
        integrationRefCode: baseConfig.integrationRefCode || baseConfig.entegrasyonReferansKodu || undefined,
        token: baseConfig.token || undefined,
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
    case 'amazon': {
      const globals = await getAmazonGlobals();
      return {
        refreshToken: baseConfig.refreshToken || process.env.AMAZON_REFRESH_TOKEN || '',
        lwaClientId: baseConfig.lwaClientId || baseConfig.lwa_client_id || globals.amazon_lwa_client_id || process.env.AMAZON_LWA_CLIENT_ID || '',
        lwaClientSecret: baseConfig.lwaClientSecret || baseConfig.lwa_client_secret || globals.amazon_lwa_client_secret || process.env.AMAZON_LWA_CLIENT_SECRET || '',
        awsAccessKey: baseConfig.awsAccessKey || baseConfig.aws_access_key || globals.amazon_aws_access_key || process.env.AMAZON_AWS_ACCESS_KEY || '',
        awsSecretKey: baseConfig.awsSecretKey || baseConfig.aws_secret_key || globals.amazon_aws_secret_key || process.env.AMAZON_AWS_SECRET_KEY || '',
        sellerId: baseConfig.sellerId || baseConfig.seller_id || process.env.AMAZON_SELLER_ID || '',
        marketplaceId: baseConfig.marketplaceId || baseConfig.marketplace_id || globals.amazon_marketplace_id || process.env.AMAZON_MARKETPLACE_ID || 'A33AVAJ2PDY3EV',
        region: baseConfig.region || globals.amazon_aws_region || process.env.AMAZON_AWS_REGION || 'eu-west-1',
        applicationId: baseConfig.applicationId || globals.amazon_application_id || process.env.AMAZON_APPLICATION_ID || '',
        iamRoleArn: baseConfig.iamRoleArn || globals.amazon_iam_role_arn || process.env.AMAZON_IAM_ROLE_ARN || '',
      };
    }
    case 'etsy':
      return {
        clientId: baseConfig.clientId || process.env.ETSY_CLIENT_ID,
        clientSecret: baseConfig.clientSecret || process.env.ETSY_CLIENT_SECRET,
        redirectUri: baseConfig.redirectUri || process.env.ETSY_REDIRECT_URI,
        accessToken: baseConfig.accessToken,
        refreshToken: baseConfig.refreshToken,
        tokenExpiry: baseConfig.tokenExpiry,
      };
    case 'facebook':
    case 'instagram':
      return {
        appId: baseConfig.appId || process.env.META_APP_ID || '1427365415966697',
        appSecret: baseConfig.appSecret || process.env.META_APP_SECRET,
        accessToken: baseConfig.userAccessToken || baseConfig.accessToken,
        userAccessToken: baseConfig.userAccessToken || baseConfig.accessToken,
        tokenExpiry: baseConfig.tokenExpiry,
        pageId: baseConfig.pageId,
        pageName: baseConfig.pageName,
        pageAccessToken: baseConfig.pageAccessToken,
        igUserId: baseConfig.igUserId,
        igUsername: baseConfig.igUsername,
        catalogId: baseConfig.catalogId,
        catalogName: baseConfig.catalogName,
        businessId: baseConfig.businessId,
        storefrontBase: baseConfig.storefrontBase,
      };
    default:
      return {};
  }
}