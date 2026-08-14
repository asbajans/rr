import { Router } from 'express';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { Campaign } from '../../models/Campaign.model.js';
import { Coupon } from '../../models/Coupon.model.js';
import { CustomerReview } from '../../models/CustomerReview.model.js';
import { Customer } from '../../models/Customer.model.js';
import { DropshippingOrder } from '../../models/DropshippingOrder.model.js';
import { NotificationTemplate, DEFAULT_EMAIL_TEMPLATES, DEFAULT_SMS_TEMPLATES } from '../../models/NotificationTemplate.model.js';
import { sequelize } from '../../config/database.js';
import { Op } from 'sequelize';

export const adminCommercialRoutes: Router = Router();
adminCommercialRoutes.use(authMiddleware, requireRole('owner', 'admin'), requireStore);

adminCommercialRoutes.get('/campaigns', async (req, res) => {
  const store = (req as any).store;
  res.json({ campaigns: await Campaign.findAll({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] }) });
});
adminCommercialRoutes.post('/campaigns', async (req, res) => {
  const store = (req as any).store; const b = req.body || {};
  if (!b.name || !['percent', 'fixed'].includes(b.discountType) || Number(b.discountValue) <= 0) return res.status(400).json({ error: 'INVALID_CAMPAIGN' });
  const campaign = await Campaign.create({ storeId: store.id, name: String(b.name).trim(), description: b.description || null, discountType: b.discountType, discountValue: Number(b.discountValue), startsAt: b.startsAt || null, endsAt: b.endsAt || null, isActive: b.isActive !== false });
  res.status(201).json({ campaign });
});
adminCommercialRoutes.put('/campaigns/:id', async (req, res) => { const store = (req as any).store; const c = await Campaign.findOne({ where: { id: req.params.id, storeId: store.id } }); if (!c) return res.status(404).json({ error: 'CAMPAIGN_NOT_FOUND' }); await c.update(req.body); res.json({ campaign: c }); });
adminCommercialRoutes.delete('/campaigns/:id', async (req, res) => { const store = (req as any).store; const c = await Campaign.findOne({ where: { id: req.params.id, storeId: store.id } }); if (!c) return res.status(404).json({ error: 'CAMPAIGN_NOT_FOUND' }); await c.destroy(); res.json({ ok: true }); });

adminCommercialRoutes.get('/coupons', async (req, res) => { const store = (req as any).store; res.json({ coupons: await Coupon.findAll({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] }) }); });
adminCommercialRoutes.post('/coupons', async (req, res) => { const store = (req as any).store; const b = req.body || {}; const code = String(b.code || '').trim().toUpperCase(); if (!code || !['percent', 'fixed'].includes(b.discountType) || Number(b.discountValue) <= 0) return res.status(400).json({ error: 'INVALID_COUPON' }); try { const coupon = await Coupon.create({ storeId: store.id, campaignId: b.campaignId || null, code, discountType: b.discountType, discountValue: Number(b.discountValue), minimumAmount: Number(b.minimumAmount || 0), maxDiscount: b.maxDiscount == null ? null : Number(b.maxDiscount), usageLimit: b.usageLimit == null ? null : Number(b.usageLimit), startsAt: b.startsAt || null, endsAt: b.endsAt || null, isActive: b.isActive !== false }); res.status(201).json({ coupon }); } catch { res.status(409).json({ error: 'COUPON_CODE_EXISTS' }); } });
adminCommercialRoutes.put('/coupons/:id', async (req, res) => { const store = (req as any).store; const c = await Coupon.findOne({ where: { id: req.params.id, storeId: store.id } }); if (!c) return res.status(404).json({ error: 'COUPON_NOT_FOUND' }); const allowed = ['campaignId', 'discountType', 'discountValue', 'minimumAmount', 'maxDiscount', 'usageLimit', 'startsAt', 'endsAt', 'isActive']; const patch: any = {}; for (const key of allowed) if (req.body[key] !== undefined) patch[key] = req.body[key]; await c.update(patch); res.json({ coupon: c }); });
adminCommercialRoutes.delete('/coupons/:id', async (req, res) => { const store = (req as any).store; const c = await Coupon.findOne({ where: { id: req.params.id, storeId: store.id } }); if (!c) return res.status(404).json({ error: 'COUPON_NOT_FOUND' }); await c.destroy(); res.json({ ok: true }); });

