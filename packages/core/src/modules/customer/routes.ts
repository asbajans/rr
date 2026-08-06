import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { Store } from '../../models/Store.model.js';
import { Customer } from '../../models/Customer.model.js';
import { CustomerAddress } from '../../models/CustomerAddress.model.js';
import { CustomerFavorite } from '../../models/CustomerFavorite.model.js';
import { CustomerReview } from '../../models/CustomerReview.model.js';
import { CustomerNotification } from '../../models/CustomerNotification.model.js';
import { CustomerConsent } from '../../models/CustomerConsent.model.js';
import { Coupon } from '../../models/Coupon.model.js';
import { Campaign } from '../../models/Campaign.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { Product } from '../../models/Product.model.js';
import { optionalCustomer, requireCustomer, signCustomerToken } from './middleware.js';

export const customerRoutes: Router = Router();

async function storeOf(req: Request, res: Response): Promise<Store | null> {
  const store = await Store.findOne({ where: { siteCode: req.params.siteCode, isActive: true } });
  if (!store) res.status(404).json({ error: 'STORE_NOT_FOUND' });
  return store;
}
function publicCustomer(c: Customer) { return { id: c.id, email: c.email, name: c.name, phone: c.phone, createdAt: c.createdAt }; }
function hash(value: string) { return crypto.createHash('sha256').update(value).digest('hex'); }

customerRoutes.post('/:siteCode/customer/register', async (req, res) => {
  const store = await storeOf(req, res); if (!store) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || name.length < 2) return res.status(400).json({ error: 'INVALID_CUSTOMER_DATA' });
  if (await Customer.findOne({ where: { storeId: store.id, email } })) return res.status(409).json({ error: 'CUSTOMER_EMAIL_EXISTS' });
  const customer = await Customer.create({ storeId: store.id, email, name, phone: req.body.phone ? String(req.body.phone).trim() : null, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ customer: publicCustomer(customer), accessToken: signCustomerToken(customer) });
});

customerRoutes.post('/:siteCode/customer/login', async (req, res) => {
  const store = await storeOf(req, res); if (!store) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const customer = await Customer.findOne({ where: { storeId: store.id, email } });
  if (!customer || !customer.isActive || !(await bcrypt.compare(String(req.body?.password || ''), customer.passwordHash))) return res.status(401).json({ error: 'CUSTOMER_LOGIN_FAILED' });
  await customer.update({ lastLoginAt: new Date() });
  res.json({ customer: publicCustomer(customer), accessToken: signCustomerToken(customer) });
});

customerRoutes.post('/:siteCode/customer/forgot-password', async (req, res) => {
  const store = await storeOf(req, res); if (!store) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const customer = await Customer.findOne({ where: { storeId: store.id, email } });
  let resetToken: string | undefined;
  if (customer) { resetToken = crypto.randomBytes(32).toString('hex'); await customer.update({ resetTokenHash: hash(resetToken), resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000) }); }
  const response: any = { ok: true, message: 'Eğer hesap mevcutsa sıfırlama bağlantısı gönderilecektir.' };
  if (process.env.NODE_ENV !== 'production' && resetToken) response.resetToken = resetToken;
  res.json(response);
});

customerRoutes.post('/:siteCode/customer/reset-password', async (req, res) => {
  const store = await storeOf(req, res); if (!store) return;
  const token = String(req.body?.token || ''); const password = String(req.body?.password || '');
  if (token.length < 32 || password.length < 8) return res.status(400).json({ error: 'INVALID_RESET_REQUEST' });
  const customer = await Customer.findOne({ where: { storeId: store.id, resetTokenHash: hash(token), resetTokenExpiresAt: { [Op.gt]: new Date() } } });
  if (!customer) return res.status(400).json({ error: 'RESET_TOKEN_INVALID' });
  await customer.update({ passwordHash: await bcrypt.hash(password, 12), resetTokenHash: null, resetTokenExpiresAt: null });
  res.json({ ok: true });
});

customerRoutes.use('/:siteCode/customer', optionalCustomer);
customerRoutes.get('/:siteCode/customer/me', requireCustomer, (req, res) => res.json({ customer: publicCustomer((req as any).customer) }));
customerRoutes.put('/:siteCode/customer/profile', requireCustomer, async (req, res) => {
  const customer = (req as any).customer as Customer;
  const name = req.body?.name == null ? customer.name : String(req.body.name).trim();
  if (name.length < 2) return res.status(400).json({ error: 'INVALID_NAME' });
  await customer.update({ name, phone: req.body.phone == null ? customer.phone : String(req.body.phone).trim() || null });
  res.json({ customer: publicCustomer(customer) });
});

customerRoutes.get('/:siteCode/customer/orders', requireCustomer, async (req, res) => {
  const customer = (req as any).customer as Customer;
  const orders = await DropshippingOrder.findAll({ where: { storeId: customer.storeId, customerId: customer.id, marketplace: 'storefront' }, order: [['createdAt', 'DESC']], limit: Math.min(Number(req.query.limit) || 50, 100) });
  res.json({ orders });
});

