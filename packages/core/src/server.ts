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

  // The API runs behind a reverse proxy (Portainer/Caddy/Nginx/Cloudflare).
  // Without this, express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
  // when the X-Forwarded-For header is present, breaking login/checkout routes.
  app.set('trust proxy', 1);

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
  // SAAS (platform abonelik/kredi): POST /api/admin/webhook/stripe  -> store/routes.ts
  // Storefront (satıcı tahsilatı): POST /api/store/:siteCode/payments/webhook/stripe -> payment/webhookRoutes.ts
  app.use('/api/admin/webhook/stripe', express.raw({ type: '*/*' }));
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
    await sequelize.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS "aiAttributes" JSONB`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // StoreLocation schema alignment with frontend (safe migration)
  try {
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7)`);
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7)`);
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS working_hours JSONB`);
    await sequelize.query(`ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false`);
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
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS "defaultAiCategoryId" BIGINT`);
  } catch (e) {
    // Ignore
  }

  // Meta attribution + domain verification (safe migration)
  try {
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS attribution JSONB`);
  } catch (e) {
    // Ignore
  }

  // Phase 8B deployment provider metadata (safe migration)
  try {
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'rahatio'`);
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS "providerProjectId" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS "providerDeploymentId" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS "providerStatus" VARCHAR(30)`);
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS "providerUrl" VARCHAR(500)`);
    await sequelize.query(`ALTER TABLE site_deployments ADD COLUMN IF NOT EXISTS "providerError" TEXT`);
  } catch (e) {
    // The table is created by sequelize sync on a fresh installation.
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
    await sequelize.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS "aiScenarioModels" JSONB`);
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
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentEventId" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "paymentDetails" JSONB`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "orderTokenHash" VARCHAR(200)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "shippingAmount" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(15,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "couponCode" VARCHAR(80)`);
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "orderDate" TIMESTAMP`);
    await sequelize.query(`UPDATE dropshipping_orders SET "orderDate" = "createdAt" WHERE "orderDate" IS NULL`);
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

  // Faz 10 — customer accounts and storefront commerce tables/links.
  // The customerId columns must exist BEFORE sequelize.sync(): DropshippingOrder
  // and CustomerAddress define indexes on customerId, and sync() (alter:false)
  // creates missing indexes on existing tables. If the column is added after sync,
  // CREATE INDEX fails with "column customerId does not exist".
  try {
    await sequelize.query(`ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS "customerId" BIGINT`);
  } catch (e) {
    // Fresh databases create the column from the model definition.
  }
  try {
    await sequelize.query(`ALTER TABLE dropshipping_orders ADD COLUMN IF NOT EXISTS "customerId" BIGINT`);
  } catch (e) {
    // Fresh databases create the column from the model definition.
  }
  // The remaining customer tables also index customerId — if they already exist
  // (created by an earlier deploy) ensure the column is present before sync.
  for (const table of ['customer_consents', 'customer_favorites', 'customer_reviews', 'customer_notifications']) {
    try {
      await sequelize.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS "customerId" BIGINT`);
    } catch (e) {
      // Fresh databases create the column from the model definition.
    }
  }

  // Add source column to customers table
  try {
    await sequelize.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS "source" VARCHAR(20) DEFAULT 'storefront'`);
  } catch (e) {
    // Fresh databases create the column from the model definition.
  }
  // Make passwordHash nullable for marketplace customers
  try {
    await sequelize.query(`ALTER TABLE customers ALTER COLUMN "passwordHash" DROP NOT NULL`);
  } catch (e) {
    // Column may already be nullable.
  }

  await sequelize.sync({ alter: false });

  // Idempotent index creation. On existing databases the model sync above already
  // created these indexes now that the columns exist, so these are no-ops.
  try {
    await sequelize.query(`CREATE INDEX IF NOT EXISTS customer_addresses_customer_id ON customer_addresses ("customerId")`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS dropshipping_orders_customer_id ON dropshipping_orders ("customerId")`);
  } catch (e) {
    // Ignore if the indexes already exist.
  }

  // Backfill: create Customer records from existing orders that have email but no customerId
  try {
    const [orphanOrders] = await sequelize.query(`
      SELECT DISTINCT ON ("storeId", "customerEmail")
        id, "storeId", "customerName", "customerEmail", "customerPhone", marketplace
      FROM dropshipping_orders
      WHERE "customerEmail" IS NOT NULL AND "customerEmail" != ''
        AND "customerId" IS NULL
      ORDER BY "storeId", "customerEmail", "createdAt" DESC
    `);
    for (const order of orphanOrders as any[]) {
      const email = order.customerEmail.trim().toLowerCase();
      const [cust] = await sequelize.query(`
        INSERT INTO customers ("storeId", email, "passwordHash", name, phone, source, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, NULL, $3, $4, $5, true, NOW(), NOW())
        ON CONFLICT ("storeId", email) DO UPDATE SET
          name = COALESCE(NULLIF(EXCLUDED.name, ''), customers.name),
          phone = COALESCE(NULLIF(EXCLUDED.phone, ''), customers.phone)
        RETURNING id
      `, { bind: [order.storeId, email, order.customerName || email.split('@')[0], order.customerPhone || null, order.marketplace === 'storefront' ? 'storefront' : 'marketplace'] });
      const custId = (cust as any[])[0]?.id;
      if (custId) {
        await sequelize.query(`UPDATE dropshipping_orders SET "customerId" = $1 WHERE "customerEmail" = $2 AND "storeId" = $3 AND "customerId" IS NULL`, { bind: [custId, order.customerEmail, order.storeId] });
      }
    }
    if ((orphanOrders as any[]).length > 0) console.log(`[migration] Backfilled ${(orphanOrders as any[]).length} customer(s) from existing orders`);
  } catch (e: any) {
    console.warn('[migration] Customer backfill skipped:', e.message);
  }

  // AI Product Studio tables are created by sync; add future-safe columns here
  try {
    await sequelize.query(`ALTER TABLE ai_product_sessions ADD COLUMN IF NOT EXISTS "idempotencyKey" VARCHAR(128)`);
    await sequelize.query(`ALTER TABLE ai_product_sessions ADD COLUMN IF NOT EXISTS "additionalImageUrls" JSONB`);
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

  // AI model tier (free/paid) — plan-level model selection support
  try {
    await sequelize.query(`ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS tier VARCHAR(10) DEFAULT 'paid'`);
  } catch (e) {
    // Ignore if column already exists
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

  // Faz 7C — supplier application & approval workflow columns
  try {
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "applicationStatus" VARCHAR(20) DEFAULT 'draft'`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "applicationDocuments" JSONB`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "applicationSubmittedAt" TIMESTAMP`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "applicationReviewedAt" TIMESTAMP`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "rejectionNote" TEXT`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Faz 7D — supplier rating system: max shipment days + rating aggregates
  try {
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "maxShipmentDays" INTEGER DEFAULT 3`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "ratingAvg" DECIMAL(3,2) DEFAULT 0`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "ratingCount" INTEGER DEFAULT 0`);
    await sequelize.query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "ratingEnabled" BOOLEAN DEFAULT true`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Faz 8 — site publish state + deployment history
  try {
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Homepage hero config (image/youtube hero, CTA) stored on the store row.
  try {
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS homepage JSONB`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Low-stock warning threshold per store (stock review/warning system)
  try {
    await sequelize.query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER DEFAULT 5`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Product attributes (key-value pairs shown on storefront)
  try {
    await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes JSONB`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Per-product SEO (mirrors the draft's meta fields; if null the frontend falls back to title/description).
  try {
    await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "seoTitle" TEXT`);
    await sequelize.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS "seoDescription" TEXT`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Normalize plan.modules: NULL → {} (empty means no modules selected → all
  // module-gated features are disabled; see isModuleEnabled). Also convert
  // legacy boolean module values into { enabled } objects.
  try {
    await sequelize.query(`UPDATE plans SET modules = '{}'::jsonb WHERE modules IS NULL`);
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

  // Product policy: the default Free plan must not include the B2B module.
  // This keeps the seed data honest for existing installs too.
  try {
    await sequelize.query(
      `UPDATE plans SET modules = jsonb_set(modules, '{b2b}', '{"enabled": false}'::jsonb, true) WHERE name = 'Free'`
    );
  } catch (e) {
    // Ignore if plans table not ready
  }

  // Google OAuth columns (safe migration)
  try {
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255)`);
    await sequelize.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "authProvider" VARCHAR(20) DEFAULT 'local'`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique ON users ("googleId") WHERE "googleId" IS NOT NULL`);
  } catch (e) {
    // Ignore if columns already exist
  }

  // Seed default AI provider/models/scenarios + Free-plan model overrides (idempotent)
  try {
    const { seedAiDefaults } = await import('./modules/ai/defaults.js');
    await seedAiDefaults();
  } catch (e) {
    logger.warn({ err: e }, 'AI defaults seed failed');
  }

  // Seed default categories (idempotent)
  try {
    const { Category } = await import('./models/Category.model.js');
    const defaultCategories = [
      { name: { tr: 'Oto Yedek Parça', en: 'Auto Spare Parts' }, slug: 'oto-yedek-parca', sortOrder: 0 },
    ];
    for (const cat of defaultCategories) {
      await Category.findOrCreate({
        where: { storeId: null, slug: cat.slug } as any,
        defaults: { ...cat, isActive: true } as any,
      });
    }
  } catch (e) {
    // Ignore if categories table not ready
  }

  // Migrate existing admin user to superadmin role
  try {
    await sequelize.query(
      `UPDATE users SET role = 'superadmin' WHERE email = 'admin@rahatio.com.tr' AND role != 'superadmin'`
    );
  } catch (e) {
    // Ignore if column doesn't exist yet
  }

  // Seed missing legal pages + footer menus for existing stores (idempotent, once per boot)
  try {
    const { Store: S } = await import('./models/Store.model.js');
    const { Page: P } = await import('./models/ContentModels.js');
    const { seedLegalPagesForStore } = await import('./modules/page/legalTemplates.js');
    const stores = await S.findAll({ attributes: ['id', 'name', 'email', 'siteCode'] });
    for (const s of stores as any[]) {
      const count = await P.count({ where: { storeId: s.id } });
      if (count === 0) {
        try {
          await seedLegalPagesForStore(s.id, { name: s.name, email: s.email, siteCode: s.siteCode });
          logger.info(`Auto-seeded legal pages for existing store ${s.siteCode} (${s.id})`);
        } catch (e) {
          logger.warn({ err: e }, `Failed to auto-seed legal pages for store ${s.id}`);
        }
      }
    }
  } catch (e) {
    logger.warn({ err: e }, 'Auto-seed legal pages skipped');
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
  app.use('/api/auth/google', strictLimit(20));
  app.use('/api/auth/change-password', strictLimit(10));
  app.use('/api/auth/delete-my-account', strictLimit(10));

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

  // Release stock reservations from abandoned gateway checkouts.
  const { releaseExpiredCheckoutReservations } = await import('./modules/order/checkout.js');
  const reservationTimer = setInterval(() => {
    releaseExpiredCheckoutReservations().catch((err) => logger.error({ err }, 'Failed to release expired checkout reservations'));
  }, 5 * 60 * 1000);
  reservationTimer.unref?.();

  // Auto-pull marketplace orders every 10 minutes (fire-and-forget). New orders
  // and status changes trigger in-app + push notifications.
  const orderAutoImportTimer = setInterval(async () => {
    try {
      const { importOrdersForAllStores } = await import('./modules/integration/orderImport.js');
      await importOrdersForAllStores({ maxPages: 3 });
    } catch (err) {
      logger.error({ err }, 'Auto order import failed');
    }
  }, 10 * 60 * 1000);
  orderAutoImportTimer.unref?.();

  // Low-stock warning scan — notify store owners about products below their
  // configured threshold. Runs every 30 minutes, fire-and-forget.
  const lowStockTimer = setInterval(async () => {
    try {
      const { checkAllStoresLowStock } = await import('./modules/stocks/warning.js');
      const created = await checkAllStoresLowStock();
      if (created > 0) logger.info({ created }, 'Low-stock notifications created');
    } catch (err) {
      logger.error({ err }, 'Low-stock check failed');
    }
  }, 30 * 60 * 1000);
  lowStockTimer.unref?.();

  // Meta long-lived token refresh — daily check, refresh if expires within 7 days (TechProvider)
  const metaTokenTimer = setInterval(async () => {
    try {
      const { MarketplaceIntegration } = await import('./models/MarketplaceIntegration.model.js');
      const { getMetaAppConfig } = await import('./modules/marketplace/metaRoutes.js');
      const { FacebookClient } = await import('./marketplace/clients/facebook.js');
      const app = await getMetaAppConfig().catch(() => null);
      if (!app?.appId || !app?.appSecret) return;
      const integrations = await MarketplaceIntegration.findAll({ where: { marketplace: 'facebook', isActive: true } as any });
      for (const ig of integrations) {
        const cfg: any = ig.config || {};
        if (!cfg.tokenExpiry || !cfg.userAccessToken) continue;
        if (cfg.tokenExpiry - Date.now() > 7 * 24 * 60 * 60 * 1000) continue;
        try {
          const client = new FacebookClient({ appId: app.appId, appSecret: app.appSecret, userAccessToken: cfg.userAccessToken, accessToken: cfg.accessToken });
          const refreshed = await client.exchangeLongLived(cfg.userAccessToken);
          await ig.update({ config: { ...cfg, accessToken: refreshed.access_token, userAccessToken: refreshed.access_token, tokenExpiry: Date.now() + ((refreshed.expires_in || 5184000) - 86400) * 1000 } as any });
          logger.info({ storeId: ig.storeId }, 'Meta token refreshed');
        } catch (e: any) { logger.warn({ err: e.message, storeId: ig.storeId }, 'Meta token refresh failed'); }
      }
    } catch (err) { logger.error({ err }, 'Meta token refresh check failed'); }
  }, 24 * 60 * 60 * 1000);
  metaTokenTimer.unref?.();

  // Start BullMQ workers
  logger.info('Starting marketplace workers...');
  try {
    const { createImportWorker, createSyncWorker, createWebhookWorker, createPublicationWorker, createAiProductWorker } = await import('./queues/index.js');
    const importWorker = await createImportWorker();
    const syncWorker = await createSyncWorker();
    const webhookWorker = await createWebhookWorker();
    const publicationWorker = await createPublicationWorker();
    const aiProductWorker = await createAiProductWorker();

    importWorker.on('error', (err) => logger.error({ err }, 'Import worker error'));
    syncWorker.on('error', (err) => logger.error({ err }, 'Sync worker error'));
    webhookWorker.on('error', (err) => logger.error({ err }, 'Webhook worker error'));
    publicationWorker.on('error', (err) => logger.error({ err }, 'Publication worker error'));
    aiProductWorker.on('error', (err) => logger.error({ err }, 'AI product worker error'));

    importWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Import job failed'));
    syncWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Sync job failed'));
    webhookWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Webhook job failed'));
    publicationWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Publication job failed'));
    aiProductWorker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'AI product job failed'));
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
