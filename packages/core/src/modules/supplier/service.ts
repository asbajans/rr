import { Supplier } from '../../models/Supplier.model.js';
import { Store } from '../../models/Store.model.js';
import { logger } from '../../utils/logger.js';

/**
 * Lazily creates a Supplier profile for a store the first time it acts as a
 * supplier (approves a B2B request, has a clone listed, or receives a sub-order).
 * Idempotent — no-op when the profile already exists.
 */
export async function ensureSupplierForStore(storeId: number): Promise<Supplier> {
  const existing = await Supplier.findOne({ where: { storeId } });
  if (existing) return existing;

  const store = await Store.findByPk(storeId, {
    attributes: ['id', 'name', 'email', 'phone'],
  });

  const supplier = await Supplier.create({
    storeId,
    name: store?.name || null,
    email: store?.email || null,
    phone: (store as any)?.phone || null,
    contractStatus: 'invited',
    commissionRate: 0,
    payoutMethod: 'bank',
    applicationStatus: 'draft',
    applicationDocuments: null,
  });

  logger.info(`Supplier profile auto-created for store ${storeId} (id=${supplier.id})`);
  return supplier;
}
