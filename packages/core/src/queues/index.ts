import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import { Product } from '../models/Product.model.js';
import { ProductMarketplaceListing } from '../models/ProductMarketplaceListing.model.js';
import { MarketplaceIntegration } from '../models/MarketplaceIntegration.model.js';
import { IntegrationLog } from '../models/LogModels.js';
import { Store } from '../models/Store.model.js';
import { createMarketplaceClient, getMarketplaceConfig, MarketplaceType } from '../marketplace/clients/index.js';
import { logger } from '../utils/logger.js';

export const syncQueue = new Queue('product-sync', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 },
});

export const importQueue = new Queue('marketplace-import', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 50, removeOnFail: 20 },
});

export const webhookQueue = new Queue('webhook-processing', {
  connection: { url: config.redis.url },
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 200, removeOnFail: 100 },
});

interface SyncJobData {
  productId: number;
  storeId: number;
  marketplaces?: string[];
  trigger: 'create' | 'update' | 'manual';
}

interface ImportJobData {
  marketplace: string;
  storeId: number;
  maxPages: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 190);
}

async function logIntegration(storeId: number, platform: string, endpoint: string, method: string, isSuccess: boolean, requestPayload?: any, responsePayload?: any, errorMessage?: string) {
  try {
    await IntegrationLog.create({ storeId, platform, endpoint, method, isSuccess, requestPayload, responsePayload, errorMessage });
  } catch (e) {
    logger.error({ err: e }, 'Failed to write integration log');
  }
}

function marketplacePrice(mp: string, raw: any): { priceTRY?: number; priceUSD?: number } {
  const currency = raw.currency || (raw.price?.currency ?? null);
  const priceVal = raw.salePrice ?? raw.listPrice ?? raw.price?.amount ?? raw.price ?? 0;
  if (currency === 'USD' || currency === 'EUR' || currency === 'GBP') {
    return { priceUSD: Number(priceVal) };
  }
  if (currency === 'TRY' || !currency) {
    return { priceTRY: Number(priceVal) };
  }
  return { priceTRY: Number(priceVal) };
}

function mapMarketplaceProduct(mp: string, raw: any, storeId: number): Partial<Product> {
  const base = {
    storeId,
    title: raw.title || raw.name || 'Imported Product',
    sku: raw.barcode || raw.stockCode || raw.merchantSku || raw.sku || raw.productCode || raw.asin || raw.sellerSKU || `imp-${Date.now()}`,
    description: raw.description || raw.itemDescription || '',
    quantity: raw.quantity || raw.stockAmount || raw.stock || raw.stockQuantity || raw.availableStock || raw.fulfillmentAvailability?.availability?.availableQuantity || 0,
    images: [] as string[],
    isActive: true,
    ...marketplacePrice(mp, raw),
  };
  switch (mp) {
    case 'trendyol':
      return {
        ...base,
        images: (raw.images || []).map((img: any) => img.url || img),
      };
    case 'hepsiburada':
      return {
        ...base,
        images: (raw.images || []).map((img: any) => typeof img === 'string' ? img : img.url || ''),
      };
    case 'pazarama':
      return {
        ...base,
        images: Array.isArray(raw.images) ? raw.images : [],
      };
    case 'n11':
      return {
        ...base,
        images: raw.images ? (Array.isArray(raw.images) ? raw.images : [raw.images]) : [],
      };
    case 'amazon':
      return {
        ...base,
        images: (raw.images || []).map((img: any) => typeof img === 'string' ? img : img.url || ''),
      };
    case 'etsy':
      return {
        ...base,
        images: (raw.images || []).map((img: any) => img.url_fullxfull || img.url_570xN || img.url || ''),
      };
    default:
      return base;
  }
}

function getExternalId(mp: string, raw: any): string {
  switch (mp) {
    case 'trendyol': return raw.barcode || raw.stockCode || '';
    case 'hepsiburada': return raw.merchantSku || raw.barcode || '';
    case 'pazarama': return raw.barcode || raw.sku || '';
    case 'n11': return raw.productCode || raw.id?.toString() || '';
    case 'amazon': return raw.asin || raw.sellerSKU || raw.sku || '';
    case 'etsy': return raw.listing_id?.toString() || raw.sku || '';
    default: return '';
  }
}

