import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

interface StockJobData {
  marketplace: string;
  payload: any;
}

export const stockWorker = new Worker<StockJobData>(
  'stock',
  async (job: Job<StockJobData>) => {
    const { marketplace, payload } = job.data;
    
    console.log(`Processing ${marketplace} stock update`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    const response = await coreClient.post('/api/admin/integration/webhook/stock', {
      marketplace,
      payload,
    });
    
    return response.data;
  },
  { connection: { url: config.redis.url } }
);

stockWorker.on('completed', (job) => {
  console.log(`Stock updated: ${job.data.marketplace}`);
});

stockWorker.on('failed', (job, err) => {
  console.error(`Stock failed: ${job?.data?.marketplace}`, err);
});