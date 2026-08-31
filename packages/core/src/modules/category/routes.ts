import { Router, Request, Response } from 'express';
import { Op, cast, col, where as seqWhere } from 'sequelize';
import { body, param, query, validationResult } from 'express-validator';
import { Category } from '../../models/Category.model.js';
import { MarketplaceCategoryMapping } from '../../models/Category.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';
import { CHANNEL_RULES, MARKETPLACE_CHANNEL_KEYS } from '../ai/channelRequirements.js';
import { createMarketplaceClient } from '../../marketplace/clients/index.js';

export const categoryRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

function dedupeMarketplaceRows(rows: any[]): any[] {
  if (!rows.length) return rows
  const byMp = new Map<string, any>()
  const byId = new Map<number, any>()
  for (const r of rows) { byId.set((r as any).id, r) }
  for (const r of rows) {
    const src = (r as any).source
    const mpId = (r as any).marketplaceCategoryId
    if (src && mpId) {
      const key = `${(r as any).storeId}-${src}-${mpId}`
      const ex = byMp.get(key)
      if (!ex || (r as any).id > (ex as any).id) byMp.set(key, r)
    }
  }
  if (byMp.size === 0) return rows
  const keptIds = new Set<number>(Array.from(byMp.values()).map(r => (r as any).id))
  const result = rows.filter(r => {
    const src = (r as any).source
    const mpId = (r as any).marketplaceCategoryId
    if (src && mpId) return keptIds.has((r as any).id)
    return true
  })
  const mpToKeptId = new Map<string, number>()
  for (const r of byMp.values()) mpToKeptId.set(`${(r as any).storeId}-${(r as any).source}-${(r as any).marketplaceCategoryId}`, (r as any).id)
  for (const r of result) {
    const pid = (r as any).parentId
    if (pid != null && byId.has(pid) && !keptIds.has(pid)) {
      const parentRow = byId.get(pid)!
      const pSrc = (parentRow as any).source
      const pMpId = (parentRow as any).marketplaceCategoryId
      if (pSrc && pMpId) {
        const kept = mpToKeptId.get(`${(parentRow as any).storeId}-${pSrc}-${pMpId}`)
        if (kept) (r as any).parentId = kept
        else (r as any).parentId = null
      }
    }
  }
  return result
}

