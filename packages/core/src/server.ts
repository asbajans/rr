import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
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
  // Warn if slave HMAC secret matches internal key in production
  if (config.env === 'production' &&
      config.apiKey.slaveHmacSecret === config.apiKey.internalKey) {
    logger.warn('RAHAT_SLAVE_HMAC_SECRET equals RAHAT_INTERNAL_KEY — set a separate SLAVE_HMAC_SECRET for production security');
  }
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
  // Stripe webhooks need the raw body for signature verification — parse raw BEFORE express.json
  app.use('/api/store/:siteCode/payments/webhook/stripe', express.raw({ type: '*/*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  await sequelize.authenticate();
  // Associations auto-configured via sequelize-typescript decorators
  try {
    // Preserve existing data across deploys. Only add missing columns and tables.
    // The previous implementation dropped core tables on each boot, which wiped products and integrations.
  } catch (e) {
    // Ignore startup migration issues and continue with safe sync below
  }
  // Add source + marketplaceCategoryId to categories (safe migration)
  try {
    await sequelize.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS source VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS "marketplaceCategoryId" VARCHAR(200)`);
  } catch (e) {
    // Ignore if columns already exist
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
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS "siteUrl" VARCHAR(255)`);
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
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS hosting VARCHAR(20) DEFAULT 'rahatio'`);
    // Backfill empty slugs from name
    await sequelize.query(
      `UPDATE plans SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), 'ı', 'i')) WHERE slug IS NULL OR slug = ''`
    );
  } catch (e) {
    // Ignore
  }

  // Add tracking/carrier/parentOrderId columns to dropshipping_orders (safe migration)
  try {
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "trackingNumber" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS carrier VARCHAR(100)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "parentOrderId" BIGINT`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentStatus" VARCHAR(20) DEFAULT 'pending'`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentProvider" VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentRefId" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "orderTokenHash" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(15,2) DEFAULT 0`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Add ExternalFeed columns if missing (safe migration)
  try {
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "authType" VARCHAR(20) DEFAULT 'none'`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "authCredentials" JSONB`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "pricingMode" VARCHAR(20) DEFAULT 'fixed'`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TRY'`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "priceMultiplier" DECIMAL(10,2) DEFAULT 1`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultGramWeight" DECIMAL(10,2)`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultMilyem" INTEGER`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultProfitMargin" DECIMAL(5,2)`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultCategory" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultCategoryId" INTEGER`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultIsB2bEnabled" BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultQuantity" INTEGER DEFAULT 1`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "defaultMarketplaces" JSONB`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "fieldMapping" JSONB DEFAULT '{}'::jsonb`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "autoSync" BOOLEAN DEFAULT false`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "updateInterval" VARCHAR(20) DEFAULT 'manual'`);
    await sequelize.query(`ALTER TABLE external_feeds ADD COLUMN IF NOT EXISTS "lastSyncResult" JSONB`);
    await sequelize.query(`ALTER TYPE enum_external_feeds_format ADD VALUE IF NOT EXISTS 'xlsx'`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Add FeedSyncLog columns if missing (safe migration)
  try {
    await sequelize.query(`ALTER TABLE feed_sync_logs ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP`);
    await sequelize.query(`ALTER TABLE feed_sync_logs ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP`);
    await sequelize.query(`ALTER TABLE feed_sync_logs ADD COLUMN IF NOT EXISTS summary JSONB`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "invoiceUrl" VARCHAR(500)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "labelUrl" VARCHAR(500)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "labelZpl" TEXT`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "cargoCompany" VARCHAR(100)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "customerName" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "customerEmail" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "customerPhone" VARCHAR(50)`);
    await sequelize.query(`UPDATE dropshipping_orders SET "customerName" = "shippingAddress"->>'fullName' WHERE "customerName" IS NULL AND "shippingAddress"->>'fullName' IS NOT NULL`);
    await sequelize.query(`UPDATE dropshipping_orders SET "customerEmail" = "shippingAddress"->>'email' WHERE "customerEmail" IS NULL AND "shippingAddress"->>'email' IS NOT NULL`);
    await sequelize.query(`UPDATE dropshipping_orders SET "customerPhone" = "shippingAddress"->>'phone' WHERE "customerPhone" IS NULL AND "shippingAddress"->>'phone' IS NOT NULL`);
  } catch (e) {
    // Ignore
  }

  await sequelize.sync({ alter: false });

  // AI Product Studio tables are created by sync; add future-safe columns here
  try {
    await sequelize.query(`ALTER TABLE ai_product_sessions ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(128)`);
    await sequelize.query(`ALTER TABLE ai_product_drafts ADD COLUMN IF NOT EXISTS "productId" BIGINT REFERENCES products(id) ON DELETE SET NULL`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS ai_product_sessions_store_idempotency_unique ON ai_product_sessions ("storeId", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`);
  } catch (e) {
    // Ignore if table not ready yet
  }

  // AI Product Studio publish support — listing publish tracking columns
  try {
    await sequelize.query(`ALTER TABLE product_marketplace_listings ADD COLUMN IF NOT EXISTS channel VARCHAR(50)`);
    await sequelize.query(`ALTER TABLE product_marketplace_listings ADD COLUMN IF NOT EXISTS "payloadSnapshot" JSONB`);
    await sequelize.query(`ALTER TABLE product_marketplace_listings ADD COLUMN IF NOT EXISTS "retryCount" INTEGER DEFAULT 0`);
    await sequelize.query(`ALTER TABLE product_marketplace_listings ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP`);
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS product_marketplace_listings_channel ON product_marketplace_listings (channel)`
    );
    await sequelize.query(`ALTER TYPE enum_product_marketplace_listings_status ADD VALUE IF NOT EXISTS 'publishing'`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Checkout (Faz 6) — product stock reservation + order payment/amount columns
  try {
    await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "reservedQuantity" INTEGER DEFAULT 0`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Faz 7 — supplier cost + order commission/settlement columns
  try {
    await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS cost DECIMAL(15,2)`);
    await sequelize.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS cost DECIMAL(15,2)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "commissionRate" DECIMAL(5,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "commissionAmount" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "supplierEarnings" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "supplierStatus" VARCHAR(20)`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Faz 8 — site publish state + deployment history
  try {
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Normalize plan.modules: default all-enabled for unconfigured plans, convert legacy boolean values
  try {
    await sequelize.query(
      `UPDATE plans SET modules = '{"b2b":{"enabled":true},"marketplace":{"enabled":true},"ai_product_create":{"enabled":true},"ai_image_generate":{"enabled":true},"xml_feed":{"enabled":true},"variations":{"enabled":true},"blog":{"enabled":true},"custom_domain":{"enabled":true},"shipping":{"enabled":true},"static_pages":{"enabled":true}}'::jsonb
       WHERE modules IS NULL OR modules = '{}'::jsonb`
    );
    const { Plan } = await import('./models/Plan.model.js');
    const plans = await Plan.findAll();
    for (const plan of plans) {
      const modules = (plan as any).modules;
      if (!modules || typeof modules !== 'object') continue;
      const normalized: Record<string, any> = {};
      let changed = false;
      for (const [key, value] of Object.entries(modules)) {
        if (value === true || value === false) {
          normalized[key] = { enabled: value === true };
          changed = true;
        } else if (value && typeof value === 'object') {
          normalized[key] = value;
        }
      }
      if (changed) {
        await (plan as any).update({ modules: normalized });
      }
    }
  } catch (e) {
    // Ignore if plans table/modules column not ready
  }

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

  // Global API rate limit (permissive); strict limits are applied to sensitive routes
  app.use(
    '/api',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests' },
    })
  );

  // Strict limiters for money/bot-sensitive endpoints
  const strictLimit = (max: number, minutes = 15) =>
    rateLimit({
      windowMs: minutes * 60 * 1000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests — please slow down' },
    });

  app.use('/api/store/:siteCode/checkout', strictLimit(10));
  app.use('/api/store/:siteCode/payments/initiate', strictLimit(10));
  app.use('/api/auth/login', strictLimit(20));
  app.use('/api/auth/register', strictLimit(10));

  // Serve uploaded media files (images) at /uploads/...
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '30d', fallthrough: true }));

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
    const { createImportWorker, createSyncWorker, createWebhookWorker, createPublicationWorker } = await import('./queues/index.js');
    const importWorker = await createImportWorker();
    const syncWorker = await createSyncWorker();
    const webhookWorker = await createWebhookWorker();
    const publicationWorker = await createPublicationWorker();

    importWorker.on('error', (err) => logger.error({ err }, 'Import worker error'));
    syncWorker.on('error', (err) => logger.error({ err }, 'Sync worker error'));
    webhookWorker.on('error', (err) => logger.error({ err }, 'Webhook worker error'));
    publicationWorker.on('error', (err) => logger.error({ err }, 'Publication worker error'));

    importWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Import job failed'));
    syncWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Sync job failed'));
    webhookWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Webhook job failed'));
    publicationWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Publication job failed'));
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
