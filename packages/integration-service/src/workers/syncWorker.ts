import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

interface SyncJobData {
  productId: string;
  marketplaces?: string[];
  trigger: string;
}

export const syncWorker = new Worker<SyncJobData>(
  'sync',
  async (job: Job<SyncJobData>) => {
    const { productId, marketplaces, trigger } = job.data;
    
    console.log(`Syncing product ${productId} to ${marketplaces?.join(', ') || 'all'} (trigger: ${trigger})`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    const response = await coreClient.post(`/api/admin/products/${productId}/sync`, {
      marketplaces,
    });
    
    return response.data;
  },
  { connection: { url: config.redis.url } }
);

syncWorker.on('completed', (job) => {
  console.log(`Sync completed for product ${job.data.productId}:`, job.returnvalue);
});

syncWorker.on('failed', (job, err) => {
  console.error(`Sync failed for product ${job?.data?.productId}:`, err);
});