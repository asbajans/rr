import express from 'express';
import webhookRouter from './routes/webhook';
import importRouter from './routes/import';
import ordersRouter from './routes/orders';
import { startWorkers } from './queues/workers';
import { startOrderSync } from './services/orderSync';

const app = express();
app.use(express.json());

app.use(webhookRouter);
app.use(importRouter);
app.use(ordersRouter);

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

async function logDiagnostics() {
  try {
    const r: any = await fetch('https://api.ipify.org?format=json');
    const d: any = await r.json();
    console.log(`[diag] outbound public IP = ${d?.ip ?? 'unknown'} (whitelist this in Trendyol if you get 403)`);
  } catch {
    console.log('[diag] outbound public IP = unknown');
  }
  const k = process.env.TRENDYOL_API_KEY;
  const s = process.env.TRENDYOL_API_SECRET;
  const sid = process.env.TRENDYOL_SUPPLIER_ID;
  console.log(`[diag] trendyol ENV fallback creds (unused for imports, per-request config is used): apiKey=${k ? 'set' : 'EMPTY'}, secret=${s ? 'set' : 'EMPTY'}, supplierId=${sid ? 'set' : 'EMPTY'}`);
}

app.listen(PORT, () => {
  console.log(`Integration service running on port ${PORT}`);
  console.log('Connecting to Redis at', process.env.REDIS_URL || 'redis://redis:6379');
  logDiagnostics();
  startWorkers();
  startOrderSync();
});
