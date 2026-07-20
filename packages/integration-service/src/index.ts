import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { webhookRoutes } from './routes/webhook.js';
import { syncRoutes } from './routes/sync.js';
import { logger } from './utils/logger.js';
import { 
  createImportWorker, 
  createSyncWorker, 
  createOrderWorker, 
  createStockWorker, 
  createPriceWorker 
} from './queues/index.js';

export const createApp = async (): Promise<Express> => {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'integration-service', timestamp: new Date().toISOString() });
  });

  app.use('/webhook', webhookRoutes);
  app.use('/sync', syncRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
};

export const startServer = async (): Promise<void> => {
  const app = await createApp();
  const port = config.port;
  
  await createImportWorker();
  await createSyncWorker();
  await createOrderWorker();
  await createStockWorker();
  await createPriceWorker();
  
  app.listen(port, () => {
    logger.info(`🚀 Integration Service running on port ${port} (${config.env})`);
    logger.info('Workers started: import, sync, order, stock, price');
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
  });
}