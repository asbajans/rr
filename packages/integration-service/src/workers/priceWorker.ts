import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

interface PriceJobData {
  marketplace: string;
  payload: any;
}

export const priceWorker = new Worker<PriceJobData>(
  'price',
  async (job: Job<PriceJobData>) => {
    const { marketplace, payload } = job.data;
    
    console.log(`Processing ${marketplace} price update`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    const response = await coreClient.post('/api/admin/integration/webhook/price', {
      marketplace,
      payload,
    });
    
    return response.data;
  },
  { connection: { url: config.redis.url } }
);

priceWorker.on('completed', (job) => {
  console.log(`Price updated: ${job.data.marketplace}`);
});

priceWorker.on('failed', (job, err) => {
  console.error(`Price failed: ${job?.data?.marketplace}`, err);
});