export async function createImportWorker() {
  return new Worker<ImportJobData>(
    'marketplace-import',
    async (job: Job<ImportJobData>) => {
      const { marketplace, storeId, maxPages } = job.data;
      logger.info({ marketplace, storeId }, 'Starting marketplace import');

      const integration = await MarketplaceIntegration.findOne({
        where: { storeId, marketplace, isActive: true },
      });
      if (!integration) {
        logger.warn({ marketplace, storeId }, 'Integration not found or inactive');
        return { success: false, reason: 'Integration not found or inactive' };
      }

      const mpConfig = getMarketplaceConfig(marketplace as MarketplaceType, integration);
      const client = createMarketplaceClient(marketplace as MarketplaceType, mpConfig);

      let totalImported = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      let hasMore = true;
      let page = 0;

      while (hasMore && page < maxPages) {
        try {
          const result = await client.getProducts({ page, size: 50 });
          const products = result.products || [];
          hasMore = result.hasMore;

          for (const raw of products) {
            let mapped: any;
            try {
              mapped = mapMarketplaceProduct(marketplace, raw, storeId);
              if (!mapped.sku) continue;

              const slug = slugify(mapped.title!);
              mapped.slug = `${slug}-${Date.now()}`;

              const [product, created] = await Product.upsert({
                ...mapped,
                storeId,
                sku: mapped.sku,
              } as any);

              const externalId = getExternalId(marketplace, raw);
              if (externalId) {
                await ProductMarketplaceListing.upsert({
                  productId: product.id,
                  storeId,
                  platform: marketplace,
                  externalId,
                  status: 'active',
                  lastSyncedAt: new Date(),
                } as any);
              }

              if (created) totalImported++;
              else totalUpdated++;
            } catch (err: any) {
              totalFailed++;
              logger.error({ err, sku: mapped?.sku || 'unknown' }, 'Failed to upsert imported product');
              await logIntegration(storeId, marketplace, 'import-upsert', 'POST', false, undefined, undefined, err.message);
            }
          }

          page++;
          if (hasMore) {
            await job.updateProgress(Math.round((page / maxPages) * 100));
          }
        } catch (err: any) {
          logger.error({ err, marketplace, page }, 'Failed to fetch page from marketplace');
          hasMore = false;
          await logIntegration(storeId, marketplace, `import-fetch?page=${page}`, 'GET', false, undefined, undefined, err.message);
        }
      }

      await logIntegration(storeId, marketplace, 'import', 'POST', true, { maxPages, pagesFetched: page }, { imported: totalImported, updated: totalUpdated, failed: totalFailed });

      logger.info({ marketplace, storeId, imported: totalImported, updated: totalUpdated, failed: totalFailed }, 'Marketplace import completed');
      return { success: true, marketplace, imported: totalImported, updated: totalUpdated, failed: totalFailed, pagesFetched: page };
    },
    { connection: { url: config.redis.url }, concurrency: 2 }
  );
}

