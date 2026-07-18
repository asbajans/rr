#!/usr/bin/env node

/**
 * PostgreSQL Migration Script for Rahatio v2
 * Migrates from MySQL (Aimeos) to PostgreSQL (Sequelize)
 * 
 * Usage: npx tsx scripts/migrate-to-pg.ts
 */

import 'dotenv/config'
import { createClient } from 'pg'
import mysql from 'mysql2/promise'

const PG_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'rahatio',
}

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'rahatio',
  password: process.env.MYSQL_PASSWORD || 'rahatio',
  database: process.env.MYSQL_DATABASE || 'rahatio',
}

async function migrate() {
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG)
  const pgConn = new PG_CONFIG

  const pgClient = new Client(pgConn)
  await pgClient.connect()

  console.log('Connected to both databases')

  try {
    // 1. Migrate stores
    await migrateStores(mysqlConn, pgClient)
    
    // 2. Migrate users
    await migrateUsers(mysqlConn, pgClient)
    
    // 3. Migrate plans
    await migratePlans(mysqlConn, pgClient)
    
    // 4. Migrate subscriptions
    await migrateSubscriptions(mysqlConn, pgClient)
    
    // 5. Migrate categories
    await migrateCategories(mysqlConn, pgClient)
    
    // 6. Migrate marketplace integrations
    await migrateMarketplaceIntegrations(mysqlConn, pgClient)
    
    // 7. Migrate products
    await migrateProducts(mysqlConn, pgClient)
    
    // 8. Migrate product variants
    await migrateProductVariants(mysqlConn, pgClient)
    
    // 9. Migrate B2B settings
    await migrateB2BSettings(mysqlConn, pgClient)
    
    // 10. Migrate B2B requests
    await migrateB2BRequests(mysqlConn, pgClient)
    
    // 11. Migrate B2B listed products
    await migrateB2BListedProducts(mysqlConn, pgClient)
    
    // 12. Migrate orders
    await migrateDropshippingOrders(mysqlConn, pgClient)
    
    // 13. Migrate order status histories
    await migrateOrderStatusHistories(mysqlConn, pgClient)
    
    // 14. Migrate API keys
    await migrateApiKeys(mysqlConn, pgClient)
    
    // 15. Migrate credit logs
    await migrateCreditLogs(mysqlConn, pgClient)
    
    // 16. Migrate pages
    await migratePages(mysqlConn, pgClient)
    
    // 17. Migrate store locations
    await migrateStoreLocations(mysqlConn, pgClient)
    
    // 18. Migrate store payment methods
    await migrateStorePaymentMethods(mysqlConn, pgClient)
    
    // 19. Migrate external feeds
    await migrateExternalFeeds(mysqlConn, pgClient)
    
    // 20. Migrate feed sync logs
    await migrateFeedSyncLogs(mysqlConn, pgClient)
    
    // 21. Migrate variations
    await migrateVariations(mysqlConn, pgClient)
    
    // 22. Migrate variation options
    await migrateVariationOptions(mysqlConn, pgClient)
    
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await mysqlConn.end()
    await pgClient.end()
  }
}

async function migrateStores(mysql: any, pg: any) {
  console.log('Migrating stores...')
  const [rows] = await mysql.query('SELECT * FROM stores')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO stores (id, name, site_code, domain, email, is_active, plan_id, stripe_account_id, theme, currency, tax_settings, shipping_settings, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, site_code=EXCLUDED.site_code, domain=EXCLUDED.domain,
        email=EXCLUDED.email, is_active=EXCLUDED.is_active, plan_id=EXCLUDED.plan_id,
        stripe_account_id=EXCLUDED.stripe_account_id, theme=EXCLUDED.theme,
        currency=EXCLUDED.currency, tax_settings=EXCLUDED.tax_settings,
        shipping_settings=EXCLUDED.shipping_settings, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.name, row.site_code, row.domain, row.email, row.is_active,
      row.plan_id, row.stripe_account_id, 
      row.theme ? JSON.stringify(row.theme) : null,
      row.currency || 'TRY',
      row.tax_settings ? JSON.stringify(row.tax_settings) : null,
      row.shipping_settings ? JSON.stringify(row.shipping_settings) : null,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} stores`)
}

async function migrateUsers(mysql: any, pg: any) {
  console.log('Migrating users...')
  const [rows] = await mysql.query('SELECT * FROM users')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO users (id, store_id, name, email, password_hash, role, ai_credits, fcm_token, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, name=EXCLUDED.name, email=EXCLUDED.email,
        password_hash=EXCLUDED.password_hash, role=EXCLUDED.role, ai_credits=EXCLUDED.ai_credits,
        fcm_token=EXCLUDED.fcm_token, is_active=EXCLUDED.is_active, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.name, row.email, row.password_hash,
      row.role || 'staff', row.ai_credits || 0, row.fcm_token,
      row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} users`)
}

