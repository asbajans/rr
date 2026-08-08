import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { Setting } from '../../models/Setting.model.js';
import { Supplier } from '../../models/Supplier.model.js';
import { SupplierRating } from '../../models/SupplierRating.model.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import { getRatingSettings, setRatingSettings, recomputeSupplierRating } from '../supplier/rating.js';
import { logger } from '../../utils/logger.js';
import { serializePlans, serializePlan } from '../planSerializer.js';

const router: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

function mapPlanBody(body: any): any {
  const mapped: any = {};
  if (body.name !== undefined) mapped.name = body.name;
  if (body.slug) mapped.slug = body.slug;
  if (body.description) mapped.description = body.description;
  if (body.price !== undefined) mapped.price = body.price;
  if (body.currency) mapped.currency = body.currency;
  if ('product_limit' in body && !('productLimit' in body)) mapped.productLimit = body.product_limit;
  else if (body.productLimit !== undefined) mapped.productLimit = body.productLimit;
  if ('store_limit' in body && !('storeLimit' in body)) mapped.storeLimit = body.store_limit;
  else if (body.storeLimit !== undefined) mapped.storeLimit = body.storeLimit;
  if ('ai_credits' in body && !('aiCredits' in body)) mapped.aiCredits = body.ai_credits;
  else if (body.aiCredits !== undefined) mapped.aiCredits = body.aiCredits;
  if (body.modules !== undefined) mapped.modules = body.modules;
  if ('is_active' in body && !('isActive' in body)) mapped.isActive = body.is_active;
  else if (body.isActive !== undefined) mapped.isActive = body.isActive;
  if (body.stripePriceId !== undefined) mapped.stripePriceId = body.stripePriceId;
  if (body.hosting !== undefined) mapped.hosting = body.hosting;
  return mapped;
}

// Auth runs for all requests (sets req.user, req.store)
router.use(authMiddleware);

const superAdminOnly = requireRole('superadmin');

/**
 * GET /api/admin/stores
 * List all stores
 */
