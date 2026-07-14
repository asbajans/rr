import { TrendyolIntegrationService } from './trendyol/TrendyolIntegrationService';
import { HepsiburadaIntegrationService } from './hepsiburada/HepsiburadaIntegrationService';
import { PazaramaIntegrationService } from './pazarama/PazaramaIntegrationService';
import { N11IntegrationService } from './n11/N11IntegrationService';
import { AmazonSpApiIntegrationService } from './amazon/AmazonSpApiIntegrationService';
import { IntegrationInterface } from './IntegrationInterface';

export function getIntegrations(): IntegrationInterface[] {
  const list: IntegrationInterface[] = [];

  const trendyolKey = process.env.TRENDYOL_API_KEY;
  const trendyolSecret = process.env.TRENDYOL_API_SECRET;
  const trendyolSupplier = process.env.TRENDYOL_SUPPLIER_ID;

  if (trendyolKey && trendyolSecret && trendyolSupplier) {
    list.push(new TrendyolIntegrationService(trendyolKey, trendyolSecret, trendyolSupplier));
  }

  const hbUsername = process.env.HB_USERNAME;
  const hbPassword = process.env.HB_PASSWORD;
  const hbMerchantId = process.env.HB_MERCHANT_ID;
  if (hbUsername && hbPassword && hbMerchantId) {
    list.push(new HepsiburadaIntegrationService(hbUsername, hbPassword, hbMerchantId));
  }

  return list;
}

export function createIntegration(
  marketplace: string,
  config: Record<string, string>
): IntegrationInterface | null {
  switch (marketplace) {
    case 'trendyol': {
      const apiKey = config.api_key || config.apiKey;
      const apiSecret = config.api_secret || config.apiSecret;
      const supplierId = config.supplier_id || config.supplierId;
      if (!apiKey || !apiSecret || !supplierId) return null;
      return new TrendyolIntegrationService(apiKey, apiSecret, supplierId);
    }
    case 'hepsiburada': {
      const username = config.username;
      const password = config.password;
      const merchantId = config.merchant_id || config.merchantId;
      if (!username || !password || !merchantId) return null;
      return new HepsiburadaIntegrationService(username, password, merchantId);
    }
    case 'pazarama': {
      const clientId = config.client_id || config.clientId;
      const clientSecret = config.client_secret || config.clientSecret;
      const apiKey = config.api_key || config.apiKey;
      if (!clientId || !clientSecret || !apiKey) return null;
      return new PazaramaIntegrationService(clientId, clientSecret, apiKey);
    }
    case 'n11': {
      const appkey = config.appkey || config.api_key || config.apiKey;
      const appsecret = config.appsecret || config.api_secret || config.apiSecret;
      if (!appkey || !appsecret) return null;
      return new N11IntegrationService(appkey, appsecret);
    }
    case 'amazon': {
      const refreshToken = config.refresh_token || config.refreshToken;
      const lwaClientId = config.lwa_client_id || config.lwaClientId;
      const lwaClientSecret = config.lwa_client_secret || config.lwaClientSecret;
      const awsAccessKey = config.aws_access_key || config.awsAccessKey;
      const awsSecretKey = config.aws_secret_key || config.awsSecretKey;
      const sellerId = config.seller_id || config.sellerId;
      if (!refreshToken || !lwaClientId || !lwaClientSecret || !awsAccessKey || !awsSecretKey || !sellerId) {
        return null;
      }
      return new AmazonSpApiIntegrationService({
        refreshToken,
        lwaClientId,
        lwaClientSecret,
        awsAccessKey,
        awsSecretKey,
        sellerId,
        marketplaceId: config.marketplace_id || config.marketplaceId || 'A1O49J7X5Y7RJA',
        region: config.region,
      });
    }
    default:
      return null;
  }
}
