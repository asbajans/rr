import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';
import { orderNotifyQueue } from '../queues/index.js';

interface OrderJobData {
  marketplace: string;
  payload: any;
  storeId?: number;
}

export const orderWorker = new Worker<OrderJobData>(
  'order',
  async (job: Job<OrderJobData>) => {
    const { marketplace, payload, storeId } = job.data;
    
    console.log(`Processing ${marketplace} order`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    const response = await coreClient.post('/api/admin/integration/webhook/order', {
      marketplace,
      payload: { ...payload, storeId },
    });
    
    const result = response.data;
    if (result?.created) {
      const sid = storeId || payload?.storeId;
      if (sid) {
        const items = payload?.items || payload?.products || [];
        await orderNotifyQueue.add('notify-new-order', {
          storeId: sid,
          marketplace,
          orderId: result.order?.marketplaceOrderId || payload?.id || '',
          itemCount: items.length,
          totalAmount: result.order?.totalAmount || 0,
          currency: payload?.currency || 'TRY',
        });
      }
    }
    
    return result;
  },
  { connection: { url: config.redis.url } }
);

orderWorker.on('completed', (job) => {
  console.log(`Order processed: ${job.data.marketplace}`);
});

orderWorker.on('failed', (job, err) => {
  console.error(`Order failed: ${job?.data?.marketplace}`, err);
});