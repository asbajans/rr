import { Router, Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import { body, validationResult } from 'express-validator';
import { Product } from '../../models/Product.model.js';
import { ProductVariant } from '../../models/ProductVariant.model.js';
import { ProductMarketplaceListing } from '../../models/ProductMarketplaceListing.model.js';
import { ProductB2bSetting } from '../../models/ProductB2bSetting.model.js';
import { B2BRequest, B2BListedProduct } from '../../models/B2BModels.js';
import { sequelize } from '../../config/database.js';
import { authMiddleware, requireRole, requireStore } from '../auth/middleware.js';
import { logger } from '../../utils/logger.js';

export const mergeRoutes: Router = Router();

const validate = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

function union<T>(...arrs: (T[] | null | undefined)[]): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const a of arrs) {
    if (!Array.isArray(a)) continue;
    for (const x of a) {
      if (x == null) continue;
      const key = String(x);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(x);
      }
    }
  }
  return out;
}

function deepMerge(...objs: (object | null | undefined)[]): object {
  const out: any = {};
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    for (const [k, v] of Object.entries(o)) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        // Prefer the first non-empty array; keeps attribute lists intact
        if (out[k] == null || (Array.isArray(out[k]) && out[k].length === 0)) {
          out[k] = v;
        }
      } else if (typeof v === 'object') {
        out[k] = deepMerge(out[k], v);
      } else {
        if (out[k] == null) out[k] = v;
      }
    }
  }
  return out;
}

