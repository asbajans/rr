import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';
import { logger } from '../utils/logger.js';

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

export const orderPullQueue = new Queue('order-pull', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
});

export const orderPushQueue = new Queue('order-push', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
});

export const orderNotifyQueue = new Queue('order-notify', {
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

async function createOrderPullWorker() {
  const { pullAllOrders } = await import('../services/orderPull.js');
  return new Worker(
    'order-pull',
    async (job: Job) => {
      logger.info('Starting periodic order pull');
      const result = await pullAllOrders();
      return result;
    },
    { connection: { url: config.redis.url } }
  );
}

async function createOrderPushWorker() {
  const { pushOrderStatus, pushOrderTracking } = await import('../services/orderPush.js');
  return new Worker(
    'order-push',
    async (job: Job) => {
      const { action, storeId, marketplace, externalId, value, lineIds } = job.data;
      if (action === 'status') {
        return pushOrderStatus(storeId, marketplace, externalId, value, lineIds);
      } else if (action === 'tracking') {
        return pushOrderTracking(storeId, marketplace, externalId, value.trackingNumber, value.carrier);
      }
      throw new Error(`Unknown order push action: ${action}`);
    },
    { connection: { url: config.redis.url } }
  );
}

async function createOrderNotifyWorker() {
  const { notifyNewOrder, notifyOrderStatusChanged, notifyTrackingUpdated } = await import('../services/notification.js');
  const fcmClient = axios.create({
    baseURL: config.coreApiUrl,
    headers: { 'x-internal-key': config.coreApiKey },
    timeout: 5000,
  });

  return new Worker(
    'order-notify',
    async (job: Job) => {
      const { type, storeId, marketplace, orderId, itemCount, totalAmount, currency, newStatus, trackingNumber, carrier } = job.data;

      let tokens: string[] = [];
      try {
        const resp = await fcmClient.get(`/api/admin/users/fcm-tokens?storeId=${storeId}`);
        tokens = resp.data?.tokens || [];
      } catch {
        logger.warn({ storeId }, 'Failed to fetch FCM tokens');
      }
      if (tokens.length === 0) return;

      if (type === 'new_order') {
        await notifyNewOrder(tokens, marketplace, orderId, itemCount, totalAmount, currency);
      } else if (type === 'status_changed') {
        await notifyOrderStatusChanged(tokens, marketplace, orderId, newStatus);
      } else if (type === 'tracking_updated') {
        await notifyTrackingUpdated(tokens, marketplace, orderId, trackingNumber, carrier);
      }
    },
    { connection: { url: config.redis.url } }
  );
}

export {
  createImportWorker,
  createSyncWorker,
  createOrderWorker,
  createStockWorker,
  createPriceWorker,
  createOrderPullWorker,
  createOrderPushWorker,
  createOrderNotifyWorker,
};

export async function closeQueues(): Promise<void> {
  await Promise.all([
    importQueue.close(),
    orderQueue.close(),
    stockQueue.close(),
    priceQueue.close(),
    syncQueue.close(),
    orderPullQueue.close(),
    orderPushQueue.close(),
    orderNotifyQueue.close(),
  ]);
}