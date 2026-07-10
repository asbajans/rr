import { getIntegrations } from '../integrations/factory';
import { IntegrationInterface } from '../integrations/IntegrationInterface';
import { mapToOrderDTO } from './orderMapper';
import { OrderDTO } from '../types';
import { sendPushNotification } from './fcm';
import axios from 'axios';

const CORE_ENGINE_ORDER_URL = process.env.CORE_ENGINE_ORDER_URL || 'http://rahatio-core/api/orders';

let lastCheck: string | null = null;

async function sendOrderToCoreEngine(dto: OrderDTO): Promise<void> {
  try {
    await axios.post(CORE_ENGINE_ORDER_URL, dto, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.CORE_API_KEY || '',
      },
      timeout: 15_000,
    });
    console.log(`Order ${dto.externalId} sent to core-engine`);

    await sendPushNotification(
      `marketplace_${dto.marketplace}`,
      'Yeni Sipariş',
      `${dto.marketplace} üzerinden ${dto.items.length} ürünlü yeni sipariş`,
      { type: 'new_order', marketplace: dto.marketplace, externalId: dto.externalId }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error(`Failed to send order ${dto.externalId}: ${msg}`);
  }
}

export async function syncOrders(): Promise<void> {
  const since = lastCheck || new Date(Date.now() - 3600_000).toISOString();
  lastCheck = new Date().toISOString();

  const integrations = getIntegrations();

  for (const integration of integrations) {
    try {
      const orders = await integration.fetchOrders(since);

      for (const order of orders) {
        const dto = mapToOrderDTO(order);
        await sendOrderToCoreEngine(dto);
      }

      console.log(`[${integration.name}] ${orders.length} new orders synced`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[${integration.name}] sync failed: ${msg}`);
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startOrderSync(): void {
  console.log('Order sync cron started (every 5 minutes)');
  syncOrders();
  intervalHandle = setInterval(syncOrders, 5 * 60 * 1000);
}

export function stopOrderSync(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
