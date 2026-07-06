import express from 'express';
import webhookRouter from './routes/webhook';
import { startWorkers } from './queues/workers';

const app = express();
app.use(express.json());

app.use(webhookRouter);

app.get('/health', (_req, res) => {
  res.json({
    service: 'integration-service',
    queues: {
      'product-push-queue': 'active',
      'stock-sync-queue': 'active',
    },
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`Integration service running on port ${PORT}`);
  console.log('Connecting to Redis at', process.env.REDIS_URL || 'redis://redis:6379');
  startWorkers();
});