adminCommercialRoutes.get('/reviews', async (req, res) => { const store = (req as any).store; res.json({ reviews: await CustomerReview.findAll({ where: { storeId: store.id }, order: [['createdAt', 'DESC']] }) }); });
adminCommercialRoutes.patch('/reviews/:id', async (req, res) => { const store = (req as any).store; const review = await CustomerReview.findOne({ where: { id: req.params.id, storeId: store.id } }); if (!review) return res.status(404).json({ error: 'REVIEW_NOT_FOUND' }); if (!['pending', 'approved', 'rejected'].includes(req.body?.status)) return res.status(400).json({ error: 'INVALID_REVIEW_STATUS' }); await review.update({ status: req.body.status }); res.json({ review }); });

// Customer management
adminCommercialRoutes.get('/customers', async (req, res) => {
  const store = (req as any).store;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const search = (req.query.search as string || '').trim();

  const where: any = { storeId: store.id };
  const source = req.query.source as string;
  if (source && ['storefront', 'marketplace'].includes(source)) {
    where.source = source;
  }
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { phone: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const { count, rows: customers } = await Customer.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const customerIds = customers.map(c => c.id);
  const orderStats = await DropshippingOrder.findAll({
    where: { storeId: store.id, customerId: { [Op.in]: customerIds } },
    attributes: ['customerId', [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount'], [sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('totalAmount')), 0), 'totalSpent']],
    group: ['customerId'],
    raw: true,
  });

  const statsMap = new Map<number, { orderCount: number; totalSpent: number }>();
  for (const s of orderStats as any[]) {
    statsMap.set(s.customerId, { orderCount: parseInt(s.orderCount || '0'), totalSpent: parseFloat(s.totalSpent || '0') });
  }

  res.json({
    customers: customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      source: c.source,
      isActive: c.isActive,
      lastLoginAt: c.lastLoginAt,
      createdAt: c.createdAt,
      orderCount: statsMap.get(c.id)?.orderCount || 0,
      totalSpent: statsMap.get(c.id)?.totalSpent || 0,
    })),
    total: count,
    page,
    limit,
  });
});

adminCommercialRoutes.get('/customers/:id', async (req, res) => {
  const store = (req as any).store;
  const customer = await Customer.findOne({ where: { id: req.params.id, storeId: store.id } });
  if (!customer) return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND' });

  const orders = await DropshippingOrder.findAll({
    where: { storeId: store.id, customerId: customer.id },
    attributes: ['id', 'orderNumber', 'status', 'totalAmount', 'currency', 'paymentMethod', 'paymentStatus', 'trackingNumber', 'carrier', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 50,
  });

  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      source: customer.source,
      isActive: customer.isActive,
      lastLoginAt: customer.lastLoginAt,
      createdAt: customer.createdAt,
    },
    orders,
  });
});

// Notification templates
adminCommercialRoutes.get('/templates', async (req, res) => {
  const store = (req as any).store;
  const templates = await NotificationTemplate.findAll({ where: { storeId: store.id }, order: [['channel', 'ASC'], ['type', 'ASC']] });

  // Merge with defaults: if no template for a type, return the default
  const result: any[] = [];
  const allTypes = ['order_created', 'status_change', 'shipping_update', 'custom'] as const;
  for (const type of allTypes) {
    for (const channel of ['email', 'sms'] as const) {
      const existing = templates.find(t => t.type === type && t.channel === channel);
      if (existing) {
        result.push({ id: existing.id, channel, type, subject: existing.subject, body: existing.body, isActive: existing.isActive, isCustom: true });
      } else {
        const defaults = channel === 'email' ? DEFAULT_EMAIL_TEMPLATES : DEFAULT_SMS_TEMPLATES;
        const def = defaults[type];
        result.push({ id: null, channel, type, subject: (def as any).subject || '', body: def.body, isActive: true, isCustom: false });
      }
    }
  }
  res.json({ templates: result });
});

adminCommercialRoutes.put('/templates', async (req, res) => {
  const store = (req as any).store;
  const { channel, type, subject, body, isActive } = req.body;
  if (!channel || !type || !['email', 'sms'].includes(channel)) return res.status(400).json({ error: 'INVALID_TEMPLATE' });

  const [template, created] = await NotificationTemplate.findOrCreate({
    where: { storeId: store.id, channel, type },
    defaults: { storeId: store.id, channel, type, subject: subject || '', body: body || '', isActive: isActive !== false },
  });

  if (!created) {
    const patch: any = {};
    if (subject !== undefined) patch.subject = subject;
    if (body !== undefined) patch.body = body;
    if (isActive !== undefined) patch.isActive = isActive;
    await template.update(patch);
  }

  res.json({ template });
});