// GET /api/admin/products/merge/duplicates — group products by identical SKU within the store
mergeRoutes.get('/merge/duplicates', authMiddleware, requireStore, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;

    const dupGroups: any[] = await Product.findAll({
      where: { storeId: store.id },
      attributes: ['sku', [fn('COUNT', col('id')), 'count']],
      group: ['sku'],
      having: literal('COUNT(*) > 1'),
      raw: true,
    });

    if (!dupGroups.length) {
      return res.json({ groups: [], total: 0 });
    }

    const skus = dupGroups.map((g) => g.sku);
    const products = await Product.findAll({
      where: { storeId: store.id, sku: { [Op.in]: skus } },
      order: [['sku', 'ASC'], ['createdAt', 'DESC']],
      include: [{ model: ProductVariant, as: 'variants' }],
    });

    const grouped = new Map<string, any[]>();
    for (const p of products) {
      if (!grouped.has(p.sku)) grouped.set(p.sku, []);
      grouped.get(p.sku)!.push(p);
    }

    const groups = Array.from(grouped.entries())
      .filter(([, items]) => items.length > 1)
      .map(([sku, items]) => ({
        sku,
        count: items.length,
        products: items.map((p) => ({
          ...p.toJSON(),
          variantCount: (p.variants || []).length,
        })),
      }))
      .sort((a, b) => a.sku.localeCompare(b.sku, 'tr'));

    res.json({ groups, total: groups.length });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Find duplicate SKUs error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/products/merge — merge removeIds into keepId (transactional)
mergeRoutes.post('/merge', authMiddleware, requireRole('owner', 'admin'), requireStore, [
  body('keepId').isInt(),
  body('removeIds').isArray({ min: 1 }).custom((ids: any[]) => ids.every((id: any) => Number.isInteger(id))),
], validate, async (req: Request, res: Response) => {
  try {
    const store = (req as any).store;
    const keepId = req.body.keepId;
    let removeIds: number[] = req.body.removeIds.filter((id: number) => id !== keepId);
    if (removeIds.length === 0) {
      return res.status(400).json({ error: 'removeIds must not be empty' });
    }

    const result = await sequelize.transaction(async (t) => {
      const keep = await Product.findOne({ where: { id: keepId, storeId: store.id }, transaction: t });
      if (!keep) throw new Error('Ana ürün (keepId) bulunamadı');

      const removes = await Product.findAll({
        where: { id: { [Op.in]: removeIds }, storeId: store.id },
        transaction: t,
      });
      if (removes.length !== removeIds.length) throw new Error('Bazı ürünler bulunamadı veya bu mağazaya ait değil');
      removeIds = removes.map((r) => r.id);

      // ---- Move variants (merge on SKU collision) ----
      const variants = await ProductVariant.findAll({ where: { productId: removeIds }, transaction: t });
      for (const v of variants) {
        const existing = await ProductVariant.findOne({
          where: { productId: keepId, sku: v.sku },
          transaction: t,
        });
        if (existing) {
          await existing.update({ quantity: (existing.quantity || 0) + (v.quantity || 0) }, { transaction: t });
          await v.destroy({ transaction: t });
        } else {
          await v.update({ productId: keepId }, { transaction: t });
        }
      }

      // ---- Move marketplace listings (drop conflicts on same platform) ----
      const listings = await ProductMarketplaceListing.findAll({ where: { productId: removeIds }, transaction: t });
      for (const l of listings) {
        const existing = await ProductMarketplaceListing.findOne({
          where: { productId: keepId, platform: l.platform },
          transaction: t,
        });
        if (existing) await l.destroy({ transaction: t });
        else await l.update({ productId: keepId }, { transaction: t });
      }

      // ---- Merge B2B settings ----
      const settings = await ProductB2bSetting.findAll({ where: { productId: removeIds, storeId: store.id }, transaction: t });
      for (const s of settings) {
        const existing = await ProductB2bSetting.findOne({ where: { productId: keepId, storeId: store.id }, transaction: t });
        if (existing) {
          if (s.isB2BEnabled && !existing.isB2BEnabled) await existing.update({ isB2BEnabled: true }, { transaction: t });
          if ((!existing.b2bDiscount || existing.b2bDiscount === 0) && s.b2bDiscount) await existing.update({ b2bDiscount: s.b2bDiscount }, { transaction: t });
          if (existing.b2bPrice == null && s.b2bPrice != null) await existing.update({ b2bPrice: s.b2bPrice }, { transaction: t });
          await s.destroy({ transaction: t });
        } else {
          await s.update({ productId: keepId }, { transaction: t });
        }
      }

      // ---- Repoint B2B requests ----
      const requests = await B2BRequest.findAll({ where: { productId: removeIds }, transaction: t });
      for (const r of requests) {
        const conflict = await B2BRequest.findOne({
          where: { productId: keepId, requesterStoreId: r.requesterStoreId, ownerStoreId: r.ownerStoreId },
          transaction: t,
        });
        if (conflict) await r.destroy({ transaction: t });
        else await r.update({ productId: keepId }, { transaction: t });
      }

      // ---- Repoint B2B listed products ----
      const listed = await B2BListedProduct.findAll({
        where: { [Op.or]: [{ productId: removeIds }, { originalProductId: removeIds }] },
        transaction: t,
      });
      for (const l of listed) {
        const patch: any = {};
        if (removeIds.includes(l.productId)) patch.productId = keepId;
        if (removeIds.includes(l.originalProductId)) patch.originalProductId = keepId;
        await l.update(patch, { transaction: t });
      }

      // ---- Repoint same-store B2B clones whose original was removed ----
      await Product.update(
        { originalProductId: keepId },
        { where: { storeId: store.id, originalProductId: { [Op.in]: removeIds } }, transaction: t },
      );

      // ---- Merge scalar/list fields on the keeper ----
      const merged: any = {
        images: union(keep.images, ...removes.map((r) => r.images)),
        marketplaces: union(keep.marketplaces, ...removes.map((r) => r.marketplaces)),
        tags: union(keep.tags, ...removes.map((r) => r.tags)),
        quantity: (keep.quantity || 0) + removes.reduce((sum, r) => sum + (r.quantity || 0), 0),
        marketplaceConfig: deepMerge(keep.marketplaceConfig, ...removes.map((r) => r.marketplaceConfig)),
      };
      const fillFields: (keyof Product)[] = ['title', 'description', 'priceTRY', 'priceUSD', 'gramWeight', 'milyem', 'effectiveMilyem', 'categoryId'];
      for (const field of fillFields) {
        const cur = (keep as any)[field];
        if (cur == null || cur === '') {
          const src = removes.find((r) => (r as any)[field] != null && (r as any)[field] !== '');
          if (src) merged[field] = (src as any)[field];
        }
      }
      if (!keep.isB2BEnabled && removes.some((r) => r.isB2BEnabled)) {
        merged.isB2BEnabled = true;
        if ((keep.b2bDiscount == null || keep.b2bDiscount === 0) && removes.some((r) => r.b2bDiscount)) {
          merged.b2bDiscount = removes.find((r) => r.b2bDiscount)?.b2bDiscount;
        }
        if (keep.b2bPrice == null && removes.some((r) => r.b2bPrice != null)) {
          merged.b2bPrice = removes.find((r) => r.b2bPrice != null)?.b2bPrice;
        }
      }

      await keep.update(merged, { transaction: t });

      // ---- Destroy removed products ----
      await Product.destroy({ where: { id: removeIds }, transaction: t });

      return {
        keepId: keep.id,
        sku: keep.sku,
        removed: removeIds.length,
        totalQuantity: merged.quantity,
        marketplaces: merged.marketplaces,
      };
    });

    logger.info(`Products merged into ${result.keepId} (${result.sku}): ${result.removed} removed by store ${store.id}`);
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Merge products error');
    res.status(500).json({ error: (error as Error).message || 'Internal server error' });
  }
});