function buildCategoryTree(rows: any[]): any[] {
  const deduped = dedupeMarketplaceRows(rows)
  const map = new Map<number, any>()
  const roots: any[] = []
  for (const r of deduped) {
    const node = (r.toJSON ? r.toJSON() : { ...r })
    // ensure plain object copy to avoid mutating original
    const copy: any = { ...node, children: [] }
    // toJSON already converts name JSONB etc.
    map.set(copy.id, copy)
  }
  for (const r of deduped) {
    const node = map.get((r as any).id)!
    const pid = (r as any).parentId ?? null
    if (pid != null && map.has(pid)) {
      map.get(pid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortRec = (arr: any[]) => {
    arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name?.tr || a.name || '').localeCompare(String(b.name?.tr || b.name || '')))
    for (const n of arr) if (n.children?.length) sortRec(n.children)
  }
  sortRec(roots)
  return roots
}

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

    if (flat === 'true') {
      const rows = await Category.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
      const categories = dedupeMarketplaceRows(rows);
      res.json({ categories });
      return
    }
    const rows = await Category.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    const categories = buildCategoryTree(rows);
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

    const where: any = { storeId: store.id, isActive: true };
    if (source !== undefined && source !== '') {
      where.source = String(source);
    } else {
      where.source = { [Op.eq]: null };
    }

    const rows = await Category.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] });
    const categories = buildCategoryTree(rows).filter((r: any) => r.parentId == null)
    res.json({ categories });
  } catch (error) {
    logger.error({ err: error }, 'Category tree error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/categories/search?q=...  (must be declared before /:id)
categoryRoutes.get('/search', authMiddleware, requireStore, [
  query('q').isString().isLength({ min: 2 }).withMessage('Search term must be at least 2 characters'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const q = String(req.query.q);
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 100) : 20;

    const categories = await Category.findAll({
      where: {
        storeId: store.id,
        [Op.or]: [
          { slug: { [Op.iLike]: `%${q}%` } },
          seqWhere(cast(col('name'), 'text'), { [Op.iLike]: `%${q}%` }),
        ],
      },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      limit,
      include: [{ model: Category, as: 'parent' }],
    });

    res.json({ categories });
  } catch (error) {
    logger.error({ err: error }, 'Search categories error:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

function slugifyTr(value: string): string {
  const trMap: Record<string, string> = { 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ş': 's', 'Ş': 's', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' }
  let s = String(value || '').replace(/[ğĞüÜşŞıİöÖçÇ]/g, ch => trMap[ch] || ch)
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 190)
  return s || 'kategori'
}
function flattenMarketplaceTree(nodes: any[], parentId: number = 0): { id: number; name: string; parentId: number }[] {
  const out: { id: number; name: string; parentId: number }[] = []
  for (const n of nodes) {
    const id = Number(n.id ?? n.marketplace_category_id ?? 0)
    if (!id) continue
    out.push({ id, name: n.name ?? '', parentId })
    const kids = n.subCategories ?? n.children ?? n.categoryList ?? []
    if (Array.isArray(kids) && kids.length) out.push(...flattenMarketplaceTree(kids, id))
  }
  return out
}

// POST /api/admin/categories/copy-marketplace — branch copy without attributes
categoryRoutes.post('/copy-marketplace', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('marketplace').isString().isIn(['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy']),
  body('categoryId').isInt(),
  body('targetParentId').optional({ values: 'null' }).isInt(),
], validate, async (req: Request, res: Response) => {
  const t = await Category.sequelize!.transaction()
  try {
    const store = (req as any).store
    const { marketplace, categoryId, targetParentId } = req.body

    let targetParent: any = null
    if (targetParentId != null) {
      targetParent = await Category.findOne({ where: { id: targetParentId, storeId: store.id }, transaction: t })
      if (!targetParent) { await t.rollback(); return res.status(404).json({ error: 'Hedef üst kategori bulunamadı' }) }
      if ((targetParent as any).source) { await t.rollback(); return res.status(400).json({ error: 'Hedef kategori kendi kategorilerinizden olmalı' }) }
    }

    const sourceRoot = await Category.findOne({ where: { id: categoryId, storeId: store.id, source: marketplace }, transaction: t })
    if (!sourceRoot) { await t.rollback(); return res.status(404).json({ error: 'Kaynak kategori bulunamadı. Önce pazaryeri kategorilerini senkronize edin.' }) }

    // Try live marketplace tree for accurate hierarchy (fallback to DB if live fails)
    let liveBranch: { id: number; name: string; parentId: number }[] | null = null
    let ordered: any[] = []
    let branchIds = new Set<number>()
    try {
      const integ = await MarketplaceIntegration.findOne({ where: { storeId: store.id, marketplace }, transaction: t })
      if (integ) {
        const c = integ as any
        const cfg = (c.config || {}) as any
        // need at least some config to auth; try anyway
        try {
          const client: any = createMarketplaceClient(marketplace as any, cfg)
          if (client && typeof client.getCategories === 'function') {
            const raw = await client.getCategories()
            if (Array.isArray(raw) && raw.length) {
              let flat: { id: number; name: string; parentId: number }[] = []
              // raw may already be flat (trendyol) with parentId, detect
              const isFlat = raw.length && raw[0] && typeof raw[0].parentId !== 'undefined'
              if (isFlat) {
                flat = raw.map((r: any) => ({ id: Number(r.id), name: String(r.name || ''), parentId: Number(r.parentId ?? 0) }))
              } else {
                flat = flattenMarketplaceTree(raw, 0)
              }
              const rootMpId = Number((sourceRoot as any).marketplaceCategoryId)
              if (rootMpId) {
                const liveParentMap = new Map<number, typeof flat>()
                for (const f of flat) {
                  if (!liveParentMap.has(f.parentId)) liveParentMap.set(f.parentId, [] as any)
                  ;(liveParentMap.get(f.parentId) as any).push(f)
                }
                const seenMp = new Set<number>()
                const stackMp: number[] = [rootMpId]
                const branchMpIds = new Set<number>()
                while (stackMp.length) {
                  const cur = stackMp.pop()!
                  if (branchMpIds.has(cur)) continue
                  branchMpIds.add(cur)
                  const kids = (liveParentMap.get(cur) as any) ?? []
                  for (const k of kids) if (!branchMpIds.has(k.id)) stackMp.push(k.id)
                }
                if (branchMpIds.size > 0) {
                  // build ordered BFS for live branch
                  const idToLive = new Map<number, any>(flat.map(f => [f.id, f]))
                  const qLive: number[] = [rootMpId]
                  const seenLive = new Set<number>([rootMpId])
                  const orderedLive: any[] = []
                  while (qLive.length) {
                    const cid = qLive.shift()!
                    const node = idToLive.get(cid)
                    if (!node) continue
                    orderedLive.push(node)
                    const kids = (liveParentMap.get(cid) as any) ?? []
                    for (const k of kids) if (!seenLive.has(k.id)) { seenLive.add(k.id); qLive.push(k.id) }
                  }
                  if (orderedLive.length) {
                    liveBranch = orderedLive
                  }
                }
              }
            }
          }
        } catch (e) { logger.warn({ err: e }, 'Live marketplace fetch for copy failed, fallback to DB') }
      }
    } catch {}

    // Fallback to DB branch if live not available
    let useLive = false
    if (liveBranch && liveBranch.length) {
      useLive = true
      // liveBranch ordered already BFS
      ordered = liveBranch.map(n => ({ __live: true, id: n.id, name: { tr: n.name, en: n.name }, marketplaceCategoryId: String(n.id), parentMpId: n.parentId, sortOrder: 0, translations: {}, icon: null }))
      // For live, branchIds is mp ids, but for targetParent check we already did DB branch; also check live target not in branch (target is own, so not in live branch) — no check needed
      // Build liveParentMap for ordering already done; ordered is liveBranch
      // For live, we need to know branch size for logging; create dummy branchIds set of mp ids
      branchIds = new Set(liveBranch.map(n => n.id))
      // additionally check DB branch for circular safety (already done below via DB fallback? skip)
    } else {
      const rawAllMp = await Category.findAll({ where: { storeId: store.id, source: marketplace }, transaction: t })
      const allMp = dedupeMarketplaceRows(rawAllMp)
      // if sourceRoot is a duplicate that was pruned, map to kept one
      let effectiveRoot: any = sourceRoot
      const mpKey = `${(sourceRoot as any).storeId}-${(sourceRoot as any).source}-${(sourceRoot as any).marketplaceCategoryId}`
      const keptForRoot = allMp.find((c: any) => `${(c as any).storeId}-${(c as any).source}-${(c as any).marketplaceCategoryId}` === mpKey)
      if (keptForRoot) effectiveRoot = keptForRoot
      const parentMap = new Map<number | null, any[]>()
      for (const c of allMp) {
        const pid = (c as any).parentId ?? null
        if (!parentMap.has(pid)) parentMap.set(pid, [])
        parentMap.get(pid)!.push(c)
      }
      branchIds = new Set<number>()
      const stack: number[] = [effectiveRoot.id]
      while (stack.length) {
        const cur = stack.pop()!
        if (branchIds.has(cur)) continue
        branchIds.add(cur)
        const children = parentMap.get(cur) ?? []
        for (const ch of children) stack.push((ch as any).id)
      }
      if (targetParentId != null && branchIds.has(Number(targetParentId))) {
        await t.rollback(); return res.status(400).json({ error: 'Hedef kategori, kopyalanan dalın içinde olamaz' })
      }
      const queue: number[] = [effectiveRoot.id]
      const idToCat = new Map<number, any>(allMp.map((c: any) => [c.id, c]))
      const seen = new Set<number>([effectiveRoot.id])
      // override sourceRoot for later parent check
      ;(sourceRoot as any).id = effectiveRoot.id
      while (queue.length) {
        const curId = queue.shift()!
        const cur = idToCat.get(curId)
        if (!cur) continue
        ordered.push(cur)
        const children = parentMap.get(curId) ?? []
        for (const ch of children) {
          if (!seen.has((ch as any).id)) { seen.add((ch as any).id); queue.push((ch as any).id) }
        }
      }
    }
    if (!useLive && targetParentId != null && branchIds.has(Number(targetParentId))) {
      await t.rollback(); return res.status(400).json({ error: 'Hedef kategori, kopyalanan dalın içinde olamaz' })
    }

    // collect existing slugs for uniqueness (global per store, all sources share unique index)
    const allStoreCats = await Category.findAll({ where: { storeId: store.id }, attributes: ['slug'], transaction: t })
    const usedSlugs = new Set<string>(allStoreCats.map((c: any) => c.slug))

    const getTr = (name: any) => {
      if (!name) return ''
      if (typeof name === 'string') return name
      if (typeof name === 'object') return (name as any).tr || (name as any).en || ''
      return ''
    }

    const oldToNew = new Map<number, number>()
    const created: any[] = []

    for (let idx = 0; idx < ordered.length; idx++) {
      const old = ordered[idx]
      const trName = getTr((old as any).name)
      let base = slugifyTr(trName)
      if (!base) base = `kategori-${(old as any).id}`
      let slug = base
      let suf = 1
      while (usedSlugs.has(slug)) { slug = `${base}-${suf++}` }
      usedSlugs.add(slug)

      let newParentId: number | null = null
      if (useLive) {
        if (idx === 0) {
          newParentId = targetParentId != null ? Number(targetParentId) : null
        } else {
          const parentMpId = (old as any).parentMpId
          if (parentMpId != null && parentMpId !== 0) newParentId = oldToNew.get(parentMpId) ?? null
        }
      } else {
        const parentOldId = (old as any).parentId
        if ((old as any).id === sourceRoot.id) {
          newParentId = targetParentId != null ? Number(targetParentId) : null
        } else if (parentOldId != null) {
          newParentId = oldToNew.get(parentOldId) ?? null
        }
      }

      const createdCat = await Category.create({
        storeId: store.id,
        name: (old as any).name,
        slug,
        parentId: newParentId,
        translations: (old as any).translations || {},
        icon: (old as any).icon || null,
        sortOrder: (old as any).sortOrder ?? 0,
        isActive: true,
        source: null as any,
        marketplaceCategoryId: null as any,
        aiAttributes: null as any,
      } as any, { transaction: t })

      oldToNew.set((old as any).id, (createdCat as any).id)
      created.push(createdCat)
    }

    await t.commit()
    res.status(201).json({ copied: created.length, categories: created })
  } catch (error) {
    try { await t.rollback() } catch {}
    logger.error({ err: error }, 'Copy marketplace category branch error:')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/admin/categories/cleanup-duplicates — remove duplicate marketplace categories (keep latest)
categoryRoutes.post('/cleanup-duplicates', authMiddleware, requireRole('owner', 'admin'), requireStore, async (req: Request, res: Response) => {
  const t = await Category.sequelize!.transaction()
  try {
    const store = (req as any).store
    const rows = await Category.findAll({ where: { storeId: store.id, source: { [Op.ne]: null as any } }, transaction: t })
    const byKey = new Map<string, any[]>()
    for (const r of rows) {
      const key = `${(r as any).storeId}-${(r as any).source}-${(r as any).marketplaceCategoryId}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(r)
    }
    let deleted = 0
    for (const [, list] of byKey) {
      if (list.length <= 1) continue
      list.sort((a: any, b: any) => b.id - a.id) // keep latest (max id)
      const keep = list[0]
      const toDelete = list.slice(1)
      for (const d of toDelete) {
        await (d as any).destroy({ transaction: t })
        deleted++
      }
      // fix children that pointed to deleted parents -> repoint to kept
      for (const d of toDelete) {
        await Category.update({ parentId: (keep as any).id }, { where: { parentId: (d as any).id, storeId: store.id }, transaction: t })
      }
    }
    await t.commit()
    res.json({ deleted, message: `${deleted} yinelenen kategori temizlendi` })
  } catch (error) {
    try { await t.rollback() } catch {}
    logger.error({ err: error }, 'Cleanup duplicates error:')
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/admin/categories/:id/channel-requirements
categoryRoutes.get('/:id/channel-requirements', authMiddleware, requireStore, [
  param('id').isInt(),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const category = await Category.findOne({ where: { id: req.params.id, storeId: store.id } });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const mappings = await MarketplaceCategoryMapping.findAll({ where: { categoryId: category.id } });
    const mappingByChannel: Record<string, any> = {};
    for (const m of mappings) mappingByChannel[m.marketplace] = m;

    const channels = MARKETPLACE_CHANNEL_KEYS.map((channel) => {
      const rule = CHANNEL_RULES[channel];
      return {
        channel,
        requiredFields: rule.requiredFields,
        requiresCategoryMapping: rule.requiresCategoryMapping,
        requiresBrand: rule.requiresBrand,
        hasMapping: !!mappingByChannel[channel],
        mapping: mappingByChannel[channel] || null,
      };
    });

    res.json({ categoryId: category.id, channels });
  } catch (error) {
    logger.error({ err: error }, 'Channel requirements error:');
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