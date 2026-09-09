import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
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

function computeReadingTime(content: string): number {
  const words = String(content || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

// In-memory bulk job store (lightweight, survives until restart; for prod use DB or Redis)
const bulkJobs = new Map<string, any>();

blogRoutes.get('/', authMiddleware, requireStore, requireModule('blog'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const search = String(req.query.search ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const sortBy = String(req.query.sortBy ?? 'createdAt');
    const sortOrder = String(req.query.sortOrder ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where: any = { storeId: store.id };
    if (search) where.title = { [Op.iLike]: `%${search}%` };
    if (status && ['draft','scheduled','published','archived'].includes(status)) where.status = status;

    const allowedSort = ['createdAt','publishedAt','scheduledAt','viewCount','title'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const { rows, count } = await BlogPost.findAndCountAll({
      where,
      order: [[orderField, sortOrder]],
      offset: (page - 1) * limit,
      limit,
    });

    // summary counts
    const [draftCount, scheduledCount, publishedCount, archivedCount] = await Promise.all([
      BlogPost.count({ where: { storeId: store.id, status: 'draft' } }),
      BlogPost.count({ where: { storeId: store.id, status: 'scheduled' } }),
      BlogPost.count({ where: { storeId: store.id, status: 'published' } }),
      BlogPost.count({ where: { storeId: store.id, status: 'archived' } }),
    ]);

    res.json({
      posts: rows,
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
      summary: { draft: draftCount, scheduled: scheduledCount, published: publishedCount, archived: archivedCount, total: draftCount+scheduledCount+publishedCount+archivedCount },
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
  body('productId').optional({ values: 'falsy' }).isInt(),
  body('isActive').optional().isBoolean(),
  body('publishedAt').optional({ values: 'falsy' }).isISO8601(),
  body('status').optional().isIn(['draft','scheduled','published','archived']),
  body('scheduledAt').optional({ values: 'falsy' }).isISO8601(),
  body('ctaTitle').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('ctaSubtitle').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('ctaUrl').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('seo').optional().isObject(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.title);

    const existing = await BlogPost.findOne({ where: { storeId: store.id, slug } });
    if (existing) {
      return res.status(409).json({ error: 'Bu başlık/slug ile blog yazısı zaten var' });
    }

    const status = req.body.status || (req.body.isActive === false ? 'draft' : 'published');
    const scheduledAt = parseIsoOrNull(req.body.scheduledAt);
    const publishedAt = parseIsoOrNull(req.body.publishedAt) ?? (status === 'published' ? new Date() : null);
    const seo = req.body.seo || {};
    if (!seo.readingTime && req.body.content) seo.readingTime = computeReadingTime(req.body.content);

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
      isActive: status === 'published',
      publishedAt,
      status,
      scheduledAt: status === 'scheduled' ? (scheduledAt || new Date(Date.now()+ 24*60*60*1000)) : null,
      viewCount: 0,
      ctaTitle: req.body.ctaTitle || null,
      ctaSubtitle: req.body.ctaSubtitle || null,
      ctaUrl: req.body.ctaUrl || '/register',
      seo,
    } as any);

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
  body('status').optional().isIn(['draft','scheduled','published','archived']),
  body('scheduledAt').optional({ values: 'falsy' }).isISO8601(),
  body('ctaTitle').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('ctaSubtitle').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('ctaUrl').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('seo').optional().isObject(),
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
    if (updates.scheduledAt !== undefined) {
      updates.scheduledAt = parseIsoOrNull(updates.scheduledAt);
    }
    if (updates.status) {
      updates.isActive = updates.status === 'published';
      if (updates.status === 'published' && !updates.publishedAt) updates.publishedAt = new Date();
      if (updates.status === 'scheduled' && !updates.scheduledAt) updates.scheduledAt = new Date(Date.now()+24*60*60*1000);
    }
    if (updates.content && updates.seo) {
      if (!updates.seo.readingTime) updates.seo.readingTime = computeReadingTime(updates.content);
    } else if (updates.content && (post as any).seo) {
      const seo = { ...((post as any).seo || {}) };
      seo.readingTime = computeReadingTime(updates.content);
      updates.seo = seo;
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

// Publish / unpublish / schedule helpers
blogRoutes.post('/:id/publish', authMiddleware, requireRole('owner','admin'), requireStore, requireModule('blog'), [param('id').isInt()], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    await post.update({ status: 'published', isActive: true, publishedAt: new Date(), scheduledAt: null } as any);
    res.json({ post });
  } catch (e) { logger.error({err:e},'publish'); res.status(500).json({error:'Internal'}); }
});
blogRoutes.post('/:id/unpublish', authMiddleware, requireRole('owner','admin'), requireStore, requireModule('blog'), [param('id').isInt()], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    await post.update({ status: 'draft', isActive: false } as any);
    res.json({ post });
  } catch (e) { logger.error({err:e},'unpublish'); res.status(500).json({error:'Internal'}); }
});
blogRoutes.post('/:id/schedule', authMiddleware, requireRole('owner','admin'), requireStore, requireModule('blog'), [param('id').isInt(), body('scheduledAt').isISO8601()], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const post = await BlogPost.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    const at = parseIsoOrNull(req.body.scheduledAt);
    if (!at || at.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'scheduledAt must be future date' });
    await post.update({ status: 'scheduled', isActive: false, scheduledAt: at } as any);
    res.json({ post });
  } catch (e) { logger.error({err:e},'schedule'); res.status(500).json({error:'Internal'}); }
});

// Bulk generate: topics alt alta, aralıklı otomatik yayın (sadece süperadmin — mağaza blog bulk artık kullanılmıyor, platform blog için /api/admin/saas/blogs/bulk/generate kullanın)
blogRoutes.post('/bulk/generate', authMiddleware, requireRole('superadmin'), requireStore, requireModule('blog_generation'), [
  body('topics').isString().isLength({ min: 3, max: 10000 }),
  body('keywords').optional().isArray(),
  body('notes').optional().isString().isLength({ max: 2000 }),
  body('productId').optional({ values: 'falsy' }).isInt(),
  body('ctaTitle').optional().isString().isLength({ max: 200 }),
  body('ctaSubtitle').optional().isString().isLength({ max: 500 }),
  body('ctaUrl').optional().isString().isLength({ max: 500 }),
  body('scheduleMode').optional().isIn(['draft','scheduled','publish_now']),
  body('startAt').optional({ values: 'falsy' }).isISO8601(),
  body('intervalDays').optional().isInt({ min: 1, max: 30 }),
  body('intervalHours').optional().isInt({ min: 1, max: 72 }),
], validate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const store = (req as any).store;
  const topics = String(req.body.topics).split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0, 50);
  if (topics.length === 0) return res.status(400).json({ error: 'En az 1 konu gerekli' });
  if (topics.length > 30) return res.status(400).json({ error: 'En fazla 30 konu' });

  const plan = await getPlanForStore(store);
  const { provider, model, scenario, costCredits, keys } = await resolveScenarioConfig('blog_generation', { plan });
  const baseCredits = costCredits || 8;
  const moduleCost = getModuleCreditCost(plan, 'blog_generation');
  const perTopic = moduleCost != null ? moduleCost : baseCredits;
  const totalCredits = perTopic * topics.length;

  if ((user.aiCredits ?? 0) < totalCredits) {
    return res.status(402).json({ error: 'INSUFFICIENT_CREDITS', credits: user.aiCredits ?? 0, required: totalCredits, message: `Toplam ${totalCredits} kredi gerekli, mevcut ${user.aiCredits ?? 0}` });
  }
  if (!provider || !model) return res.status(422).json({ error: 'AI_PROVIDER_NOT_CONFIGURED', message: 'Blog senaryosu için sağlayıcı/model atanmamış' });

  const jobId = `bulk_${store.id}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const scheduleMode = req.body.scheduleMode || 'scheduled';
  const intervalDays = Number(req.body.intervalDays) || 1;
  const intervalHours = req.body.intervalHours ? Number(req.body.intervalHours) : null;
  const startAt = parseIsoOrNull(req.body.startAt) || new Date(Date.now()+ 60*60*1000);
  const productId = req.body.productId || null;
  const keywords = Array.isArray(req.body.keywords) ? req.body.keywords : (req.body.keywords ? String(req.body.keywords).split(',').map((s:string)=>s.trim()).filter(Boolean) : []);
  const notes = req.body.notes || '';
  const ctaTitle = req.body.ctaTitle || null;
  const ctaSubtitle = req.body.ctaSubtitle || null;
  const ctaUrl = req.body.ctaUrl || '/register';

  bulkJobs.set(jobId, { id: jobId, storeId: store.id, total: topics.length, done: 0, failed: 0, pending: topics.length, topics: topics.map((t:string,i:number)=>({ topic:t, status:'pending', index:i })), createdAt: new Date().toISOString(), scheduleMode, startAt: startAt.toISOString() });

  // background processing (fire and forget)
  (async () => {
    const axios = (await import('axios')).default;
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3001';
    let productInfo: Record<string, unknown> | null = null;
    if (productId) {
      const p = await Product.findOne({ where: { id: productId, storeId: store.id } });
      if (p) productInfo = { id:p.id, title:p.title, description:p.description||'', sku:p.sku||'', price:p.priceTRY??null, currency:'TRY', images: Array.isArray((p as any).images)?(p as any).images:[] };
    }
    const providerPayload = buildProviderPayload(provider, model, scenario, keys);
    for (let i=0;i<topics.length;i++) {
      const topic = topics[i];
      const job = bulkJobs.get(jobId);
      if (!job) break;
      job.topics[i].status = 'processing';
      try {
        const resp = await axios.post(`${aiServiceUrl}/ai/blog`, { topic, product: productInfo, notes, keywords, ...providerPayload }, { timeout: AI_TIMEOUT_MS });
        const data = resp.data;
        // deduct per topic with FOR UPDATE protection
        try { await deductCredits(user.id, store.id, perTopic, 'blog_generation', 'blog_generation'); } catch (deductErr:any) {
          if (deductErr?.status===402) { job.topics[i].status='failed'; job.topics[i].error='Yetersiz kredi'; job.failed++; job.pending--; continue; }
          throw deductErr;
        }
        await logAiUsage(user.id, store.id, 'blog_generation', provider?.id||null, model?.id||null, perTopic, { path:'/ai/blog', topic }, { status: resp.status }).catch(()=>{});
        // compute scheduled/publish date
        let scheduledAt: Date | null = null;
        let status: string = 'draft';
        let publishedAt: Date | null = null;
        if (scheduleMode === 'publish_now') { status='published'; publishedAt=new Date(); }
        else if (scheduleMode === 'scheduled') {
          status='scheduled';
          const base = new Date(startAt);
          if (intervalHours) base.setHours(base.getHours() + i*intervalHours);
          else base.setDate(base.getDate() + i*intervalDays);
          scheduledAt = base;
        } else { status='draft'; }

        const slugBase = slugify(data.slug || data.title || topic);
        let slug = slugBase;
        // ensure unique slug per store
        let counter=1;
        while (await BlogPost.findOne({ where:{ storeId: store.id, slug } })) { slug = `${slugBase}-${counter++}`; if(counter>10) { slug=`${slugBase}-${Date.now()}`; break; } }

        const content = data.content || '';
        const seo = {
          metaTitle: (data.seo_title || data.title || topic).slice(0,60),
          metaDescription: (data.seo_description || data.excerpt || '').slice(0,160),
          keywords: data.keywords || keywords || [],
          faq: data.faq || [],
          canonical: null,
          readingTime: computeReadingTime(content),
        };

        const post = await BlogPost.create({
          storeId: store.id,
          slug,
          title: (data.title || topic).slice(0,300),
          excerpt: (data.excerpt || '').slice(0,500),
          content,
          coverImage: data.coverImage || null,
          author: null,
          tags: data.tags || [],
          meta: { seo_title: seo.metaTitle, seo_description: seo.metaDescription },
          productId: productId || null,
          isActive: status==='published',
          publishedAt,
          status,
          scheduledAt,
          viewCount: 0,
          ctaTitle,
          ctaSubtitle,
          ctaUrl,
          seo,
          bulkJobId: jobId,
        } as any);

        job.topics[i].status='done';
        job.topics[i].postId = post.id;
        job.topics[i].slug = slug;
        job.done++; job.pending--;
      } catch (err:any) {
        logger.error({ err: err.message, topic }, 'Bulk blog topic failed');
        await logAiUsage(user.id, store.id, 'blog_generation', provider?.id||null, model?.id||null, perTopic, { topic }, { error: err.message }).catch(()=>{});
        const job2 = bulkJobs.get(jobId);
        if (job2) { job2.topics[i].status='failed'; job2.topics[i].error= err?.response?.data?.error || err.message || 'Hata'; job2.failed++; job2.pending--; }
      }
      // gentle pacing to avoid provider rate limit
      if (i < topics.length-1) await new Promise(r=>setTimeout(r, 800));
    }
    const finalJob = bulkJobs.get(jobId);
    if (finalJob) { finalJob.completedAt = new Date().toISOString(); finalJob.doneAt = new Date().toISOString(); }
    try { const { checkAndNotifyQuota } = await import('../quota/service.js'); checkAndNotifyQuota(store.id, user.id).catch(()=>undefined); } catch {}
  })().catch(err=>logger.error({err},'bulk blog background error'));

  res.status(202).json({ jobId, total: topics.length, requiredCredits: totalCredits, scheduleMode, message: `${topics.length} konu kuyruğa alındı` });
});

blogRoutes.get('/bulk/:jobId', authMiddleware, requireStore, [param('jobId').isString()], validate, async (req: Request, res: Response) => {
  const store = (req as any).store;
  const job = bulkJobs.get(req.params.jobId);
  if (!job || job.storeId !== store.id) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

// Analytics overview for blog
blogRoutes.get('/analytics/overview', authMiddleware, requireStore, requireModule('blog'), async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const { StoreAnalyticsEvent } = await import('../../models/StoreAnalyticsEvent.model.js');
    const topPosts = await BlogPost.findAll({ where:{ storeId: store.id }, order:[['viewCount','DESC']], limit:10, attributes:['id','title','slug','viewCount','status','publishedAt','scheduledAt'] });
    const totalViews = await BlogPost.sum('viewCount', { where:{ storeId: store.id } }) as number || 0;
    const totalPosts = await BlogPost.count({ where:{ storeId: store.id } });
    const byStatus = {
      draft: await BlogPost.count({ where:{ storeId: store.id, status:'draft' } }),
      scheduled: await BlogPost.count({ where:{ storeId: store.id, status:'scheduled' } }),
      published: await BlogPost.count({ where:{ storeId: store.id, status:'published' } }),
      archived: await BlogPost.count({ where:{ storeId: store.id, status:'archived' } }),
    };
    // blog_view events last 30 days daily
    const since = new Date(Date.now()-30*24*60*60*1000);
    const events: any[] = await StoreAnalyticsEvent.findAll({ where:{ storeId: store.id, eventType:'blog_view' as any, createdAt:{ [Op.gte]: since } }, attributes:['createdAt','metadata','path'], order:[['createdAt','ASC']], limit:5000 });
    // group by day
    const daily: Record<string, number> = {};
    for (const e of events) {
      const d = new Date(e.createdAt).toISOString().slice(0,10);
      daily[d] = (daily[d]||0)+1;
    }
    res.json({ topPosts, totalViews, totalPosts, byStatus, daily, recentEvents: events.slice(-20).reverse() });
  } catch (e:any){ logger.error({err:e},'blog analytics'); res.status(500).json({error:'Internal'}); }
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

    try { await deductCredits(user.id, store.id, credits, 'blog_generation', 'blog_generation'); } catch (deductErr:any){
      if (deductErr?.status===402) return res.status(402).json({ error:'INSUFFICIENT_CREDITS', credits:0, required:credits, message:'Yetersiz kredi (eşzamanlı işlem)' });
      throw deductErr;
    }
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
