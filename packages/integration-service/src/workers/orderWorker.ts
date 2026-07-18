import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

interface OrderJobData {
  marketplace: string;
  payload: any;
}

export const orderWorker = new Worker<OrderJobData>(
  'order',
  async (job: Job<OrderJobData>) => {
    const { marketplace, payload } = job.data;
    
    console.log(`Processing ${marketplace} order`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    const response = await coreClient.post('/api/admin/integration/webhook/order', {
      marketplace,
      payload,
    });
    
    return response.data;
  },
  { connection: { url: config.redis.url } }
);

orderWorker.on('completed', (job) => {
  console.log(`Order processed: ${job.data.marketplace}`);
});

orderWorker.on('failed', (job, err) => {
  console.error(`Order failed: ${job?.data?.marketplace}`, err);
});