export async function createSyncWorker() {
  return new Worker<SyncJobData>(
    'product-sync',
    async (job: Job<SyncJobData>) => {
      const { productId, storeId, marketplaces, trigger } = job.data;
      logger.info({ productId, storeId, trigger }, 'Starting product sync');

      const product = await Product.findOne({
        where: { id: productId, storeId },
        include: [{ model: ProductMarketplaceListing, as: 'marketplaceListings' }],
      });
      if (!product) {
        logger.warn({ productId, storeId }, 'Product not found for sync');
        return { success: false, reason: 'Product not found' };
      }

      const targetMps = marketplaces || product.marketplaces || [];
      if (targetMps.length === 0) {
        const integrations = await MarketplaceIntegration.findAll({
          where: { storeId, isActive: true },
        });
        targetMps.push(...integrations.map(i => i.marketplace));
      }

      const results: Record<string, any> = {};

      for (const mp of targetMps) {
        try {
          const integration = await MarketplaceIntegration.findOne({
            where: { storeId, marketplace: mp, isActive: true },
          });
          if (!integration) {
            results[mp] = { success: false, reason: 'Integration not active' };
            continue;
          }

          const mpConfig = getMarketplaceConfig(mp as MarketplaceType, integration);
          const client = createMarketplaceClient(mp as MarketplaceType, mpConfig);

          const existingListing = product.marketplaceListings?.find(l => l.platform === mp);

          const pushPrice = product.priceTRY ?? product.priceUSD ?? 0;
          if (existingListing?.externalId) {
            await client.updateProduct(existingListing.externalId, {
              title: product.title,
              description: product.description,
              salePrice: pushPrice,
              quantity: product.quantity,
              images: product.images?.map(url => ({ url })),
            });
            if (pushPrice > 0) {
              await client.updatePrice(existingListing.externalId, pushPrice);
            }
            if (product.quantity != null) {
              await client.updateStock(existingListing.externalId, product.quantity);
            }
            await existingListing.update({ status: 'active', lastSyncedAt: new Date(), lastError: null });
            results[mp] = { success: true, action: 'updated' };
          } else {
            const listingResult = await client.createProduct({
              title: product.title,
              description: product.description,
              salePrice: pushPrice,
              listPrice: pushPrice,
              quantity: product.quantity,
              barcode: product.sku,
              stockCode: product.sku,
              images: product.images?.map(url => ({ url })),
            });

            const externalId = typeof listingResult === 'string' ? listingResult : listingResult?.batchRequestId || listingResult?.listing_id?.toString() || '';
            await ProductMarketplaceListing.create({
              productId: product.id,
              storeId,
              platform: mp,
              externalId,
              status: 'active',
              lastSyncedAt: new Date(),
            } as any);
            results[mp] = { success: true, action: 'created', externalId };
          }

          await logIntegration(storeId, mp, `sync-product/${productId}`, 'POST', true, { trigger }, {}, undefined);
        } catch (err: any) {
          logger.error({ err, mp, productId }, 'Failed to sync product to marketplace');
          await logIntegration(storeId, mp, `sync-product/${productId}`, 'POST', false, undefined, undefined, err.message);

          const listing = await ProductMarketplaceListing.findOne({ where: { productId: product.id, storeId, platform: mp } });
          if (listing) {
            await listing.update({ status: 'failed', lastError: err.message });
          }
          results[mp] = { success: false, error: err.message };
        }
      }

      logger.info({ productId, storeId, results }, 'Product sync completed');
      return { success: true, productId, trigger, results };
    },
    { connection: { url: config.redis.url }, concurrency: 3 }
  );
}

export async function createWebhookWorker() {
  return new Worker(
    'webhook-processing',
    async (job: Job) => {
      const { type, data, storeId } = job.data || {};
      logger.info({ type, storeId }, 'Processing webhook');

      try {
        if (type === 'order') {
          const { DropshippingOrder } = await import('../models/DropshippingOrder.model.js');
          const { OrderStatusHistory } = await import('../models/OrderStatusHistory.model.js');
          const existing = await DropshippingOrder.findOne({
            where: { marketplaceOrderId: data.marketplaceOrderId, storeId },
          });
          if (!existing) {
            await DropshippingOrder.create({
              storeId,
              marketplace: data.marketplace,
              marketplaceOrderId: data.marketplaceOrderId,
              marketplaceOrderNumber: data.marketplaceOrderNumber,
              totalAmount: data.totalAmount,
              shippingAddress: data.shippingAddress,
              items: data.items,
              status: 'pending',
            } as any);
            logger.info({ marketplaceOrderId: data.marketplaceOrderId }, 'Order created from webhook');
          } else {
            logger.info({ marketplaceOrderId: data.marketplaceOrderId }, 'Order already exists, skipping');
          }
        } else if (type === 'stock') {
          if (data.sku && data.quantity != null) {
            const product = await Product.findOne({ where: { storeId, sku: data.sku } });
            if (product) {
              await product.update({ quantity: data.quantity });
              logger.info({ sku: data.sku, quantity: data.quantity }, 'Stock updated from webhook');
            }
          }
        } else if (type === 'price') {
          if (data.sku && data.price != null) {
            const product = await Product.findOne({ where: { storeId, sku: data.sku } });
            if (product) {
              await product.update({ priceTRY: data.price });
              logger.info({ sku: data.sku, price: data.price }, 'Price updated from webhook');
            }
          }
        }

        return { success: true, type };
      } catch (err: any) {
        logger.error({ err, type }, 'Webhook processing failed');
        return { success: false, error: err.message };
      }
    },
    { connection: { url: config.redis.url }, concurrency: 5 }
  );
}