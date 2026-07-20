import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { authMiddleware, optionalAuth } from './middleware/auth.js';
import { apiKeyMiddleware } from './middleware/apiKey.js';
import { sequelize } from './config/database.js';
import { setupAssociations } from './models/associations.js';
import { registerRoutes } from './routes.js';
import { logger } from './utils/logger.js';

export const createApp = async (): Promise<Express> => {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(compression());
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await sequelize.authenticate();
  setupAssociations();
  await sequelize.sync({ alter: config.env !== 'production' });

  app.use(tenantMiddleware);

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: config.version });
  });

  registerRoutes(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', message: 'Route not found' });
  });

  app.use(errorHandler);

  return app;
};

export const startServer = async (): Promise<void> => {
  const app = await createApp();
  const port = config.port;
  
  app.listen(port, () => {
    logger.info(`🚀 Rahatio Core API running on port ${port} (${config.env})`);
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('=== SERVER CRASH ===');
    console.error(err);
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  });
}