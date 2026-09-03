import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { BlogPost } from '../../models/ContentModels.js';
import { Product } from '../../models/Product.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { requireModule, getModuleCreditCost, getPlanForStore } from '../plan/access.js';
import { logger } from '../../utils/logger.js';
import { AI_TIMEOUT_MS, deductCredits, logAiUsage, resolveScenarioConfig, buildProviderPayload } from '../ai/routes.js';

export const blogRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

export const slugify = (value: string) => {
  return String(value).toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 150) || 'blog-yazi';
};

function parseIsoOrNull(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

blogRoutes.get('/', authMiddleware, requireStore, requireModule('blog'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const search = String(req.query.search ?? '').trim();

    const where: any = { storeId: store.id };
    if (search) where.title = { [Op.iLike]: `%${search}%` };

    const { rows, count } = await BlogPost.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({
      posts: rows,
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List blog posts error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

blogRoutes.get('/:id', authMiddleware, requireStore, requireModule('blog'), [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    res.json({ post });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get blog post error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

blogRoutes.post('/', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('blog'), [
  body('title').isString().isLength({ min: 2, max: 300 }),
  body('slug').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('excerpt').optional().isString(),
  body('content').optional().isString(),
  body('coverImage').optional().isString(),
  body('author').optional().isString().isLength({ max: 100 }),
  body('tags').optional().isArray(),
  body('meta').optional().isObject(),
  body('productId').optional().isInt(),
  body('isActive').optional().isBoolean(),
  body('publishedAt').optional().isISO8601(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const slug = req.body.slug || slugify(req.body.title);

    const existing = await BlogPost.findOne({ where: { storeId: store.id, slug } });
    if (existing) {
      return res.status(409).json({ error: 'Bu başlık/slug ile blog yazısı zaten var' });
    }

    const post = await BlogPost.create({
      storeId: store.id,
      slug,
      title: req.body.title,
      excerpt: req.body.excerpt || null,
      content: req.body.content || '',
      coverImage: req.body.coverImage || null,
      author: req.body.author || null,
      tags: req.body.tags || [],
      meta: req.body.meta || {},
      productId: req.body.productId || null,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      publishedAt: parseIsoOrNull(req.body.publishedAt) ?? new Date(),
    });

    res.status(201).json({ post });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create blog post error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

blogRoutes.put('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('blog'), [
  param('id').isInt(),
  body('title').optional().isString().isLength({ min: 2, max: 300 }),
  body('slug').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('excerpt').optional({ values: 'falsy' }).isString(),
  body('content').optional().isString(),
  body('coverImage').optional({ values: 'falsy' }).isString(),
  body('author').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  body('tags').optional().isArray(),
  body('meta').optional().isObject(),
  body('productId').optional({ values: 'falsy' }).isInt(),
  body('isActive').optional().isBoolean(),
  body('publishedAt').optional({ values: 'falsy' }).isISO8601(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const updates: any = { ...req.body };
    if (updates.slug || (!updates.slug && updates.title)) {
      updates.slug = slugify(updates.slug || updates.title);
    }
    if (updates.publishedAt !== undefined) {
      updates.publishedAt = parseIsoOrNull(updates.publishedAt);
    }

    if (updates.slug && updates.slug !== post.slug) {
      const existing = await BlogPost.findOne({ where: { storeId: store.id, slug: updates.slug } });
      if (existing) return res.status(409).json({ error: 'Bu slug ile blog yazısı zaten var' });
    }

    await post.update(updates);
    res.json({ post });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update blog post error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

blogRoutes.delete('/:id', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('blog'), [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    await post.destroy();
    res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete blog post error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * AI blog generation. Scenario: blog_generation. Credit cost comes from the
 * scenario default unless the plan overrides it via the blog_generation
 * module credit_cost (super admin pricing).
 */
blogRoutes.post('/generate', authMiddleware, requireRole('owner', 'admin'), requireStore, requireModule('blog_generation'), [
  body('topic').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('productId').optional({ values: 'falsy' }).isInt(),
  body('imageUrl').optional({ values: 'falsy' }).isString(),
  body('notes').optional({ values: 'falsy' }).isString(),
  body('keywords').optional().isArray(),
], validate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const store = (req as any).store;

  const plan = await getPlanForStore(store);
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig('blog_generation', { plan });
  const baseCredits = costCredits || 8;
  const moduleCost = getModuleCreditCost(plan, 'blog_generation');
  const credits = moduleCost != null ? moduleCost : baseCredits;

  if ((user.aiCredits ?? 0) < credits) {
    return res.status(402).json({
      error: 'INSUFFICIENT_CREDITS',
      credits: user.aiCredits ?? 0,
      required: credits,
      message: 'Blog üretimi için yeterli AI krediniz yok.',
    });
  }

  if (!provider || !model) {
    return res.status(422).json({
      error: 'AI_PROVIDER_NOT_CONFIGURED',
      message: 'Blog üretimi senaryosu için sağlayıcı/model atanmamış. Süper admin: AI Senaryoları sayfasından atayın.',
    });
  }

  try {
    let productInfo: Record<string, unknown> | null = null;
    if (req.body.productId) {
      const product = await Product.findOne({ where: { id: req.body.productId, storeId: store.id } });
      if (product) {
        productInfo = {
          id: product.id,
          title: product.title,
          description: product.description || '',
          sku: product.sku || '',
          price: product.priceTRY ?? null,
          currency: 'TRY',
          images: Array.isArray((product as any).images) ? (product as any).images : [],
        };
      }
    }

    const providerPayload = buildProviderPayload(provider, model, scenario, keys);
    const axios = (await import('axios')).default;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';

    const response = await axios.post(
      `${aiServiceUrl}/ai/blog`,
      { ...req.body, product: productInfo, ...providerPayload },
      { timeout: AI_TIMEOUT_MS }
    );

    await deductCredits(user.id, store.id, credits, 'blog_generation', 'blog_generation');
    await logAiUsage(
      user.id, store.id, 'blog_generation',
      provider?.id || null, model?.id || null, credits,
      { path: '/ai/blog', bodyKeys: Object.keys(req.body) },
      { status: response.status }
    );
    try {
      const { checkAndNotifyQuota } = await import('../quota/service.js');
      checkAndNotifyQuota(store.id, user.id).catch(() => undefined);
    } catch { /* ignore */ }

    res.json(response.data);
  } catch (error: any) {
    logger.error(
      { scenarioCode: 'blog_generation', message: error?.message, status: error?.response?.status },
      'Blog generate error'
    );
    await logAiUsage(
      user.id, store.id, 'blog_generation',
      provider?.id || null, model?.id || null, credits,
      { path: '/ai/blog', bodyKeys: Object.keys(req.body) },
      { error: error.message }
    ).catch(() => {});

    const status = error?.response?.status || 500;
    const upstream = error?.response?.data?.error || error.message;
    res.status(status).json({ error: upstream, message: 'Blog yazısı üretilemedi. Yazılı konu veya ürün bilgisi sağladığınızdan emin olun.' });
  }
});