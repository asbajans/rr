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
// Associations auto-configured via sequelize-typescript decorators
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-API-Key-HMAC', 'X-Timestamp'],
  }));
  app.options('*', cors()); // Handle preflight for all routes
  app.use(compression());
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await sequelize.authenticate();
  // Associations auto-configured via sequelize-typescript decorators
  try {
    // Drop tables that were created with wrong column naming (underscored: true)
    // so they get recreated fresh with corrected schema
    await sequelize.query(`DROP TABLE IF EXISTS categories CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS marketplace_category_mappings CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS product_b2b_settings CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS b2b_requests CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS b2b_listed_products CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS integration_logs CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS dropshipping_orders CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS order_status_histories CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS credit_logs CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS pages CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS store_locations CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS store_payment_methods CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS external_feeds CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS feed_sync_logs CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS api_keys CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS marketplace_integrations CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS product_variants CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS product_marketplace_listings CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS variations CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS variation_options CASCADE`);
    await sequelize.query(`DROP TABLE IF EXISTS products CASCADE`);
  } catch (e) {
    // Tables might not exist, ignore
  }
  // Add superadmin to role ENUM if not exists (safe migration)
  try {
    await sequelize.query(`ALTER TYPE enum_users_role ADD VALUE IF NOT EXISTS 'superadmin'`);
  } catch (e) {
    // ENUM might be created by sync below, ignore
  }

  // Add pixels column to stores table if missing (safe migration)
  try {
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS pixels JSONB`);
  } catch (e) {
    // Ignore
  }

  // Add new plan columns if missing (safe migration, runs every boot)
  try {
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE`);
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT`);
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'TRY'`);
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS "storeLimit" INTEGER DEFAULT 1`);
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS modules JSONB`);
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true`);
    // Backfill empty slugs from name
    await sequelize.query(
      `UPDATE plans SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), 'ı', 'i')) WHERE slug IS NULL OR slug = ''`
    );
  } catch (e) {
    // Ignore
  }

  await sequelize.sync({ alter: config.env !== 'production' });

  // Migrate existing admin user to superadmin role
  try {
    await sequelize.query(
      `UPDATE users SET role = 'superadmin' WHERE email = 'admin@rahatio.com.tr' AND role != 'superadmin'`
    );
  } catch (e) {
    // Ignore if column doesn't exist yet
  }

  setupAssociations();

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

  // Start BullMQ workers
  logger.info('Starting marketplace workers...');
  try {
    const { createImportWorker, createSyncWorker, createWebhookWorker } = await import('./queues/index.js');
    const importWorker = await createImportWorker();
    const syncWorker = await createSyncWorker();
    const webhookWorker = await createWebhookWorker();

    importWorker.on('error', (err) => logger.error({ err }, 'Import worker error'));
    syncWorker.on('error', (err) => logger.error({ err }, 'Sync worker error'));
    webhookWorker.on('error', (err) => logger.error({ err }, 'Webhook worker error'));

    importWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Import job failed'));
    syncWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Sync job failed'));
    webhookWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Webhook job failed'));
  } catch (err) {
    logger.error({ err }, 'Failed to start workers (Redis may be unavailable)');
  }
  
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