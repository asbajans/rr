import axios from 'axios';

const CORE_URL = (process.env.CORE_URL || 'http://rahatio-core').replace(/\/$/, '');
const INTERNAL_KEY = process.env.RAHAT_INTERNAL_KEY || '';

export async function notifyCoreSyncStatus(params: {
  productId: string;
  storeId: number | null | undefined;
  marketplace: string;
  success: boolean;
  marketplaceId?: string | null;
  error?: string | null;
}): Promise<void> {
  if (!params.storeId) {
    console.warn('[coreSync] no storeId, skipping sync-status callback');
    return;
  }
  try {
    await axios.post(
      `${CORE_URL}/api/admin/products/${params.productId}/sync-status`,
      {
        store_id: params.storeId,
        marketplace: params.marketplace,
        success: params.success,
        marketplaceId: params.marketplaceId ?? null,
        error: params.error ?? null,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': INTERNAL_KEY,
        },
        timeout: 10_000,
      }
    );
    console.log(
      `[coreSync] product ${params.productId} / ${params.marketplace} -> ${params.success ? 'synced' : 'error'}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    console.error(`[coreSync] failed to notify core: ${msg}`);
  }
}
