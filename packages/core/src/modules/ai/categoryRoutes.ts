import { Router, Request, Response } from 'express';
import { Op, literal } from 'sequelize';
import { body, param, validationResult } from 'express-validator';
import { Category } from '../../models/Category.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { getPlanForStore } from '../plan/access.js';
import { resolveScenarioConfig, buildProviderPayload, deductCredits, logAiUsage, AI_TIMEOUT_MS } from './routes.js';

export const aiCategoryRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

export function categoryNameToString(name: unknown): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') {
    const n = name as Record<string, unknown>;
    return String(n.tr || n.en || n.name || '');
  }
  return String(name);
}

export function categoryToAiShape(category: any, defaultId: number | null) {
  return {
    id: category.id,
    name: categoryNameToString(category.name),
    slug: category.slug,
    storeId: category.storeId,
    aiAttributes: Array.isArray(category.aiAttributes) ? category.aiAttributes : [],
    builtin: category.storeId == null,
    isDefault: category.id === defaultId,
  };
}

const slugify = (value: string) => {
  return String(value).toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'kategori';
};

/**
 * Calls the ai-service to generate an attribute schema for a category name.
 * Returns the generated attributes (empty array on failure is NOT accepted —
 * the caller decides whether to persist).
 */
async function generateAttributesFor(name: string, keywords?: string, notes?: string): Promise<any[]> {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
  const { provider, model, scenario, keys } = await resolveScenarioConfig('agentic_listing', {});
  const providerPayload = buildProviderPayload(provider, model, scenario, keys);

  const axios = (await import('axios')).default;
  const response = await axios.post(
    `${aiServiceUrl}/ai/generate-category-attributes`,
    { name, keywords, notes, ...providerPayload },
    { timeout: AI_TIMEOUT_MS }
  );

  const attributes = response?.data?.attributes;
  if (!Array.isArray(attributes)) {
    throw new Error('AI attribute generation returned no attributes');
  }
  return attributes;
}

// GET / — list AI categories (built-in universal + store-owned), with default marked
aiCategoryRoutes.get('/', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const rows = await Category.findAll({
      where: {
        [Op.or]: [{ storeId: null }, { storeId: store.id }],
        isActive: true,
      },
      order: [
        [literal('"storeId" IS NOT NULL'), 'ASC'],
        ['sortOrder', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    res.json({
      categories: rows.map((c) => categoryToAiShape(c, store.defaultAiCategoryId)),
      defaultCategoryId: store.defaultAiCategoryId,
    });
  } catch (error) {
    logger.error({ err: error }, 'List AI categories error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /generate — generate attribute schema for a name without persisting
aiCategoryRoutes.post('/generate', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 200 }),
  body('keywords').optional().isString(),
  body('notes').optional().isString(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const attributes = await generateAttributesFor(req.body.name, req.body.keywords, req.body.notes);

    await deductCredits(user.id, store.id, 2, 'category_attributes', 'ai');
    await logAiUsage(user.id, store.id, 'category_attributes', null, null, 2, { path: '/ai/generate-category-attributes', bodyKeys: ['name'] }, { status: 200 });

    res.json({ attributes });
  } catch (error: any) {
    logger.error({ err: error }, 'Generate AI category attributes error:');
    res.status(500).json({ error: error?.message || 'Attribute generation failed' });
  }
});

// POST / — create a custom AI category (optionally auto-generating attributes)
aiCategoryRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('name').isString().isLength({ min: 2, max: 200 }),
  body('slug').optional().isString().matches(/^[a-z0-9-]+$/),
  body('attributes').optional().isArray(),
  body('autoGenerate').optional().isBoolean(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const { name, slug, attributes, autoGenerate } = req.body;

    let baseSlug = slug || slugify(name);
    let finalSlug = baseSlug;
    let counter = 2;
    while (await Category.findOne({ where: { storeId: store.id, slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter++}`;
    }

    let aiAttributes = Array.isArray(attributes) ? attributes : [];
    if (autoGenerate && aiAttributes.length === 0) {
      aiAttributes = await generateAttributesFor(name);
    }

    const category = await Category.create({
      storeId: store.id,
      name: { tr: name, en: name },
      slug: finalSlug,
      sortOrder: 100,
      isActive: true,
      source: 'ai',
      aiAttributes,
    });

    if (autoGenerate && aiAttributes.length > 0) {
      await deductCredits(user.id, store.id, 2, 'category_attributes', 'ai');
      await logAiUsage(user.id, store.id, 'category_attributes', null, null, 2, { path: '/ai/generate-category-attributes', bodyKeys: ['name'] }, { status: 200 });
    }

    res.status(201).json({ category: categoryToAiShape(category, store.defaultAiCategoryId) });
  } catch (error: any) {
    logger.error({ err: error }, 'Create AI category error:');
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

// POST /:id/generate-attributes — (re)generate + persist attributes for a category
aiCategoryRoutes.post('/:id/generate-attributes', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const name = categoryNameToString(category.name);
    const aiAttributes = await generateAttributesFor(name);

    await category.update({ aiAttributes });

    await deductCredits(user.id, store.id, 2, 'category_attributes', 'ai');
    await logAiUsage(user.id, store.id, 'category_attributes', null, null, 2, { path: `/categories/${category.id}/generate-attributes`, bodyKeys: [] }, { status: 200 });

    res.json({ category: categoryToAiShape(category, store.defaultAiCategoryId) });
  } catch (error: any) {
    logger.error({ err: error }, 'Regenerate AI category attributes error:');
    res.status(500).json({ error: error?.message || 'Attribute generation failed' });
  }
});

// PUT /:id — update a custom category (name / attributes)
aiCategoryRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
  body('name').optional().isString().isLength({ min: 2, max: 200 }),
  body('attributes').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const patch: any = {};
    if (req.body.name) patch.name = { tr: req.body.name, en: req.body.name };
    if (Array.isArray(req.body.attributes)) patch.aiAttributes = req.body.attributes;
    await category.update(patch);

    res.json({ category: categoryToAiShape(category, store.defaultAiCategoryId) });
  } catch (error) {
    logger.error({ err: error }, 'Update AI category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — delete a store-owned custom category
aiCategoryRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    await category.destroy();
    if (store.defaultAiCategoryId === Number(req.params.id)) {
      await store.update({ defaultAiCategoryId: null });
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, 'Delete AI category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /default — set (or clear with null) the store's default AI category
aiCategoryRoutes.post('/default', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('categoryId').optional({ values: 'null' }).isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const categoryId = req.body.categoryId != null ? Number(req.body.categoryId) : null;

    if (categoryId != null) {
      const category = await Category.findOne({
        where: { id: categoryId, [Op.or]: [{ storeId: null }, { storeId: store.id }] },
      });
      if (!category) return res.status(404).json({ error: 'Category not found' });
    }

    await store.update({ defaultAiCategoryId: categoryId });
    res.json({ ok: true, defaultCategoryId: categoryId });
  } catch (error) {
    logger.error({ err: error }, 'Set default AI category error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});