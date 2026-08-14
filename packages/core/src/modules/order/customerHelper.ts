import { Customer } from '../../models/Customer.model.js';
import { Op } from 'sequelize';

export async function findOrCreateCustomer(
  storeId: number,
  info: { name?: string; email?: string; phone?: string; source: 'storefront' | 'marketplace' },
): Promise<Customer | null> {
  const email = info.email?.trim().toLowerCase();
  if (!email) return null;

  const existing = await Customer.findOne({ where: { storeId, email } });
  if (existing) {
    const patch: any = {};
    if (info.name && !existing.name) patch.name = info.name;
    if (info.phone && !existing.phone) patch.phone = info.phone;
    if (info.source === 'storefront' && existing.source === 'marketplace') patch.source = 'storefront';
    if (Object.keys(patch).length) await existing.update(patch);
    return existing;
  }

  return Customer.create({
    storeId,
    email,
    name: info.name || email.split('@')[0],
    phone: info.phone || null,
    source: info.source,
    passwordHash: null,
  });
}
