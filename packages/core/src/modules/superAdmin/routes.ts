import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { Subscription } from '../../models/Subscription.model.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
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

// All super admin routes require superadmin role
router.use(authMiddleware);
router.use(requireRole('superadmin'));

/**
 * GET /api/admin/stores
 * List all stores
 */
router.get('/stores', async (req: Request, res: Response) => {
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
router.get('/users', async (req: Request, res: Response) => {
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
router.put('/users/:id', [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['owner', 'admin', 'staff']),
  body('isActive').optional().isBoolean(),
  body('aiCredits').optional().isInt({ min: 0 }),
], validate, async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, role, isActive, aiCredits } = req.body;

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
    if (aiCredits !== undefined) user.aiCredits = aiCredits;

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
router.post('/users/:id/assign-plan', [
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
 * List all plans (super admin view - all plans)
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await Plan.findAll({
      order: [['price', 'ASC']],
    });
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
router.post('/plans', [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('slug').optional().isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
  body('price').isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('description').optional().isString(),
  body('productLimit').optional().isInt({ min: -1 }),
  body('storeLimit').optional().isInt({ min: 1 }),
  body('aiCredits').optional().isInt({ min: -1 }),
  body('modules').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('stripePriceId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.create(req.body);
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
 * PUT /api/admin/plans/:id
 * Update a plan
 */
router.put('/plans/:id', [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 100 }),
  body('slug').optional().isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
  body('price').optional().isFloat({ min: 0 }),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('productLimit').optional().isInt({ min: -1 }),
  body('storeLimit').optional().isInt({ min: 1 }),
  body('aiCredits').optional().isInt({ min: -1 }),
  body('features').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('stripePriceId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    await plan.update(req.body);
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
router.delete('/plans/:id', [
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

export { router as superAdminRoutes };