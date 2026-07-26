import axios from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createMarketplaceClient } from '../utils/marketplaceClientFactory.js';
import { mapMarketplaceOrder } from './orderMapper.js';
import { orderNotifyQueue } from '../queues/index.js';

const CORE_CLIENT = axios.create({
  baseURL: config.coreApiUrl,
  headers: { 'x-internal-key': config.coreApiKey },
  timeout: 15000,
});

interface ActiveIntegration {
  storeId: number;
  marketplace: string;
  config: Record<string, any>;
}

function getSinceDate(): string {
  const since = new Date(Date.now() - 3600_000);
  return since.toISOString();
}

export async function pullOrdersForIntegration(
  integration: ActiveIntegration,
): Promise<{ imported: number; failed: number }> {
  let imported = 0;
  let failed = 0;

  try {
    const client = createMarketplaceClient(integration.marketplace, integration.config);
    const since = getSinceDate();
    let page = 0;
    let hasMore = true;
    const maxPages = 5;

    while (hasMore && page < maxPages) {
      page++;
      const rawOrders = await client.getOrders({
        page,
        size: 50,
        startDate: since,
      });

      if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
        hasMore = false;
        break;
      }

      for (const raw of rawOrders) {
        try {
          const normalized = mapMarketplaceOrder(integration.marketplace, raw);
          const response = await CORE_CLIENT.post('/api/admin/integration/webhook/order', {
            marketplace: integration.marketplace,
            storeId: integration.storeId,
            payload: {
              marketplaceOrderId: normalized.marketplaceOrderId,
              marketplaceOrderNumber: normalized.marketplaceOrderNumber,
              items: normalized.items.map((i) => ({
                sku: i.sku,
                name: i.name,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
              })),
              totalAmount: normalized.totalAmount,
              currency: normalized.currency,
              customerName: normalized.customer.name,
              customerEmail: normalized.customer.email,
              customerPhone: normalized.customer.phone,
              shippingAddress: {
                fullAddress: normalized.customer.address,
                city: normalized.customer.city,
                country: normalized.customer.country,
              },
              createdAt: normalized.createdAt,
              rawPayload: normalized.rawPayload,
            },
          });
          if (response.data?.created === false) {
            logger.debug({ marketplace: integration.marketplace, orderId: normalized.marketplaceOrderId }, 'Order already exists, skipping');
          } else {
            imported++;
            await orderNotifyQueue.add('notify-new-order', {
              storeId: integration.storeId,
              marketplace: integration.marketplace,
              orderId: normalized.marketplaceOrderId,
              itemCount: normalized.items.length,
              totalAmount: normalized.totalAmount,
              currency: normalized.currency,
            });
            logger.info({ marketplace: integration.marketplace, orderId: normalized.marketplaceOrderId }, 'Order imported');
          }
        } catch (err: any) {
          if (err.response?.status === 409) {
            logger.debug({ marketplace: integration.marketplace }, 'Order already exists (409)');
            imported++;
          } else {
            failed++;
            logger.error({ err: err.message, marketplace: integration.marketplace }, 'Failed to import order');
          }
        }
      }

      if (rawOrders.length < 50) {
        hasMore = false;
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message, marketplace: integration.marketplace }, 'Order pull failed for integration');
    failed++;
  }

  return { imported, failed };
}

export async function pullAllOrders(): Promise<{ total: number; failed: number; details: Record<string, any> }> {
  let total = 0;
  let failed = 0;
  const details: Record<string, any> = {};

  try {
    const response = await CORE_CLIENT.get('/api/admin/integrations/active');
    const integrations: ActiveIntegration[] = response.data?.integrations || [];

    for (const integration of integrations) {
      const key = `${integration.marketplace}_${integration.storeId}`;
      try {
        const result = await pullOrdersForIntegration(integration);
        total += result.imported;
        failed += result.failed;
        details[key] = { imported: result.imported, failed: result.failed };
        logger.info({ marketplace: integration.marketplace, storeId: integration.storeId, result }, 'Pull completed');
      } catch (err: any) {
        failed++;
        details[key] = { error: err.message };
        logger.error({ err: err.message, marketplace: integration.marketplace, storeId: integration.storeId }, 'Pull failed');
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to fetch active integrations from core');
    throw err;
  }

  return { total, failed, details };
}