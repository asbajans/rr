import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { Category } from '../../models/Category.model.js';
import { MarketplaceCategoryMapping } from '../../models/Category.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const categoryRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

categoryRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { flat, isActive, source } = req.query;

    const where: any = { storeId: store.id };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (source !== undefined && source !== '') {
      where.source = String(source);
    } else {
      where.source = { [Op.eq]: null };
    }

    let categories;
    if (flat === 'true') {
      categories = await Category.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    } else {
      categories = await Category.findAll({
        where,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
        include: [{ model: Category, as: 'children', include: [{ model: Category, as: 'children' }] }],
      });
    }

    res.json({ categories });
  } catch (error) {
    logger.error({ err: error }, 'List categories error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.get('/tree', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { source } = req.query;

    const where: any = { storeId: store.id, parentId: null, isActive: true };
    if (source !== undefined && source !== '') {
      where.source = String(source);
    } else {
      where.source = { [Op.eq]: null };
    }

    const roots = await Category.findAll({
      where,
      order: [['sortOrder', 'ASC']],
      include: [{ model: Category, as: 'children', where: { isActive: true }, required: false, order: [['sortOrder', 'ASC']] }],
    });
    res.json({ categories: roots });
  } catch (error) {
    logger.error({ err: error }, 'Category tree error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isObject().notEmpty(),
  body('slug').isString().isLength({ min: 2, max: 200 }).matches(/^[a-z0-9-]+$/),
  body('parentId').optional().isInt(),
  body('translations').optional().isObject(),
  body('icon').optional().isString(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { name, slug, parentId, translations, icon, sortOrder, isActive } = req.body;

    const existing = await Category.findOne({ where: { storeId: store.id, slug } });
    if (existing) {
      return res.status(409).json({ error: 'Slug already exists' });
    }

    if (parentId) {
      const parent = await Category.findOne({ where: { id: parentId, storeId: store.id } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
    }

    const category = await Category.create({
      storeId: store.id,
      name,
      slug,
      parentId: parentId || null,
      translations: translations || {},
      icon: icon || null,
      sortOrder: sortOrder || 0,
      isActive: isActive !== false,
    });

    logger.info(`Category created: ${category.id} (${category.slug})`);
    res.status(201).json({ category });
  } catch (error) {
    logger.error({ err: error }, 'Create category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.get('/:id', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({
      where: { id: req.params.id, storeId: store.id },
      include: [{ model: Category, as: 'children' }],
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
  } catch (error) {
    logger.error({ err: error }, 'Get category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isObject(),
  body('slug').optional().isString().isLength({ min: 2, max: 200 }).matches(/^[a-z0-9-]+$/),
  body('parentId').optional({ values: 'null' }).isInt(),
  body('translations').optional().isObject(),
  body('icon').optional().isString(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (req.body.slug && req.body.slug !== category.slug) {
      const existing = await Category.findOne({ where: { storeId: store.id, slug: req.body.slug } });
      if (existing) {
        return res.status(409).json({ error: 'Slug already exists' });
      }
    }

    if (req.body.parentId) {
      if (req.body.parentId === category.id) {
        return res.status(400).json({ error: 'Cannot set self as parent' });
      }
      const parent = await Category.findOne({ where: { id: req.body.parentId, storeId: store.id } });
      if (!parent) {
        return res.status(404).json({ error: 'Parent category not found' });
      }
      let current: any = parent;
      while (current.parentId) {
        if (current.parentId === category.id) {
          return res.status(400).json({ error: 'Circular reference detected' });
        }
        current = await Category.findByPk(current.parentId);
      }
    }

    await category.update(req.body);
    logger.info(`Category updated: ${category.id}`);
    res.json({ category });
  } catch (error) {
    logger.error({ err: error }, 'Update category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const children = await Category.findAll({ where: { parentId: category.id } });
    if (children.length > 0) {
      return res.status(400).json({ error: 'Category has children, delete them first' });
    }

    await category.destroy();
    logger.info(`Category deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.get('/:id/mappings', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const mappings = await MarketplaceCategoryMapping.findAll({ where: { categoryId: category.id } });
    res.json({ mappings });
  } catch (error) {
    logger.error({ err: error }, 'Get mappings error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.post('/:id/mappings', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('marketplace').isString().isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('marketplaceCategoryId').isString().isLength({ min: 1, max: 200 }),
  body('name').isString().isLength({ min: 1, max: 500 }),
  body('parentId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const existing = await MarketplaceCategoryMapping.findOne({
      where: { categoryId: category.id, marketplace: req.body.marketplace },
    });
    if (existing) {
      return res.status(409).json({ error: 'Mapping already exists for this marketplace' });
    }

    const mapping = await MarketplaceCategoryMapping.create({
      categoryId: category.id,
      ...req.body,
    });

    logger.info(`Category mapping created: ${mapping.id}`);
    res.status(201).json({ mapping });
  } catch (error) {
    logger.error({ err: error }, 'Create mapping error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.put('/:id/mappings/:mappingId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  param('mappingId').isInt(),
  body('marketplaceCategoryId').optional().isString(),
  body('name').optional().isString(),
  body('parentId').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const mapping = await MarketplaceCategoryMapping.findOne({
      where: { id: req.params.mappingId, categoryId: category.id },
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });

    await mapping.update(req.body);
    logger.info(`Category mapping updated: ${mapping.id}`);
    res.json({ mapping });
  } catch (error) {
    logger.error({ err: error }, 'Update mapping error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

categoryRoutes.delete('/:id/mappings/:mappingId', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  param('mappingId').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const mapping = await MarketplaceCategoryMapping.findOne({
      where: { id: req.params.mappingId, categoryId: category.id },
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });

    await mapping.destroy();
    logger.info(`Category mapping deleted: ${req.params.mappingId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete mapping error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});