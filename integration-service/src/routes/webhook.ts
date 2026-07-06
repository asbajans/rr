import { Router, Request, Response } from 'express';
import { addProductJob, addStockJob } from '../queues/queueManager';
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

export default router;
