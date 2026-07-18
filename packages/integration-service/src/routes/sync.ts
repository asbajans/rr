import { Router, Request, Response } from 'express';
import { importQueue, syncQueue } from '../queues/index.js';

export const syncRoutes = Router();

syncRoutes.post('/import/:marketplace', async (req: Request, res: Response) => {
  try {
    const { marketplace } = req.params;
    const { maxPages = 10 } = req.body;
    
    const job = await importQueue.add('import', { marketplace, maxPages });
    
    res.json({ 
      jobId: job.id, 
      status: 'queued',
      marketplace,
      maxPages 
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to queue import', message: err.message });
  }
});

syncRoutes.get('/import/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await importQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const progress = await job.progress();
    const state = await job.getState();
    
    res.json({ 
      jobId: job.id, 
      state, 
      progress, 
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get job status', message: err.message });
  }
});

syncRoutes.post('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { marketplaces, trigger = 'manual' } = req.body;
    
    const job = await syncQueue.add('sync', { productId, marketplaces, trigger });
    
    res.json({ 
      jobId: job.id, 
      status: 'queued',
      productId,
      marketplaces: marketplaces || 'all',
      trigger 
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to queue sync', message: err.message });
  }
});

syncRoutes.get('/product/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await syncQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const progress = await job.progress();
    const state = await job.getState();
    
    res.json({ 
      jobId: job.id, 
      state, 
      progress, 
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get job status', message: err.message });
  }
});