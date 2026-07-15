import { Worker } from 'bullmq';
import { createIntegration, getIntegrations } from '../integrations/factory';
import { IntegrationInterface } from '../integrations/IntegrationInterface';
import { connection } from './queueManager';
import { ProductData, StockUpdate } from '../types';
import { sendPushNotification } from '../services/fcm';

interface ProductPushData extends ProductData {
  marketplaces?: { marketplace: string; config: Record<string, string> }[];
}

const productWorker = new Worker(
  'product-push-queue',
  async (job) => {
    const data = job.data as ProductPushData;
    const marketplaceConfigs = Array.isArray(data.marketplaces) ? data.marketplaces : [];
    const integrations: IntegrationInterface[] = marketplaceConfigs
      .map((m) => createIntegration(m.marketplace, m.config ?? {}))
      .filter((i): i is IntegrationInterface => i !== null);
    if (integrations.length === 0) {
      throw new Error('No marketplace integration configured');
    }

    const results = await Promise.all(
      integrations.map(async (integration) => {
        const result = await integration.sendProduct(data);
        return { name: integration.name, result };
      })
    );

    const failed = results.find((r) => !r.result.success);
    if (failed) {
      throw new Error(failed.result.error || `Product push to ${failed.name} failed`);
    }

    const ids = results
      .map((r) => `${r.name}:${r.result.marketplaceId ?? '?'}`)
      .join(', ');
    console.log(`Product ${data.sku} pushed [${ids}]`);

    if (data.siteCode) {
      await sendPushNotification(
        `vendor_${data.vendorId}`,
        'Ürün Yayınlandı',
        `${data.name} ${results.map((r) => r.name).join(', ')} üzerinde yayınlandı.`,
        { type: 'product_published', sku: data.sku, marketplaces: results.map((r) => r.name).join(', ') }
      );
    }
  },
  { connection: connection as any, concurrency: 3 }
);

const stockWorker = new Worker(
  'stock-sync-queue',
  async (job) => {
    const data = job.data as StockUpdate;
    const integrations = getIntegrations();
    if (integrations.length === 0) {
      throw new Error('No marketplace integration configured');
    }

    if (data.type === 'price_update') {
      await Promise.all(
        integrations.map((integration) =>
          integration.updatePrice(data.sku, data.price ?? 0, 'TRY')
        )
      );
      console.log(`Price updated for ${data.sku}`);
      return;
    }

    await Promise.all(integrations.map((integration) => integration.updateStock(data.sku, data.quantity)));
    console.log(`Stock updated for ${data.sku}: ${data.quantity}`);
  },
  { connection: connection as any, concurrency: 5 }
);

productWorker.on('failed', async (job, err) => {
  console.error(`Product worker failed (job ${job?.id}): ${err.message}`);
  const data = job?.data as ProductData | undefined;
  if (data?.siteCode) {
    await sendPushNotification(
      `vendor_${data.vendorId}`,
      'Ürün Yayınlanamadı',
      `${data.name} gönderilirken hata: ${err.message}`,
      { type: 'product_failed', sku: data.sku, marketplaces: getIntegrations().map((i) => i.name).join(', ') }
    );
  }
});

stockWorker.on('failed', (job, err) => {
  console.error(`Stock worker failed (job ${job?.id}): ${err.message}`);
});

export function startWorkers(): void {
  console.log('BullMQ workers started');
}