async function migratePlans(mysql: any, pg: any) {
  console.log('Migrating plans...')
  const [rows] = await mysql.query('SELECT * FROM plans')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO plans (id, name, price, product_limit, ai_credits, features, stripe_price_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, price=EXCLUDED.price, product_limit=EXCLUDED.product_limit,
        ai_credits=EXCLUDED.ai_credits, features=EXCLUDED.features, stripe_price_id=EXCLUDED.stripe_price_id,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.name, row.price || 0, row.product_limit || 100,
      row.ai_credits || 1000, row.features ? JSON.stringify(row.features) : null,
      row.stripe_price_id, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} plans`)
}

async function migrateSubscriptions(mysql: any, pg: any) {
  console.log('Migrating subscriptions...')
  const [rows] = await mysql.query('SELECT * FROM subscriptions')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO subscriptions (id, store_id, plan_id, stripe_subscription_id, status, trial_ends_at, current_period_end, canceled_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, plan_id=EXCLUDED.plan_id, stripe_subscription_id=EXCLUDED.stripe_subscription_id,
        status=EXCLUDED.status, trial_ends_at=EXCLUDED.trial_ends_at, current_period_end=EXCLUDED.current_period_end,
        canceled_at=EXCLUDED.canceled_at, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.plan_id, row.stripe_subscription_id,
      row.status || 'active', row.trial_ends_at, row.current_period_end,
      row.canceled_at, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} subscriptions`)
}

async function migrateCategories(mysql: any, pg: any) {
  console.log('Migrating categories...')
  const [rows] = await mysql.query('SELECT * FROM categories')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO categories (id, store_id, parent_id, slug, name, translations, icon, sort_order, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, parent_id=EXCLUDED.parent_id, slug=EXCLUDED.slug,
        name=EXCLUDED.name, translations=EXCLUDED.translations, icon=EXCLUDED.icon,
        sort_order=EXCLUDED.sort_order, is_active=EXCLUDED.is_active, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.parent_id, row.slug,
      row.name ? JSON.stringify(row.name) : JSON.stringify({ tr: row.name }),
      row.translations ? JSON.stringify(row.translations) : null,
      row.icon, row.sort_order || 0, row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} categories`)
}

async function migrateMarketplaceIntegrations(mysql: any, pg: any) {
  console.log('Migrating marketplace integrations...')
  const [rows] = await mysql.query('SELECT * FROM marketplace_integrations')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO marketplace_integrations (id, store_id, marketplace, is_active, config, last_sync_at, etsy_category_id, etsy_shipping_profile_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, marketplace=EXCLUDED.marketplace, is_active=EXCLUDED.is_active,
        config=EXCLUDED.config, last_sync_at=EXCLUDED.last_sync_at,
        etsy_category_id=EXCLUDED.etsy_category_id, etsy_shipping_profile_id=EXCLUDED.etsy_shipping_profile_id,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.marketplace, row.is_active !== undefined ? row.is_active : true,
      row.config ? JSON.stringify(row.config) : null, row.last_sync_at,
      row.etsy_category_id, row.etsy_shipping_profile_id, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} marketplace integrations`)
}