router.get('/stores', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const stores = await Store.findAll({
      include: [
        { model: Plan, as: 'plan' },
        { model: User, as: 'users', attributes: ['id', 'name', 'email', 'role'], where: { role: 'owner' }, required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: stores });
  } catch (error) {
    logger.error({ err: error }, 'Get all stores error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/users
 * List all users across all stores
 */
router.get('/users', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search, storeId } = req.query;
    const where: any = {};
    if (search) {
      where[require('sequelize').Op.or] = [
        { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
        { email: { [require('sequelize').Op.iLike]: `%${search}%` } },
      ];
    }
    if (storeId) where.storeId = parseInt(storeId as string);

    const users = await User.findAll({
      where,
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name', 'siteCode'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    const total = await User.count({ where });

    res.json({
      data: users,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Get all users error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update a user (any store)
 */
router.put('/users/:id', superAdminOnly, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['owner', 'admin', 'staff']),
  body('isActive').optional().isBoolean(),
  body('aiCredits').optional().isInt({ min: 0 }),
  body('ai_credits').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, role, isActive, aiCredits, ai_credits, is_active } = req.body;

    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (is_active !== undefined) user.isActive = is_active;
    if (aiCredits !== undefined) user.aiCredits = aiCredits;
    if (ai_credits !== undefined) user.aiCredits = ai_credits;

    await user.save();

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        aiCredits: user.aiCredits,
        storeId: user.storeId,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Update user error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users/:id/assign-plan
 * Assign plan to user's store
 */
router.post('/users/:id/assign-plan', superAdminOnly, [
  param('id').isInt(),
  body('planId').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{ model: Store, as: 'store' }],
    });
    if (!user || !user.store) {
      return res.status(404).json({ error: 'User or store not found' });
    }

    const { planId } = req.body;
    const plan = await Plan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await Subscription.upsert({
      storeId: user.store.id,
      planId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await user.store.update({ planId });

    res.json({ message: 'Plan assigned successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Assign plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});



/**
 * GET /api/admin/plans
 * List plans. Superadmin sees all (including inactive), store users see active only.
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const isSuper = (req as any).user?.role === 'superadmin';
    const where = isSuper ? {} : { isActive: true };
    const plans = await Plan.findAll({ where, order: [['price', 'ASC']] });
    res.json({ plans: serializePlans(plans) });
  } catch (error) {
    logger.error({ err: error }, 'Get all plans error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/plans
 * Create a new plan
 */
router.post('/plans', superAdminOnly, [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('slug').optional().isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
  body('price').isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('description').optional().isString(),
  body('productLimit').optional().isInt({ min: -1 }),
  body('product_limit').optional().isInt({ min: -1 }),
  body('storeLimit').optional().isInt({ min: 1 }),
  body('store_limit').optional().isInt({ min: 1 }),
  body('aiCredits').optional().isInt({ min: -1 }),
  body('ai_credits').optional().isInt({ min: -1 }),
  body('modules').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
  body('stripePriceId').optional().isString(),
  body('hosting').optional().isIn(['rahatio', 'vercel', 'custom']),
], validate, async (req: Request, res: Response) => {
  try {
    const body = mapPlanBody(req.body);
    const plan = await Plan.create(body);
    res.status(201).json({ plan: serializePlan(plan) });
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Plan name or slug already exists' });
    }
    logger.error({ err: error }, 'Create plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/plans/:id
 * Get a single plan
 */
router.get('/plans/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json({ plan: serializePlan(plan) });
  } catch (error) {
    logger.error({ err: error }, 'Get plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Update a plan
 */
router.put('/plans/:id', superAdminOnly, [
  param('id').isInt(),
  body('name').optional({ values: 'falsy' }).isString().isLength({ min: 2, max: 100 }),
  body('slug').optional({ values: 'falsy' }).isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
  body('price').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('currency').optional({ values: 'falsy' }).isString().isLength({ min: 3, max: 3 }),
  body('description').optional({ values: 'falsy' }).isString(),
  body('productLimit').optional({ values: 'falsy' }).isInt({ min: -1 }),
  body('product_limit').optional({ values: 'falsy' }).isInt({ min: -1 }),
  body('storeLimit').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('store_limit').optional({ values: 'falsy' }).isInt({ min: 1 }),
  body('aiCredits').optional({ values: 'falsy' }).isInt({ min: -1 }),
  body('ai_credits').optional({ values: 'falsy' }).isInt({ min: -1 }),
  body('modules').optional({ values: 'falsy' }).isObject(),
  body('isActive').optional({ values: 'falsy' }).isBoolean(),
  body('is_active').optional({ values: 'falsy' }).isBoolean(),
  body('stripePriceId').optional({ values: 'falsy' }).isString(),
  body('hosting').optional({ values: 'falsy' }).isIn(['rahatio', 'vercel', 'custom']),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const body = mapPlanBody(req.body);
    await plan.update(body);
    res.json({ plan: serializePlan(plan) });
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Plan name or slug already exists' });
    }
    logger.error({ err: error }, 'Update plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/plans/:id
 * Delete a plan
 */
router.delete('/plans/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    // Check if any store uses this plan
    const stores = await Store.findOne({ where: { planId: plan.id } });
    if (stores) {
      return res.status(400).json({ error: 'Cannot delete plan used by stores' });
    }
    await plan.destroy();
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/settings
 * List all global settings
 */
router.get('/settings', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const settings = await Setting.findAll();
    const map: Record<string, any> = {};
    for (const s of settings) map[s.key] = s.value;
    res.json({ settings: map });
  } catch (error) {
    logger.error({ err: error }, 'Get settings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Upsert a global setting
 */
router.put('/settings/:key', superAdminOnly, [
  param('key').isString().isLength({ min: 2, max: 100 }),
  body('value').notEmpty(),
], validate, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await Setting.upsert({ key, value });
    logger.info(`Global setting updated: ${key}`);
    res.json({ key, value });
  } catch (error) {
    logger.error({ err: error }, 'Update setting error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/supplier/applications
 * List all supplier approval applications (superadmin review). Optional ?status=
 * filter (draft | submitted | approved | rejected). Only suppliers that have
 * submitted an application are returned unless an explicit status is given.
 */
router.get('/supplier/applications', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = {};
    if (status) {
      where.applicationStatus = status;
    } else {
      where.applicationStatus = { [require('sequelize').Op.ne]: 'draft' };
    }
    const suppliers = await Supplier.findAll({
      where,
      include: [{ model: Store, as: 'store', attributes: ['id', 'name', 'siteCode', 'domain', 'email'] }],
      order: [['applicationSubmittedAt', 'DESC']],
    });
    res.json({ data: suppliers });
  } catch (error) {
    logger.error({ err: error }, 'List supplier applications error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/supplier/applications/:id/approve
 * Approve a supplier application → supplier becomes active.
 */
router.post('/supplier/applications/:id/approve', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    if (supplier.applicationStatus === 'approved') {
      return res.status(409).json({ error: 'Supplier already approved' });
    }
    await supplier.update({
      applicationStatus: 'approved',
      applicationReviewedAt: new Date(),
      rejectionNote: null,
      contractStatus: 'active',
    });
    logger.info(`Supplier application ${supplier.id} approved by ${(req as any).user?.email}`);
    res.json({ supplier });
  } catch (error) {
    logger.error({ err: error }, 'Approve supplier application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/supplier/applications/:id/reject
 * Reject a supplier application with an optional note. The supplier can re-apply.
 */
router.post('/supplier/applications/:id/reject', superAdminOnly, [
  param('id').isInt(),
  body('note').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    if (supplier.applicationStatus === 'approved') {
      return res.status(409).json({ error: 'Supplier already approved' });
    }
    await supplier.update({
      applicationStatus: 'rejected',
      applicationReviewedAt: new Date(),
      rejectionNote: req.body.note || null,
      contractStatus: 'invited',
    });
    logger.info(`Supplier application ${supplier.id} rejected by ${(req as any).user?.email}`);
    res.json({ supplier });
  } catch (error) {
    logger.error({ err: error }, 'Reject supplier application error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/supplier/ratings-admin
 * List every supplier rating across the platform (superadmin). Optional
 * filters: ?storeId= (rating store), ?supplierId=, ?rating=.
 */
router.get('/supplier/ratings-admin', superAdminOnly, async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.storeId) where.storeId = parseInt(req.query.storeId as string);
    if (req.query.supplierId) where.supplierId = parseInt(req.query.supplierId as string);
    if (req.query.rating) where.rating = parseInt(req.query.rating as string);

    const ratings = await SupplierRating.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 200,
      include: [
        { model: Supplier, as: 'supplier', include: [{ model: Store, as: 'store', attributes: ['id', 'name', 'siteCode'] }] },
        { model: Store, as: 'store', attributes: ['id', 'name', 'siteCode'] },
      ],
    });
    res.json({ ratings });
  } catch (error) {
    logger.error({ err: error }, 'List all supplier ratings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/supplier/ratings-admin/settings
 * Read the global rating system toggle.
 */
router.get('/supplier/ratings-admin/settings', superAdminOnly, async (_req: Request, res: Response) => {
  try {
    res.json({ settings: await getRatingSettings() });
  } catch (error) {
    logger.error({ err: error }, 'Get rating settings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/supplier/ratings-admin/settings
 * Toggle the global rating system on/off.
 */
router.put('/supplier/ratings-admin/settings', superAdminOnly, [
  body('enabled').isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const settings = await setRatingSettings(req.body.enabled);
    logger.info(`Supplier rating system ${settings.enabled ? 'enabled' : 'disabled'} by ${(req as any).user?.email}`);
    res.json({ settings });
  } catch (error) {
    logger.error({ err: error }, 'Set rating settings error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/supplier/ratings-admin/:id
 * Correct a rating (score or comment) as superadmin.
 */
router.put('/supplier/ratings-admin/:id', superAdminOnly, [
  param('id').isInt(),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('comment').optional({ values: 'null' }).isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const rating = await SupplierRating.findByPk(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    const updateData: any = {};
    if (req.body.rating !== undefined) updateData.rating = req.body.rating;
    if (req.body.comment !== undefined) updateData.comment = req.body.comment || null;
    if (Object.keys(updateData).length > 0) await rating.update(updateData);
    await recomputeSupplierRating(rating.supplierId);
    res.json({ rating });
  } catch (error) {
    logger.error({ err: error }, 'Update supplier rating error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/supplier/ratings-admin/:id
 * Remove an inappropriate rating (superadmin moderation).
 */
router.delete('/supplier/ratings-admin/:id', superAdminOnly, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const rating = await SupplierRating.findByPk(req.params.id);
    if (!rating) return res.status(404).json({ error: 'Rating not found' });
    const supplierId = rating.supplierId;
    await rating.destroy();
    await recomputeSupplierRating(supplierId);
    logger.info(`Rating ${rating.id} deleted by ${(req as any).user?.email}`);
    res.json({ message: 'Rating deleted' });
  } catch (error) {
    logger.error({ err: error }, 'Delete supplier rating error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as superAdminRoutes };