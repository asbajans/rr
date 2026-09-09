import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { SaasCoupon, SaasCouponRedemption } from '../../models/SaasCoupon.model.js';
import { Plan } from '../../models/Plan.model.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const saasCouponRoutes: Router = Router();
// auth for all saas coupon routes; per-route role checks below
saasCouponRoutes.use(authMiddleware);
const superAdminOnly = requireRole('superadmin');

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

function normalizeCode(code: string): string {
  return String(code).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

// GET /api/admin/saas/coupons — superadmin only
saasCouponRoutes.get('/', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'),10)||1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'),10)||20));
    const search = String(req.query.search ?? '').trim();
    const where:any = {};
    if (search) where.code = { [Op.iLike]: `%${search}%` };
    if (req.query.isActive !== undefined) where.isActive = String(req.query.isActive)==='true';
    const { rows, count } = await SaasCoupon.findAndCountAll({ where, order:[['createdAt','DESC']], offset:(page-1)*limit, limit });
    res.json({ coupons: rows, pagination:{ page, limit, total: count, totalPages: Math.max(1, Math.ceil(count/limit)) } });
  } catch(e){ logger.error({err:e},'list saas coupons'); res.status(500).json({error:'Internal'}); }
});

saasCouponRoutes.get('/:id', superAdminOnly, [param('id').isInt()], validate, async (req: Request, res: Response)=>{
  const c = await SaasCoupon.findByPk(req.params.id);
  if(!c) return res.status(404).json({error:'Not found'});
  const redemptions = await SaasCouponRedemption.findAll({ where:{ couponId: c.id }, order:[['createdAt','DESC']], limit:50 });
  res.json({ coupon:c, redemptions });
});

saasCouponRoutes.post('/', superAdminOnly, [
  body('code').isString().isLength({ min:3, max:32 }).matches(/^[A-Za-z0-9_-]+$/),
  body('discountType').isIn(['percent','fixed']),
  body('discountValue').isFloat({ gt:0 }),
  body('minimumAmount').optional().isFloat({ min:0 }),
  body('maxDiscount').optional({ values:'null' }).isFloat({ min:0 }),
  body('usageLimit').optional({ values:'null' }).isInt({ min:1 }),
  body('perCustomerLimit').optional().isInt({ min:1, max:10 }),
  body('startsAt').optional({ values:'null' }).isISO8601(),
  body('endsAt').optional({ values:'null' }).isISO8601(),
  body('isActive').optional().isBoolean(),
  body('applicablePlanIds').optional({ values:'null' }).isArray(),
  body('billingConstraint').optional().isIn(['first_cycle_only','once_per_customer']),
], validate, async (req: Request, res: Response)=>{
  try {
    const code = normalizeCode(req.body.code);
    if (!code || code.length <3) return res.status(400).json({error:'Invalid code'});
    const exists = await SaasCoupon.findOne({ where:{ code } });
    if (exists) return res.status(409).json({ error:'Bu kod zaten var' });
    const discountType = req.body.discountType;
    const discountValue = Number(req.body.discountValue);
    if (discountType==='percent' && (discountValue <=0 || discountValue>100)) return res.status(400).json({ error:'Yüzde indirim 1-100 arası olmalı' });
    if (discountType==='fixed' && discountValue > 100000) return res.status(400).json({ error:'Sabit indirim çok yüksek' });

    let planIds: number[] | null = null;
    if (Array.isArray(req.body.applicablePlanIds) && req.body.applicablePlanIds.length>0) {
      planIds = req.body.applicablePlanIds.map((v:any)=> Number(v)).filter((n:number)=> Number.isFinite(n));
      // validate exist
      const plans = await Plan.findAll({ where:{ id: (planIds as number[]) as any } });
      if (plans.length !== (planIds as number[]).length) return res.status(400).json({ error:'Geçersiz plan ID' });
    }

    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (startsAt && endsAt && endsAt <= startsAt) return res.status(400).json({ error:'Bitiş tarihi başlangıçtan sonra olmalı' });

    const coupon = await SaasCoupon.create({
      code,
      discountType,
      discountValue,
      minimumAmount: req.body.minimumAmount != null ? Number(req.body.minimumAmount) : 0,
      maxDiscount: req.body.maxDiscount != null ? Number(req.body.maxDiscount) : null,
      usageLimit: req.body.usageLimit != null ? Number(req.body.usageLimit) : null,
      perCustomerLimit: req.body.perCustomerLimit != null ? Number(req.body.perCustomerLimit) : 1,
      startsAt,
      endsAt,
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
      applicablePlanIds: planIds,
      billingConstraint: req.body.billingConstraint || 'first_cycle_only',
      createdBy: (req as any).user?.id || null,
    } as any);
    res.status(201).json({ coupon });
  } catch(e:any){ logger.error({err:e},'create saas coupon'); res.status(500).json({error:'Internal', message:e.message}); }
});

