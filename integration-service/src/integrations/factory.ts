import { TrendyolIntegrationService } from './trendyol/TrendyolIntegrationService';
import { HepsiburadaIntegrationService } from './hepsiburada/HepsiburadaIntegrationService';
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
  if (hbUsername && hbPassword) {
    list.push(new HepsiburadaIntegrationService(hbUsername, hbPassword));
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
      if (!username || !password) return null;
      return new HepsiburadaIntegrationService(username, password);
    }
    default:
      return null;
  }
}
