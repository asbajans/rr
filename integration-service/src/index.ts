import express from 'express';
import webhookRouter from './routes/webhook';
import importRouter from './routes/import';
import { startWorkers } from './queues/workers';
import { startOrderSync } from './services/orderSync';

const app = express();
app.use(express.json());

app.use(webhookRouter);
app.use(importRouter);

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
  startOrderSync();
});
