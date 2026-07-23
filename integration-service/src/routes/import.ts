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

  const pageLimit = Math.min(Math.max(Number(maxPages) || 50, 1), 200);
  const products = [];

  try {
    console.log(`[import] fetching ${marketplace} products, pages=${pageLimit}, configKeys=[${Object.keys(config || {}).join(',')}]`);
    console.log(`[import] request body: ${JSON.stringify({ marketplace, maxPages, config })}`);
    for (let page = 0; page < pageLimit; page++) {
      const batch = await integration.fetchProducts(page);
      if (!batch.length) break;
      products.push(...batch);
      if (batch.length < 50) break;
    }

    console.log(`[import] ${marketplace}: fetched ${products.length} products`);
    if (products[0]) {
      console.log(`[import] sample product payload: ${JSON.stringify(products[0]).slice(0, 4000)}`);
    }
    res.json({ marketplace, count: products.length, products });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[import] ${marketplace} fetch failed:`, message);
    res.status(502).json({ error: message });
  }
});

router.post('/import/categories', async (req: Request, res: Response) => {
  const { marketplace, config } = req.body as {
    marketplace?: string;
    config?: Record<string, string>;
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

  try {
    console.log(`[import] fetching ${marketplace} categories, configKeys=[${Object.keys(config || {}).join(',')}]`);
    console.log(`[import] categories request body: ${JSON.stringify({ marketplace, config })}`);
    const categories = await integration.fetchCategories();
    console.log(`[import] ${marketplace}: fetched ${categories.length} categories`);
    if (categories[0]) {
      console.log(`[import] sample category payload: ${JSON.stringify(categories[0]).slice(0, 3000)}`);
    }
    res.json({ marketplace, count: categories.length, categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[import] ${marketplace} categories fetch failed:`, message);
    res.status(502).json({ error: message });
  }
});

export default router;