async function migrateProducts(mysql: any, pg: any) {
  console.log('Migrating products...')
  const [rows] = await mysql.query('SELECT * FROM products')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO products (id, store_id, title, slug, description, category_id, sku, gram_weight, milyem, effective_milyem, profit_margin, price_multiplier, price_try, price_usd, is_b2b_enabled, b2b_discount, b2b_price, discount_rate, discounted_price, quantity, images, video_url, marketplaces, marketplace_config, has_variants, variant_attributes, tags, is_active, original_product_id, original_store_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, title=EXCLUDED.title, slug=EXCLUDED.slug,
        description=EXCLUDED.description, category_id=EXCLUDED.category_id, sku=EXCLUDED.sku,
        gram_weight=EXCLUDED.gram_weight, milyem=EXCLUDED.milyem, effective_milyem=EXCLUDED.effective_milyem,
        profit_margin=EXCLUDED.profit_margin, price_multiplier=EXCLUDED.price_multiplier,
        price_try=EXCLUDED.price_try, price_usd=EXCLUDED.price_usd,
        is_b2b_enabled=EXCLUDED.is_b2b_enabled, b2b_discount=EXCLUDED.b2b_discount,
        b2b_price=EXCLUDED.b2b_price, discount_rate=EXCLUDED.discount_rate,
        discounted_price=EXCLUDED.discounted_price, quantity=EXCLUDED.quantity,
        images=EXCLUDED.images, video_url=EXCLUDED.video_url,
        marketplaces=EXCLUDED.marketplaces, marketplace_config=EXCLUDED.marketplace_config,
        has_variants=EXCLUDED.has_variants, variant_attributes=EXCLUDED.variant_attributes,
        tags=EXCLUDED.tags, is_active=EXCLUDED.is_active,
        original_product_id=EXCLUDED.original_product_id, original_store_id=EXCLUDED.original_store_id,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.title, row.slug, row.description,
      row.category_id, row.sku, row.gram_weight, row.milyem, row.effective_milyem,
      row.profit_margin || 0, row.price_multiplier || 1.0,
      row.price_try, row.price_usd,
      row.is_b2b_enabled || false, row.b2b_discount || 0, row.b2b_price,
      row.discount_rate || 0, row.discounted_price,
      row.quantity || 0,
      row.images ? JSON.stringify(row.images) : null,
      row.video_url,
      row.marketplaces ? JSON.stringify(row.marketplaces) : null,
      row.marketplace_config ? JSON.stringify(row.marketplace_config) : null,
      row.has_variants || false, row.variant_attributes ? JSON.stringify(row.variant_attributes) : null,
      row.tags ? JSON.stringify(row.tags) : null,
      row.is_active !== undefined ? row.is_active : true,
      row.original_product_id, row.original_store_id,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} products`)
}

async function migrateProductVariants(mysql: any, pg: any) {
  console.log('Migrating product variants...')
  const [rows] = await mysql.query('SELECT * FROM product_variants')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO product_variants (id, product_id, store_id, sku, attributes, gram_weight, quantity, price_try, price_usd, b2b_price, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO UPDATE SET
        product_id=EXCLUDED.product_id, store_id=EXCLUDED.store_id, sku=EXCLUDED.sku,
        attributes=EXCLUDED.attributes, gram_weight=EXCLUDED.gram_weight, quantity=EXCLUDED.quantity,
        price_try=EXCLUDED.price_try, price_usd=EXCLUDED.price_usd, b2b_price=EXCLUDED.b2b_price,
        is_active=EXCLUDED.is_active, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.product_id, row.store_id, row.sku,
      row.attributes ? JSON.stringify(row.attributes) : null,
      row.gram_weight, row.quantity || 0, row.price_try, row.price_usd,
      row.b2b_price, row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} product variants`)
}

async function migrateB2BSettings(mysql: any, pg: any) {
  console.log('Migrating B2B settings...')
  const [rows] = await mysql.query('SELECT * FROM product_b2b_settings')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO product_b2b_settings (id, store_id, product_id, is_b2b_enabled, b2b_discount, b2b_price, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, product_id=EXCLUDED.product_id,
        is_b2b_enabled=EXCLUDED.is_b2b_enabled, b2b_discount=EXCLUDED.b2b_discount,
        b2b_price=EXCLUDED.b2b_price, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.product_id, row.is_b2b_enabled || false,
      row.b2b_discount || 0, row.b2b_price, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} B2B settings`)
}

async function migrateB2BRequests(mysql: any, pg: any) {
  console.log('Migrating B2B requests...')
  const [rows] = await mysql.query('SELECT * FROM b2b_requests')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO b2b_requests (id, product_id, variant_id, requester_store_id, owner_store_id, status, request_note, profit_margin, marketplaces, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        product_id=EXCLUDED.product_id, variant_id=EXCLUDED.variant_id,
        requester_store_id=EXCLUDED.requester_store_id, owner_store_id=EXCLUDED.owner_store_id,
        status=EXCLUDED.status, request_note=EXCLUDED.request_note,
        profit_margin=EXCLUDED.profit_margin, marketplaces=EXCLUDED.marketplaces,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.product_id, row.variant_id, row.requester_store_id, row.owner_store_id,
      row.status || 'pending', row.request_note, row.profit_margin || 0,
      row.marketplaces ? JSON.stringify(row.marketplaces) : null,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} B2B requests`)
}

