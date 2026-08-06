import { Router } from 'express';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { Campaign } from '../../models/Campaign.model.js';
import { Coupon } from '../../models/Coupon.model.js';
import { CustomerReview } from '../../models/CustomerReview.model.js';

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
