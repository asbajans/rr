import { Router, Request, Response } from 'express';
import { addProductJob, addStockJob } from '../queues/queueManager';
import { createIntegration } from '../integrations/factory';
import { WebhookPayload } from '../types';

const router = Router();

router.post('/webhook/product', async (req: Request, res: Response) => {
  const payload = req.body as WebhookPayload;

  if (!payload || !payload.event) {
    res.status(400).json({ error: 'Invalid webhook payload' });
    return;
  }

  res.status(202).json({ received: true, event: payload.event });

  switch (payload.event) {
    case 'product.updated':
      await addProductJob({
        ...payload.data,
        event: 'product.updated',
      });
      break;

    case 'stock.updated':
      await addStockJob({
        sku: payload.data.sku,
        quantity: payload.data.stock ?? payload.data.quantity,
      });
      break;

    case 'price.updated':
      await addStockJob({
        sku: payload.data.sku,
        price: payload.data.price,
        type: 'price_update',
      });
      break;

    default:
      console.warn(`Unknown event: ${payload.event}`);
  }
});

router.get('/webhook/product', (_req: Request, res: Response) => {
  res.json({ service: 'integration-service', webhook: '/webhook/product', active: true });
});

router.post('/verify/product', async (req: Request, res: Response) => {
  const { marketplace, config, sku, barcode } = req.body || {};
  if (!marketplace || !sku) {
    res.status(400).json({ error: 'marketplace and sku required' });
    return;
  }

  const key = req.header('X-Internal-Key');
  if (process.env.RAHAT_INTERNAL_KEY && key !== process.env.RAHAT_INTERNAL_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const integration = createIntegration(marketplace, config ?? {});
    if (!integration) {
      res.status(400).json({ error: 'Unsupported marketplace' });
      return;
    }
    const result = await integration.verifyProduct({
      sku,
      barcode: barcode || sku,
      name: '',
      price: 0,
      stock: 0,
    } as any);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    res.status(502).json({ error: msg });
  }
});

export default router;
