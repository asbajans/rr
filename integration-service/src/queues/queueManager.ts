import { Queue, RedisConnection } from 'bullmq';
import Redis from 'ioredis';
import { QueueName } from '../types';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const productQueue = new Queue('product-push-queue', { connection: connection as any });
const stockQueue = new Queue('stock-sync-queue', { connection: connection as any });

export function getQueue(name: QueueName): Queue {
  return name === 'product-push-queue' ? productQueue : stockQueue;
}

export async function addProductJob(data: Record<string, unknown>): Promise<void> {
  await productQueue.add('push-product', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function addStockJob(data: Record<string, unknown>): Promise<void> {
  await stockQueue.add('sync-stock', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export { connection };