saasCouponRoutes.put('/:id', superAdminOnly, [
  param('id').isInt(),
  body('code').optional().isString().isLength({ min:3, max:32 }),
  body('discountType').optional().isIn(['percent','fixed']),
  body('discountValue').optional().isFloat({ gt:0 }),
  body('minimumAmount').optional().isFloat({ min:0 }),
  body('maxDiscount').optional({ values:'null' }).isFloat({ min:0 }),
  body('usageLimit').optional({ values:'null' }).isInt({ min:1 }),
  body('perCustomerLimit').optional().isInt({ min:1, max:10 }),
  body('startsAt').optional({ values:'null' }).isISO8601(),
  body('endsAt').optional({ values:'null' }).isISO8601(),
  body('isActive').optional().isBoolean(),
  body('applicablePlanIds').optional({ values:'null' }).isArray(),
  body('billingConstraint').optional().isIn(['first_cycle_only','once_per_customer']),
], validate, async (req: Request, res: Response)=>{
  try {
    const c = await SaasCoupon.findByPk(req.params.id);
    if(!c) return res.status(404).json({error:'Not found'});
    const updates:any = {};
    if (req.body.code !== undefined) {
      const code = normalizeCode(req.body.code);
      if (code !== (c as any).code) {
        const exists = await SaasCoupon.findOne({ where:{ code } });
        if (exists) return res.status(409).json({ error:'Bu kod zaten var' });
      }
      updates.code = code;
    }
    if (req.body.discountType !== undefined) updates.discountType = req.body.discountType;
    if (req.body.discountValue !== undefined) {
      const v = Number(req.body.discountValue);
      const type = updates.discountType || (c as any).discountType;
      if (type==='percent' && (v<=0||v>100)) return res.status(400).json({error:'Yüzde 1-100'});
      updates.discountValue = v;
    }
    if (req.body.minimumAmount !== undefined) updates.minimumAmount = Number(req.body.minimumAmount);
    if (req.body.maxDiscount !== undefined) updates.maxDiscount = req.body.maxDiscount != null ? Number(req.body.maxDiscount) : null;
    if (req.body.usageLimit !== undefined) updates.usageLimit = req.body.usageLimit != null ? Number(req.body.usageLimit) : null;
    if (req.body.perCustomerLimit !== undefined) updates.perCustomerLimit = Number(req.body.perCustomerLimit);
    if (req.body.startsAt !== undefined) updates.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    if (req.body.endsAt !== undefined) updates.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    if (updates.startsAt && updates.endsAt && updates.endsAt <= updates.startsAt) return res.status(400).json({error:'Bitiş başlangıçtan sonra olmalı'});
    if (req.body.isActive !== undefined) updates.isActive = !!req.body.isActive;
    if (req.body.applicablePlanIds !== undefined) {
      if (req.body.applicablePlanIds === null) updates.applicablePlanIds = null;
      else {
        const ids = (req.body.applicablePlanIds as any[]).map(v=>Number(v)).filter(n=>Number.isFinite(n));
        if (ids.length>0) {
          const plans = await Plan.findAll({ where:{ id: ids as any } });
          if (plans.length !== ids.length) return res.status(400).json({error:'Geçersiz plan'});
        }
        updates.applicablePlanIds = ids.length?ids:null;
      }
    }
    if (req.body.billingConstraint !== undefined) updates.billingConstraint = req.body.billingConstraint;
    await c.update(updates);
    res.json({ coupon: c });
  } catch(e:any){ logger.error({err:e},'update coupon'); res.status(500).json({error:'Internal'}); }
});

