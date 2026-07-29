import axios from 'axios';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createMarketplaceClient } from '../utils/marketplaceClientFactory.js';
import { INTERNAL_STATUS_TO_MARKETPLACE } from './orderMapper.js';

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

async function getIntegration(storeId: number, marketplace: string): Promise<ActiveIntegration | null> {
  try {
    const response = await CORE_CLIENT.get('/api/admin/integrations/active', {
      params: { storeId, marketplace },
    });
    const integrations: ActiveIntegration[] = response.data?.integrations || [];
    return integrations[0] || null;
  } catch (err: any) {
    logger.error({ err: err.message, storeId, marketplace }, 'Failed to get integration config');
    return null;
  }
}

export async function pushOrderStatus(
  storeId: number,
  marketplace: string,
  externalId: string,
  newStatus: string,
  lineIds?: number[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getIntegration(storeId, marketplace);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const client = createMarketplaceClient(marketplace, integration.config);

    if (marketplace === 'trendyol') {
      await client.approveOrder(externalId);
      await CORE_CLIENT.post('/api/admin/integration/logs', {
        marketplace,
        storeId,
        action: 'approve_order',
        endpoint: `trendyol/order/approve`,
        isSuccess: true,
        requestPayload: { externalId },
        responsePayload: { success: true },
      });
      return { success: true };
    }

    const mpStatus = INTERNAL_STATUS_TO_MARKETPLACE[marketplace]?.[newStatus] || newStatus;

    if (marketplace === 'n11' && lineIds && lineIds.length > 0) {
      await client.updateOrderStatus(lineIds, mpStatus);
    } else if (marketplace === 'hepsiburada') {
      const headers = { Authorization: `Basic ${Buffer.from(`${integration.config.username}:${integration.config.password}`).toString('base64')}` };
      await axios.put(
        `${config.coreApiUrl}/api/admin/integration/webhook/order-status`,
        { marketplace, storeId, externalId, status: mpStatus },
        { headers: { 'x-internal-key': config.coreApiKey, ...headers } },
      );
    } else {
      return { success: false, error: `Status push not supported for ${marketplace}` };
    }

    await CORE_CLIENT.post('/api/admin/integration/logs', {
      marketplace,
      storeId,
      action: 'status_update',
      endpoint: `${marketplace}/order/status`,
      isSuccess: true,
      requestPayload: { externalId, status: mpStatus },
      responsePayload: { success: true },
    });

    return { success: true };
  } catch (err: any) {
    const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.error({ err: msg, marketplace, externalId, newStatus }, 'Failed to push order status');

    await CORE_CLIENT.post('/api/admin/integration/logs', {
      marketplace,
      storeId,
      action: 'status_update',
      endpoint: `${marketplace}/order/status`,
      isSuccess: false,
      requestPayload: { externalId, status: newStatus },
      errorMessage: msg,
    }).catch(() => {});

    return { success: false, error: msg };
  }
}

export async function pushOrderTracking(
  storeId: number,
  marketplace: string,
  externalId: string,
  trackingNumber: string,
  carrier: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const integration = await getIntegration(storeId, marketplace);
    if (!integration) {
      return { success: false, error: 'Integration not found' };
    }

    const client = createMarketplaceClient(marketplace, integration.config);

    if (marketplace === 'trendyol') {
      await client.updateTracking(externalId, trackingNumber, carrier);
    } else if (marketplace === 'n11') {
      await client.updateTracking(externalId, trackingNumber, carrier);
    } else {
      return { success: false, error: `Tracking push not supported for ${marketplace}` };
    }

    await CORE_CLIENT.post('/api/admin/integration/logs', {
      marketplace,
      storeId,
      action: 'tracking_update',
      endpoint: `${marketplace}/order/tracking`,
      isSuccess: true,
      requestPayload: { externalId, trackingNumber, carrier },
      responsePayload: { success: true },
    });

    return { success: true };
  } catch (err: any) {
    const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.error({ err: msg, marketplace, externalId, trackingNumber, carrier }, 'Failed to push tracking');

    await CORE_CLIENT.post('/api/admin/integration/logs', {
      marketplace,
      storeId,
      action: 'tracking_update',
      endpoint: `${marketplace}/order/tracking`,
      isSuccess: false,
      requestPayload: { externalId, trackingNumber, carrier },
      errorMessage: msg,
    }).catch(() => {});

    return { success: false, error: msg };
  }
}