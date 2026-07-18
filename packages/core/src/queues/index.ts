import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config/env.js';

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
  marketplaces: string[];
  trigger: 'create' | 'update' | 'manual';
}

interface ImportJobData {
  marketplace: string;
  storeId: number;
  maxPages: number;
}

export async function createSyncWorker() {
  return new Worker<SyncJobData>(
    'product-sync',
    async (job: Job<SyncJobData>) => {
      const { productId, storeId, marketplaces, trigger } = job.data;
      console.log(`Syncing product ${productId} to ${marketplaces.join(', ')} (trigger: ${trigger})`);

      const Product = (await import('../../models/Product.model.js')).Product;
      const ProductMarketplaceListing = (await import('../../models/ProductMarketplaceListing.model.js')).ProductMarketplaceListing;
      const MarketplaceIntegration = (await import('../../models/MarketplaceIntegration.model.js')).MarketplaceIntegration;
      const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');

      const product = await Product.findByPk(productId);
      if (!product || product.storeId !== storeId) {
        throw new Error('Product not found');
      }

      const integrations = await MarketplaceIntegration.findAll({
        where: { storeId, marketplace: marketplaces, isActive: true },
      });

      const results: any[] = [];

      for (const integration of integrations) {
        try {
          const mpConfig = getMarketplaceConfig(integration.marketplace as any, integration);
          const client = createMarketplaceClient(integration.marketplace as any, mpConfig);

          let listing = await ProductMarketplaceListing.findOne({
            where: { productId: product.id, platform: integration.marketplace },
          });

          if (!listing) {
            const created = await client.createProduct(mapProductToMarketplace(product, integration.marketplace));
            listing = await ProductMarketplaceListing.create({
              productId: product.id,
              storeId,
              platform: integration.marketplace,
              externalId: created.id || created.externalId,
              status: 'active',
              lastSyncedAt: new Date(),
            });
          } else if (listing.status === 'active') {
            const updated = await client.updateProduct(listing.externalId!, mapProductToMarketplace(product, integration.marketplace));
            await listing.update({ lastSyncedAt: new Date() });
          }

          results.push({ marketplace: integration.marketplace, success: true, listingId: listing.id });
        } catch (error: any) {
          console.error(`Sync failed for ${integration.marketplace}:`, error);
          await ProductMarketplaceListing.update(
            { status: 'failed', lastError: error.message },
            { where: { productId, platform: integration.marketplace } }
          );
          results.push({ marketplace: integration.marketplace, success: false, error: error.message });
        }
      }

      return { productId, results };
    },
    { connection: { url: config.redis.url } }
  );
}

export async function createImportWorker() {
  return new Worker<ImportJobData>(
    'marketplace-import',
    async (job: Job<ImportJobData>) => {
      const { marketplace, storeId, maxPages } = job.data;
      console.log(`Importing from ${marketplace} for store ${storeId} (max ${maxPages} pages)`);

      const MarketplaceIntegration = (await import('../../models/MarketplaceIntegration.model.js')).MarketplaceIntegration;
      const Product = (await import('../../models/Product.model.js')).Product;
      const ProductMarketplaceListing = (await import('../../models/ProductMarketplaceListing.model.js')).ProductMarketplaceListing;
      const { createMarketplaceClient, getMarketplaceConfig } = await import('../../marketplace/clients/index.js');

      const integration = await MarketplaceIntegration.findOne({
        where: { storeId, marketplace, isActive: true },
      });

      if (!integration) throw new Error('Integration not found or inactive');

      const mpConfig = getMarketplaceConfig(marketplace as any, integration);
      const client = createMarketplaceClient(marketplace as any, mpConfig);

      let totalImported = 0;
      let totalFailed = 0;

      for (let page = 1; page <= maxPages; page++) {
        await job.updateProgress(Math.round((page / maxPages) * 100));

        try {
          const { products, hasMore } = await client.getProducts({ page, size: 50 });

          for (const mpProduct of products) {
            try {
              const existing = await Product.findOne({
                where: { storeId, sku: mpProduct.sku || mpProduct.stockCode || mpProduct.merchantSku },
              });

              const mapped = mapMarketplaceProduct(mpProduct, marketplace);

              let product;
              if (existing) {
                product = await existing.update({ ...mapped, marketplaceConfig: { ...existing.marketplaceConfig, [marketplace]: mpProduct } });
              } else {
                product = await Product.create({ ...mapped, storeId, sku: mapped.sku || `MP-${Date.now()}`, isActive: true });
              }

              await ProductMarketplaceListing.upsert({
                productId: product.id,
                storeId,
                platform: marketplace,
                externalId: mpProduct.id || mpProduct.productId || mpProduct.listingId,
                externalCode: mpProduct.sku || mpProduct.stockCode || mpProduct.merchantSku,
                status: 'active',
                lastSyncedAt: new Date(),
              });

              totalImported++;
            } catch (error) {
              console.error(`Failed to import product:`, error);
              totalFailed++;
            }
          }

          if (!hasMore) break;
        } catch (error) {
          console.error(`Page ${page} import failed:`, error);
          totalFailed += maxPages;
        }
      }

      await integration.update({ lastSyncAt: new Date() });
      return { marketplace, imported: totalImported, failed: totalFailed };
    },
    { connection: { url: config.redis.url } }
  );
}

function mapProductToMarketplace(product: any, marketplace: string): any {
  const base = {
    title: product.title,
    description: product.description,
    sku: product.sku,
    price: product.priceTRY,
    quantity: product.quantity,
    images: product.images || [],
    categoryId: product.categoryId,
    attributes: product.variantAttributes || {},
  };

  switch (marketplace) {
    case 'trendyol':
      return { ...base, barcode: product.sku, brandId: 0, categoryId: product.marketplaceConfig?.trendyol?.categoryId, vatRate: 18 };
    case 'hepsiburada':
      return { ...base, merchantSku: product.sku, cargoCompanyId: 1, deliveryDuration: 2, vatRate: 18 };
    case 'pazarama':
      return { ...base, price: product.priceTRY, stock: product.quantity, vatRate: 18 };
    case 'n11':
      return { ...base, productSellerCode: product.sku, currencyType: 'TRY', vatRate: 18 };
    case 'etsy':
      return { ...base, price: product.priceTRY, currency_code: 'TRY', quantity: product.quantity };
    default:
      return base;
  }
}

function mapMarketplaceProduct(mpProduct: any, marketplace: string): any {
  const base = {
    title: mpProduct.title || mpProduct.name || mpProduct.productName,
    sku: mpProduct.sku || mpProduct.stockCode || mpProduct.merchantSku || mpProduct.productSellerCode,
    priceTRY: mpProduct.price || mpProduct.salePrice || mpProduct.listPrice || mpProduct.list_price,
    quantity: mpProduct.quantity || mpProduct.stock || mpProduct.stockQuantity,
    images: mpProduct.images || mpProduct.imageUrls || [],
    description: mpProduct.description,
    categoryId: mpProduct.categoryId,
    marketplaceConfig: { [marketplace]: mpProduct },
  };

  if (mpProduct.gramWeight) base['gramWeight'] = mpProduct.gramWeight;
  if (mpProduct.milyem) base['milyem'] = mpProduct.milyem;

  return base;
}

export async function closeQueues() {
  await Promise.all([syncQueue.close(), importQueue.close(), webhookQueue.close()]);
}