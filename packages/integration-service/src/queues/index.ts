import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

export const importQueue = new Queue('import', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

export const orderQueue = new Queue('order', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
});

export const stockQueue = new Queue('stock', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

export const priceQueue = new Queue('price', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

export const syncQueue = new Queue('sync', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});

async function createImportWorker() {
  return new Worker(
    'import',
    async (job: Job) => {
      const { marketplace, maxPages } = job.data;
      console.log(`Starting import from ${marketplace} (max ${maxPages} pages)`);
      
      const coreClient = axios.create({
        baseURL: config.coreApiUrl,
        headers: { 'x-internal-key': config.coreApiKey },
      });
      
      let imported = 0, failed = 0;
      
      for (let page = 1; page <= maxPages; page++) {
        await job.updateProgress(Math.round((page / maxPages) * 100));
        try {
          const response = await coreClient.post('/api/admin/marketplace/import', { marketplace, page });
          imported += response.data.imported || 0;
          failed += response.data.failed || 0;
          if (response.data.hasMore === false) break;
        } catch (err: any) {
          console.error(`Import page ${page} failed:`, err.message);
          failed++;
        }
      }
      
      return { imported, failed, marketplace };
    },
    { connection: { url: config.redis.url } }
  );
}

async function createSyncWorker() {
  return new Worker(
    'sync',
    async (job: Job) => {
      const { productId, marketplaces, trigger } = job.data;
      console.log(`Syncing product ${productId} to ${marketplaces?.join(', ') || 'all'} (${trigger})`);
      
      const coreClient = axios.create({
        baseURL: config.coreApiUrl,
        headers: { 'x-internal-key': config.coreApiKey },
      });
      
      const response = await coreClient.post(`/api/admin/products/${productId}/sync`, { marketplaces });
      return response.data;
    },
    { connection: { url: config.redis.url } }
  );
}

async function createOrderWorker() {
  return new Worker(
    'order',
    async (job: Job) => {
      const { marketplace, payload } = job.data;
      console.log(`Processing ${marketplace} order`);
      
      const coreClient = axios.create({
        baseURL: config.coreApiUrl,
        headers: { 'x-internal-key': config.coreApiKey },
      });
      
      const response = await coreClient.post('/api/admin/integration/webhook/order', { marketplace, payload });
      return response.data;
    },
    { connection: { url: config.redis.url } }
  );
}

async function createStockWorker() {
  return new Worker(
    'stock',
    async (job: Job) => {
      const { marketplace, payload } = job.data;
      console.log(`Processing ${marketplace} stock update`);
      
      const coreClient = axios.create({
        baseURL: config.coreApiUrl,
        headers: { 'x-internal-key': config.coreApiKey },
      });
      
      const response = await coreClient.post('/api/admin/integration/webhook/stock', { marketplace, payload });
      return response.data;
    },
    { connection: { url: config.redis.url } }
  );
}

async function createPriceWorker() {
  return new Worker(
    'price',
    async (job: Job) => {
      const { marketplace, payload } = job.data;
      console.log(`Processing ${marketplace} price update`);
      
      const coreClient = axios.create({
        baseURL: config.coreApiUrl,
        headers: { 'x-internal-key': config.coreApiKey },
      });
      
      const response = await coreClient.post('/api/admin/integration/webhook/price', { marketplace, payload });
      return response.data;
    },
    { connection: { url: config.redis.url } }
  );
}

export { createImportWorker, createSyncWorker, createOrderWorker, createStockWorker, createPriceWorker };

export async function closeQueues(): Promise<void> {
  await Promise.all([
    importQueue.close(),
    orderQueue.close(),
    stockQueue.close(),
    priceQueue.close(),
    syncQueue.close(),
  ]);
}