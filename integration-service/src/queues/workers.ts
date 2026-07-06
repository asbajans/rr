import { Worker } from 'bullmq';
import { TrendyolIntegrationService } from '../integrations/trendyol/TrendyolIntegrationService';
import { connection } from './queueManager';
import { ProductData, StockUpdate } from '../types';

const TRENDYOL_API_KEY = process.env.TRENDYOL_API_KEY || '';
const TRENDYOL_API_SECRET = process.env.TRENDYOL_API_SECRET || '';
const TRENDYOL_SUPPLIER_ID = process.env.TRENDYOL_SUPPLIER_ID || '';

let trendyol: TrendyolIntegrationService | null = null;

function getTrendyol(): TrendyolIntegrationService {
  if (!trendyol) {
    trendyol = new TrendyolIntegrationService(
      TRENDYOL_API_KEY,
      TRENDYOL_API_SECRET,
      TRENDYOL_SUPPLIER_ID
    );
  }
  return trendyol;
}

const productWorker = new Worker(
  'product-push-queue',
  async (job) => {
    const data = job.data as ProductData;
    const result = await getTrendyol().sendProduct(data);
    if (!result.success) {
      throw new Error(result.error || 'Product push failed');
    }
    console.log(`Product ${data.sku} pushed to Trendyol, id: ${result.marketplaceId}`);
  },
  { connection, concurrency: 3 }
);

const stockWorker = new Worker(
  'stock-sync-queue',
  async (job) => {
    const data = job.data as StockUpdate;
    await getTrendyol().updateStock(data.sku, data.quantity);
    console.log(`Stock updated for ${data.sku}: ${data.quantity}`);
  },
  { connection, concurrency: 5 }
);

productWorker.on('failed', (job, err) => {
  console.error(`Product worker failed (job ${job?.id}): ${err.message}`);
});

stockWorker.on('failed', (job, err) => {
  console.error(`Stock worker failed (job ${job?.id}): ${err.message}`);
});

export function startWorkers(): void {
  console.log('BullMQ workers started');
}
