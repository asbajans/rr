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