saasCouponRoutes.delete('/:id', superAdminOnly, [param('id').isInt()], validate, async (req: Request, res: Response)=>{
  const c = await SaasCoupon.findByPk(req.params.id);
  if(!c) return res.status(404).json({error:'Not found'});
  const count = await SaasCouponRedemption.count({ where:{ couponId: c.id } });
  if (count>0) {
    await c.update({ isActive:false } as any);
    return res.json({ message:'Kupon kullanımda, pasif hale getirildi', coupon:c });
  }
  await c.destroy();
  res.json({ success:true });
});

saasCouponRoutes.get('/:id/redemptions', superAdminOnly, [param('id').isInt()], validate, async (req: Request, res: Response)=>{
  const c = await SaasCoupon.findByPk(req.params.id);
  if(!c) return res.status(404).json({error:'Not found'});
  const rows = await SaasCouponRedemption.findAll({ where:{ couponId: c.id }, order:[['createdAt','DESC']] });
  res.json({ redemptions: rows });
});

// validate endpoint for owner — planId optional for generic preview
saasCouponRoutes.post('/validate', [
  body('code').isString(),
  body('planId').optional().isInt(),
  body('interval').optional().isIn(['month','year']),
], validate, async (req: Request, res: Response)=>{
  try {
    const code = normalizeCode(req.body.code);
    const coupon = await SaasCoupon.findOne({ where:{ code, isActive:true } });
    if (!coupon) return res.status(400).json({ valid:false, error:'Kod bulunamadı' });
    // if planId not provided → generic check (active, dates, usageLimit)
    if (!req.body.planId) {
      const now = new Date();
      if ((coupon as any).startsAt && new Date((coupon as any).startsAt) > now) return res.json({ valid:false, error:'Kod henüz aktif değil' });
      if ((coupon as any).endsAt && new Date((coupon as any).endsAt) < now) return res.json({ valid:false, error:'Kod süresi dolmuş' });
      if ((coupon as any).usageLimit != null && Number((coupon as any).usedCount) >= Number((coupon as any).usageLimit)) return res.json({ valid:false, error:'Kullanım limiti doldu' });
      return res.json({ valid:true, coupon:{ code:(coupon as any).code, discountType:(coupon as any).discountType, discountValue:(coupon as any).discountValue, maxDiscount:(coupon as any).maxDiscount }, basePrice:null, discount:null, finalPrice:null });
    }
    const plan = await Plan.findByPk(req.body.planId);
    if (!plan) return res.status(404).json({ error:'Plan not found' });
    const now2 = new Date();
    if ((coupon as any).startsAt && new Date((coupon as any).startsAt) > now2) return res.json({ valid:false, error:'Kod henüz aktif değil' });
    if ((coupon as any).endsAt && new Date((coupon as any).endsAt) < now2) return res.json({ valid:false, error:'Kod süresi dolmuş' });
    if ((coupon as any).usageLimit != null && Number((coupon as any).usedCount) >= Number((coupon as any).usageLimit)) return res.json({ valid:false, error:'Kullanım limiti doldu' });
    const planIds = (coupon as any).applicablePlanIds as number[] | null;
    if (planIds && !planIds.includes(Number(plan.id))) return res.json({ valid:false, error:'Bu plan için geçerli değil' });
    const interval = req.body.interval || 'month';
    let basePrice = Number((plan as any).price) || 0;
    if (interval==='year') {
      const yp = (plan as any).yearlyPrice != null ? Number((plan as any).yearlyPrice) : (Number((plan as any).price)*12*(1- (Number((plan as any).yearlyDiscountPercent||0)/100)));
      basePrice = yp;
    }
    if (Number((coupon as any).minimumAmount) > basePrice) return res.json({ valid:false, error:`Minimum tutar ${ (coupon as any).minimumAmount} TRY` });
    let discount = (coupon as any).discountType==='percent' ? basePrice * Number((coupon as any).discountValue)/100 : Number((coupon as any).discountValue);
    if ((coupon as any).maxDiscount != null) discount = Math.min(discount, Number((coupon as any).maxDiscount));
    discount = Math.min(discount, basePrice);
    const finalPrice = Math.max(0, basePrice - discount);
    res.json({ valid:true, coupon:{ code:(coupon as any).code, discountType:(coupon as any).discountType, discountValue:(coupon as any).discountValue, maxDiscount:(coupon as any).maxDiscount }, basePrice, discount, finalPrice });
  } catch(e:any){ res.status(500).json({error:'Internal'}); }
});