async function migrateB2BListedProducts(mysql: any, pg: any) {
  console.log('Migrating B2B listed products...')
  const [rows] = await mysql.query('SELECT * FROM b2b_listed_products')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO b2b_listed_products (id, store_id, original_store_id, product_id, original_product_id, b2b_request_id, profit_margin, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, original_store_id=EXCLUDED.original_store_id,
        product_id=EXCLUDED.product_id, original_product_id=EXCLUDED.original_product_id,
        b2b_request_id=EXCLUDED.b2b_request_id, profit_margin=EXCLUDED.profit_margin,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.original_store_id, row.product_id,
      row.original_product_id, row.b2b_request_id, row.profit_margin || 0,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} B2B listed products`)
}

async function migrateDropshippingOrders(mysql: any, pg: any) {
  console.log('Migrating dropshipping orders...')
  const [rows] = await mysql.query('SELECT * FROM dropshipping_orders')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO dropshipping_orders (id, store_id, order_number, marketplace, marketplace_order_id, marketplace_order_number, status, total_amount, currency, shipping_address, items, tracking_number, carrier, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, order_number=EXCLUDED.order_number, marketplace=EXCLUDED.marketplace,
        marketplace_order_id=EXCLUDED.marketplace_order_id, marketplace_order_number=EXCLUDED.marketplace_order_number,
        status=EXCLUDED.status, total_amount=EXCLUDED.total_amount, currency=EXCLUDED.currency,
        shipping_address=EXCLUDED.shipping_address, items=EXCLUDED.items,
        tracking_number=EXCLUDED.tracking_number, carrier=EXCLUDED.carrier,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.order_number, row.marketplace, row.marketplace_order_id,
      row.marketplace_order_number, row.status || 'pending', row.total_amount,
      row.currency || 'TRY', row.shipping_address ? JSON.stringify(row.shipping_address) : '{}',
      row.items ? JSON.stringify(row.items) : '[]', row.tracking_number, row.carrier,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} dropshipping orders`)
}

async function migrateOrderStatusHistories(mysql: any, pg: any) {
  console.log('Migrating order status histories...')
  const [rows] = await mysql.query('SELECT * FROM order_status_histories')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO order_status_histories (id, dropshipping_order_id, from_status, to_status, note, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        dropshipping_order_id=EXCLUDED.dropshipping_order_id, from_status=EXCLUDED.from_status,
        to_status=EXCLUDED.to_status, note=EXCLUDED.note
    `, [
      row.id, row.dropshipping_order_id, row.from_status, row.to_status,
      row.note, row.created_at
    ])
  }
  console.log(`  Migrated ${rows.length} order status histories`)
}

async function migrateApiKeys(mysql: any, pg: any) {
  console.log('Migrating API keys...')
  const [rows] = await mysql.query('SELECT * FROM api_keys')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO api_keys (id, store_id, key_hash, name, allowed_ips, expires_at, last_used_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, key_hash=EXCLUDED.key_hash, name=EXCLUDED.name,
        allowed_ips=EXCLUDED.allowed_ips, expires_at=EXCLUDED.expires_at,
        last_used_at=EXCLUDED.last_used_at, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.key_hash, row.name,
      row.allowed_ips ? JSON.stringify(row.allowed_ips) : null,
      row.expires_at, row.last_used_at, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} API keys`)
}

async function migrateCreditLogs(mysql: any, pg: any) {
  console.log('Migrating credit logs...')
  const [rows] = await mysql.query('SELECT * FROM credit_logs')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO credit_logs (id, user_id, store_id, action, module, amount, balance_before, balance_after, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        user_id=EXCLUDED.user_id, store_id=EXCLUDED.store_id, action=EXCLUDED.action,
        module=EXCLUDED.module, amount=EXCLUDED.amount, balance_before=EXCLUDED.balance_before,
        balance_after=EXCLUDED.balance_after
    `, [
      row.id, row.user_id, row.store_id, row.action, row.module,
      row.amount, row.balance_before, row.balance_after, row.created_at
    ])
  }
  console.log(`  Migrated ${rows.length} credit logs`)
}

async function migratePages(mysql: any, pg: any) {
  console.log('Migrating pages...')
  const [rows] = await mysql.query('SELECT * FROM pages')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO pages (id, store_id, slug, title, content, meta, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, slug=EXCLUDED.slug, title=EXCLUDED.title,
        content=EXCLUDED.content, meta=EXCLUDED.meta, is_active=EXCLUDED.is_active,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.slug,
      row.title ? JSON.stringify(row.title) : null,
      row.content ? JSON.stringify(row.content) : null,
      row.meta ? JSON.stringify(row.meta) : null,
      row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} pages`)
}

