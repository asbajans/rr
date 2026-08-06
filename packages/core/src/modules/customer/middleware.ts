import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { Customer } from '../../models/Customer.model.js';
import { Store } from '../../models/Store.model.js';

export type CustomerToken = { customerId: number; storeId: number; type: 'customer' };

export function signCustomerToken(customer: Customer): string {
  return jwt.sign({ customerId: customer.id, storeId: customer.storeId, type: 'customer' }, config.jwt.secret, { expiresIn: '30d' });
}

export async function resolveCustomer(req: Request): Promise<Customer | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), config.jwt.secret) as CustomerToken;
    const store = (req as any).store || await Store.findOne({ where: { id: payload.storeId, siteCode: req.params.siteCode, isActive: true } });
    if (payload.type !== 'customer' || !store || Number(payload.storeId) !== Number(store.id)) return null;
    const customer = await Customer.findOne({ where: { id: payload.customerId, storeId: payload.storeId, isActive: true } });
    return customer || null;
  } catch { return null; }
}

export async function optionalCustomer(req: Request, _res: Response, next: NextFunction) {
  (req as any).customer = await resolveCustomer(req);
  next();
}

export async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const customer = await resolveCustomer(req);
  if (!customer) return res.status(401).json({ error: 'CUSTOMER_UNAUTHORIZED', message: 'Müşteri oturumu gerekli' });
  (req as any).customer = customer;
  next();
}
