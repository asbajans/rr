import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Store } from '../../models/Store.model.js';
import { CustomerAddress } from '../../models/CustomerAddress.model.js';
import { logger } from '../../utils/logger.js';

export const publicAddressRoutes: Router = Router();

const hashOwnerToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

function serializeAddress(a: CustomerAddress) {
  return {
    id: a.id,
    store_id: a.storeId,
    user_id: a.userId ?? null,
    full_name: a.fullName,
    phone: a.phone ?? '',
    email: a.email ?? null,
    country: a.country || 'TR',
    city: a.city,
    district: a.district ?? null,
    zip: a.zip ?? null,
    address_line: a.addressLine,
    is_default: a.isDefault,
    created_at: a.createdAt,
  };
}

function parseAddressBody(raw: any) {
  const b = (raw?.address || raw) || {};
  const clean: Record<string, any> = {
    fullName: String(b.full_name || b.fullName || '').trim(),
    email: String(b.email || '').trim(),
    phone: String(b.phone || '').trim(),
    country: String(b.country || b.country_code || 'TR').trim() || 'TR',
    city: String(b.city || '').trim(),
    district: String(b.district || '').trim(),
    zip: String(b.zip_code || b.zip || '').trim(),
    addressLine: String(b.address || b.address_line || '').trim(),
    isDefault: Boolean(b.is_default ?? b.isDefault ?? false),
  };
  if (!clean.fullName) throw new Error('full_name is required');
  if (!clean.city) throw new Error('city is required');
  if (!clean.addressLine) throw new Error('address is required');
  return clean;
}

// List addresses for a guest (ownerToken identifies the anonymous address book)
publicAddressRoutes.get('/:siteCode/addresses', async (req: Request, res: Response) => {
  try {
    const ownerToken = String((req.query as any).ownerToken || '');
    if (!ownerToken) {
      res.json({ data: [] });
      return;
    }
    const store = await Store.findOne({ where: { siteCode: req.params.siteCode } });
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    const addresses = await CustomerAddress.findAll({
      where: { storeId: store.id, ownerTokenHash: hashOwnerToken(ownerToken) },
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: addresses.map(serializeAddress) });
  } catch (error: any) {
    logger.error({ err: error }, 'Address list error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create an address; returns the ownerToken the guest must keep for later access
publicAddressRoutes.post('/:siteCode/addresses', async (req: Request, res: Response) => {
  try {
    const store = await Store.findOne({ where: { siteCode: req.params.siteCode } });
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    let ownerToken = String((req.body as any)?.ownerToken || '');
    let ownerTokenHash = ownerToken ? hashOwnerToken(ownerToken) : null;
    if (ownerTokenHash) {
      const exists = await CustomerAddress.findOne({
        where: { storeId: store.id, ownerTokenHash },
        attributes: ['id'],
      });
      if (!exists) ownerTokenHash = null;
    }
    if (!ownerTokenHash) {
      ownerToken = crypto.randomUUID();
      ownerTokenHash = hashOwnerToken(ownerToken);
    }

    const data = parseAddressBody(req.body);
    const address = await CustomerAddress.create({
      storeId: store.id,
      ownerTokenHash,
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      country: data.country,
      city: data.city,
      district: data.district || null,
      zip: data.zip || null,
      addressLine: data.addressLine,
      isDefault: data.isDefault,
    });

    res.status(201).json({ data: serializeAddress(address), ownerToken });
  } catch (error: any) {
    logger.error({ err: error }, 'Address create error');
    res.status(400).json({ error: error?.message || 'Invalid address' });
  }
});

// Update an address (must present the ownerToken of the address book)
publicAddressRoutes.put('/:siteCode/addresses/:id', async (req: Request, res: Response) => {
  try {
    const ownerToken = String((req.body as any)?.ownerToken || '');
    if (!ownerToken) {
      res.status(403).json({ error: 'ownerToken is required' });
      return;
    }
    const store = await Store.findOne({ where: { siteCode: req.params.siteCode } });
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    const address = await CustomerAddress.findOne({
      where: { id: req.params.id, storeId: store.id },
    });
    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    if (address.ownerTokenHash !== hashOwnerToken(ownerToken)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const data = parseAddressBody(req.body);
    await address.update({
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      country: data.country,
      city: data.city,
      district: data.district || null,
      zip: data.zip || null,
      addressLine: data.addressLine,
      isDefault: data.isDefault,
    });

    res.json({ data: serializeAddress(address) });
  } catch (error: any) {
    logger.error({ err: error }, 'Address update error');
    res.status(400).json({ error: error?.message || 'Invalid address' });
  }
});

// Delete an address (must present the ownerToken of the address book)
publicAddressRoutes.delete('/:siteCode/addresses/:id', async (req: Request, res: Response) => {
  try {
    const ownerToken = String((req.query as any)?.ownerToken || '');
    if (!ownerToken) {
      res.status(403).json({ error: 'ownerToken is required' });
      return;
    }
    const store = await Store.findOne({ where: { siteCode: req.params.siteCode } });
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    const address = await CustomerAddress.findOne({
      where: { id: req.params.id, storeId: store.id },
    });
    if (!address) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }
    if (address.ownerTokenHash !== hashOwnerToken(ownerToken)) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
    await address.destroy();
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Address delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});