async function migrateStoreLocations(mysql: any, pg: any) {
  console.log('Migrating store locations...')
  const [rows] = await mysql.query('SELECT * FROM store_locations')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO store_locations (id, store_id, name, address, coordinates, phone, hours, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, name=EXCLUDED.name, address=EXCLUDED.address,
        coordinates=EXCLUDED.coordinates, phone=EXCLUDED.phone, hours=EXCLUDED.hours,
        is_active=EXCLUDED.is_active, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.name, row.address,
      row.coordinates ? JSON.stringify(row.coordinates) : null,
      row.phone, row.hours ? JSON.stringify(row.hours) : null,
      row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} store locations`)
}

async function migrateStorePaymentMethods(mysql: any, pg: any) {
  console.log('Migrating store payment methods...')
  const [rows] = await mysql.query('SELECT * FROM store_payment_methods')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO store_payment_methods (id, store_id, type, config, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, type=EXCLUDED.type, config=EXCLUDED.config,
        is_active=EXCLUDED.is_active, updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.type,
      row.config ? JSON.stringify(row.config) : '{}',
      row.is_active !== undefined ? row.is_active : true,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} store payment methods`)
}

async function migrateExternalFeeds(mysql: any, pg: any) {
  console.log('Migrating external feeds...')
  const [rows] = await mysql.query('SELECT * FROM external_feeds')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO external_feeds (id, store_id, name, url, format, mapping, schedule, is_active, last_sync_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, name=EXCLUDED.name, url=EXCLUDED.url,
        format=EXCLUDED.format, mapping=EXCLUDED.mapping, schedule=EXCLUDED.schedule,
        is_active=EXCLUDED.is_active, last_sync_at=EXCLUDED.last_sync_at,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.name, row.url, row.format,
      row.mapping ? JSON.stringify(row.mapping) : null,
      row.schedule, row.is_active !== undefined ? row.is_active : true,
      row.last_sync_at, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} external feeds`)
}

async function migrateFeedSyncLogs(mysql: any, pg: any) {
  console.log('Migrating feed sync logs...')
  const [rows] = await mysql.query('SELECT * FROM feed_sync_logs')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO feed_sync_logs (id, feed_id, status, products_processed, products_created, products_updated, products_failed, error_message, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        feed_id=EXCLUDED.feed_id, status=EXCLUDED.status, products_processed=EXCLUDED.products_processed,
        products_created=EXCLUDED.products_created, products_updated=EXCLUDED.products_updated,
        products_failed=EXCLUDED.products_failed, error_message=EXCLUDED.error_message
    `, [
      row.id, row.feed_id, row.status, row.products_processed || 0,
      row.products_created || 0, row.products_updated || 0, row.products_failed || 0,
      row.error_message, row.created_at
    ])
  }
  console.log(`  Migrated ${rows.length} feed sync logs`)
}

async function migrateVariations(mysql: any, pg: any) {
  console.log('Migrating variations...')
  const [rows] = await mysql.query('SELECT * FROM variations')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO variations (id, store_id, name, type, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        store_id=EXCLUDED.store_id, name=EXCLUDED.name, type=EXCLUDED.type,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.store_id, row.name, row.type, row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} variations`)
}

async function migrateVariationOptions(mysql: any, pg: any) {
  console.log('Migrating variation options...')
  const [rows] = await mysql.query('SELECT * FROM variation_options')
  
  for (const row of rows) {
    await pg.query(`
      INSERT INTO variation_options (id, variation_id, value, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        variation_id=EXCLUDED.variation_id, value=EXCLUDED.value, sort_order=EXCLUDED.sort_order,
        updated_at=EXCLUDED.updated_at
    `, [
      row.id, row.variation_id, row.value, row.sort_order || 0,
      row.created_at, row.updated_at
    ])
  }
  console.log(`  Migrated ${rows.length} variation options`)
}

migrate().catch(console.error)