customerRoutes.get('/:siteCode/customer/addresses', requireCustomer, async (req, res) => {
  const c = (req as any).customer as Customer;
  const addresses = await CustomerAddress.findAll({ where: { storeId: c.storeId, customerId: c.id }, order: [['isDefault', 'DESC'], ['createdAt', 'DESC']] });
  res.json({ data: addresses });
});
customerRoutes.post('/:siteCode/customer/addresses', requireCustomer, async (req, res) => {
  const c = (req as any).customer as Customer; const b = req.body || {};
  if (!b.fullName || !b.city || !b.addressLine) return res.status(400).json({ error: 'ADDRESS_REQUIRED' });
  const address = await CustomerAddress.create({ storeId: c.storeId, customerId: c.id, fullName: b.fullName, email: b.email || c.email, phone: b.phone || c.phone, country: b.country || 'TR', city: b.city, district: b.district || null, zip: b.zip || null, addressLine: b.addressLine, isDefault: Boolean(b.isDefault) });
  res.status(201).json({ data: address });
});
customerRoutes.delete('/:siteCode/customer/addresses/:id', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const address = await CustomerAddress.findOne({ where: { id: req.params.id, storeId: c.storeId, customerId: c.id } }); if (!address) return res.status(404).json({ error: 'ADDRESS_NOT_FOUND' }); await address.destroy(); res.json({ ok: true }); });

customerRoutes.get('/:siteCode/customer/favorites', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const rows = await CustomerFavorite.findAll({ where: { storeId: c.storeId, customerId: c.id }, order: [['createdAt', 'DESC']] }); res.json({ favorites: rows }); });
customerRoutes.post('/:siteCode/customer/favorites/:productId', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const product = await Product.findOne({ where: { id: req.params.productId, storeId: c.storeId } }); if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' }); const [favorite] = await CustomerFavorite.findOrCreate({ where: { storeId: c.storeId, customerId: c.id, productId: product.id }, defaults: { storeId: c.storeId, customerId: c.id, productId: product.id } }); res.status(201).json({ favorite }); });
customerRoutes.delete('/:siteCode/customer/favorites/:productId', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; await CustomerFavorite.destroy({ where: { storeId: c.storeId, customerId: c.id, productId: req.params.productId } }); res.json({ ok: true }); });

customerRoutes.get('/:siteCode/products/:productId/reviews', async (req, res) => { const store = await storeOf(req, res); if (!store) return; const reviews = await CustomerReview.findAll({ where: { storeId: store.id, productId: req.params.productId, status: 'approved' }, order: [['createdAt', 'DESC']] }); res.json({ reviews }); });
customerRoutes.post('/:siteCode/customer/reviews', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const rating = Number(req.body?.rating); if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !req.body?.productId) return res.status(400).json({ error: 'INVALID_REVIEW' }); const product = await Product.findOne({ where: { id: req.body.productId, storeId: c.storeId } }); if (!product) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' }); const review = await CustomerReview.create({ storeId: c.storeId, customerId: c.id, productId: product.id, orderId: req.body.orderId || null, rating, title: req.body.title || null, body: req.body.body || null, status: 'pending' }); res.status(201).json({ review }); });

customerRoutes.post('/:siteCode/customer/coupons/validate', optionalCustomer, async (req, res) => { const store = await storeOf(req, res); if (!store) return; const code = String(req.body?.code || '').trim().toUpperCase(); const subtotal = Number(req.body?.subtotal || 0); const coupon = await Coupon.findOne({ where: { storeId: store.id, code, isActive: true } }); const now = new Date(); if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now) || (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) || subtotal < Number(coupon?.minimumAmount || 0)) return res.status(400).json({ error: 'COUPON_INVALID' }); let discount = coupon.discountType === 'percent' ? subtotal * Number(coupon.discountValue) / 100 : Number(coupon.discountValue); if (coupon.maxDiscount != null) discount = Math.min(discount, Number(coupon.maxDiscount)); res.json({ valid: true, code: coupon.code, discount: Math.max(0, Math.round(discount * 100) / 100), discountType: coupon.discountType }); });
customerRoutes.get('/:siteCode/campaigns', async (req, res) => { const store = await storeOf(req, res); if (!store) return; const now = new Date(); const all = await Campaign.findAll({ where: { storeId: store.id, isActive: true } }); const campaigns = all.filter((c) => (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt >= now)); res.json({ campaigns }); });

customerRoutes.get('/:siteCode/customer/notifications', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const notifications = await CustomerNotification.findAll({ where: { storeId: c.storeId, customerId: c.id }, order: [['createdAt', 'DESC']], limit: 100 }); res.json({ notifications }); });
customerRoutes.post('/:siteCode/customer/notifications/:id/read', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const n = await CustomerNotification.findOne({ where: { id: req.params.id, storeId: c.storeId, customerId: c.id } }); if (!n) return res.status(404).json({ error: 'NOTIFICATION_NOT_FOUND' }); await n.update({ readAt: new Date() }); res.json({ notification: n }); });
customerRoutes.post('/:siteCode/customer/consents', requireCustomer, async (req, res) => { const c = (req as any).customer as Customer; const type = req.body?.type; if (!['terms', 'privacy', 'marketing'].includes(type) || !req.body?.version) return res.status(400).json({ error: 'INVALID_CONSENT' }); const [consent] = await CustomerConsent.findOrCreate({ where: { storeId: c.storeId, customerId: c.id, type, version: String(req.body.version) }, defaults: { storeId: c.storeId, customerId: c.id, type, version: String(req.body.version), granted: Boolean(req.body.granted), ipAddress: req.ip, grantedAt: new Date() } }); if (consent.granted !== Boolean(req.body.granted)) await consent.update({ granted: Boolean(req.body.granted), ipAddress: req.ip, grantedAt: new Date() }); res.json({ consent }); });
