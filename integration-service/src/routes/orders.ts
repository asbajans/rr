import { Router, Request, Response } from 'express';
import { createIntegration } from '../integrations/factory';

const router = Router();

function internalKeyGuard(req: Request, res: Response): boolean {
  const key = req.header('X-Internal-Key');
  if (process.env.RAHAT_INTERNAL_KEY && key !== process.env.RAHAT_INTERNAL_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

router.post('/tracking', async (req: Request, res: Response) => {
  const { marketplace, config, externalId, trackingNumber, trackingCompany } = req.body || {};
  if (!marketplace || !externalId || !trackingNumber) {
    res.status(400).json({ error: 'marketplace, externalId and trackingNumber required' });
    return;
  }
  if (!internalKeyGuard(req, res)) return;

  try {
    const integration = createIntegration(marketplace, config ?? {});
    if (!integration) {
      res.status(400).json({ success: false, error: 'Unsupported marketplace' });
      return;
    }
    const result = await integration.updateTracking({ externalId, trackingNumber, trackingCompany });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    res.status(502).json({ success: false, error: msg });
  }
});

router.post('/status', async (req: Request, res: Response) => {
  const { marketplace, config, externalId, status } = req.body || {};
  if (!marketplace || !externalId || !status) {
    res.status(400).json({ error: 'marketplace, externalId and status required' });
    return;
  }
  if (!internalKeyGuard(req, res)) return;

  try {
    const integration = createIntegration(marketplace, config ?? {});
    if (!integration) {
      res.status(400).json({ success: false, error: 'Unsupported marketplace' });
      return;
    }
    const result = await integration.updateOrderStatus({ externalId, status });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    res.status(502).json({ success: false, error: msg });
  }
});

export default router;
