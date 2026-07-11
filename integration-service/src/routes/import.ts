import { Router, Request, Response } from 'express';
import { createIntegration } from '../integrations/factory';

const router = Router();

router.post('/import/products', async (req: Request, res: Response) => {
  const { marketplace, config, maxPages } = req.body as {
    marketplace?: string;
    config?: Record<string, string>;
    maxPages?: number;
  };

  if (!marketplace || !config) {
    res.status(400).json({ error: 'marketplace and config are required' });
    return;
  }

  const integration = createIntegration(marketplace, config);
  if (!integration) {
    res.status(422).json({ error: `Invalid or incomplete config for ${marketplace}` });
    return;
  }

  const pageLimit = Math.min(Math.max(Number(maxPages) || 5, 1), 50);
  const products = [];

  try {
    for (let page = 0; page < pageLimit; page++) {
      const batch = await integration.fetchProducts(page);
      if (!batch.length) break;
      products.push(...batch);
      if (batch.length < 50) break;
    }

    res.json({ marketplace, count: products.length, products });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(502).json({ error: message });
  }
});

export default router;
