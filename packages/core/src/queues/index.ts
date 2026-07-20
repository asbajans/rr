import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env.js';

export const syncQueue = new Queue('product-sync', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 },
});

export const importQueue = new Queue('marketplace-import', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 50, removeOnFail: 20 },
});

export const webhookQueue = new Queue('webhook-processing', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 200, removeOnFail: 100 },
});

interface SyncJobData {
  productId: number;
  storeId: number;
  marketplaces: string[];
  trigger: 'create' | 'update' | 'manual';
}

interface ImportJobData {
  marketplace: string;
  storeId: number;
  maxPages: number;
}

export async function createSyncWorker() {
  return new Worker<SyncJobData>(
    'product-sync',
    async (job: Job<SyncJobData>) => {
      const { productId, storeId, marketplaces, trigger } = job.data;
      console.log(`[Worker] Syncing product ${productId} to ${marketplaces.join(', ')} (trigger: ${trigger})`);
      return { success: true, productId, marketplaces };
    },
    { connection: { url: config.redis.url } }
  );
}

export async function createImportWorker() {
  return new Worker<ImportJobData>(
    'marketplace-import',
    async (job: Job<ImportJobData>) => {
      const { marketplace, storeId, maxPages } = job.data;
      console.log(`[Worker] Importing from ${marketplace} for store ${storeId} (${maxPages} pages)`);
      return { success: true, marketplace, imported: 0 };
    },
    { connection: { url: config.redis.url } }
  );
}

export async function createOrderWorker() {
  return new Worker(
    'webhook-processing',
    async (job: Job) => {
      console.log('[Worker] Processing webhook:', job.name);
      return { success: true };
    },
    { connection: { url: config.redis.url } }
  );
}

export async function createStockWorker() {
  return new Worker(
    'webhook-processing',
    async (job: Job) => {
      console.log('[Worker] Processing stock update:', job.name);
      return { success: true };
    },
    { connection: { url: config.redis.url } }
  );
}

export async function createPriceWorker() {
  return new Worker(
    'webhook-processing',
    async (job: Job) => {
      console.log('[Worker] Processing price update:', job.name);
      return { success: true };
    },
    { connection: { url: config.redis.url } }
  );
}