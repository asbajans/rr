import { MarketplaceIntegration } from '../models/MarketplaceIntegration.model.js';
import { MarketplaceGlobalCategory, MarketplaceGlobalBrand, MarketplaceGlobalCategoryAttribute } from '../models/MarketplaceGlobalCatalog.model.js';
import { createMarketplaceClient, getMarketplaceConfig } from './clients/index.js';
import type { MarketplaceType } from './clients/index.js';
import { logger } from '../utils/logger.js';
import { Op } from 'sequelize';

const MARKETPLACES: MarketplaceType[] = ['trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy'];

function flattenCategories(nodes: any[], parentId: string | null = null, level = 0, pathPrefix = ''): Array<{ id: string; name: string; parentId: string | null; level: number; path: string; raw: any }> {
  const out: Array<{ id: string; name: string; parentId: string | null; level: number; path: string; raw: any }> = [];
  for (const n of nodes) {
    const id = String(n.id ?? n.marketplace_category_id ?? n.categoryId ?? n.category_id ?? n.marketplaceCategoryId ?? '');
    if (!id) continue;
    const name = String(n.name ?? n.title ?? '');
    const path = pathPrefix ? `${pathPrefix} > ${name}` : name;
    out.push({ id, name, parentId, level, path, raw: n });
    const kids = n.children ?? n.subCategories ?? n.sub_categories ?? n.categoryList ?? [];
    if (Array.isArray(kids) && kids.length) {
      out.push(...flattenCategories(kids, id, level + 1, path));
    }
  }
  return out;
}

/**
 * Try to fetch marketplace categories/brands using the first successful active integration.
 * Iterates over all active integrations for the marketplace, ordered by most recent.
 */
async function tryWithActiveIntegrations<T>(marketplace: MarketplaceType, fn: (client: any, integration: MarketplaceIntegration) => Promise<T>): Promise<{ result: T; sourceStoreId: number } | null> {
  const integrations = await MarketplaceIntegration.findAll({
    where: { marketplace, isActive: true },
    order: [['updatedAt', 'DESC']],
  });
  for (const integ of integrations) {
    try {
      const cfg = getMarketplaceConfig(marketplace, integ as any);
      const client = createMarketplaceClient(marketplace, cfg);
      const result = await fn(client as any, integ);
      if (result != null) return { result, sourceStoreId: integ.storeId };
    } catch (err: any) {
      logger.warn({ err: err.message, marketplace, storeId: integ.storeId }, 'Global catalog fetch failed for this integration, trying next');
      continue;
    }
  }
  return null;
}

export async function syncGlobalCategories(marketplace: MarketplaceType): Promise<{ synced: number; sourceStoreId: number | null }> {
  const fetched = await tryWithActiveIntegrations(marketplace, async (client) => {
    if (typeof client.getCategories !== 'function') throw new Error('getCategories not supported');
    return await client.getCategories();
  });
  if (!fetched) {
    logger.warn({ marketplace }, 'No active integration succeeded for global category sync');
    return { synced: 0, sourceStoreId: null };
  }
  const rawList = fetched.result as any[];
  if (!Array.isArray(rawList) || rawList.length === 0) return { synced: 0, sourceStoreId: fetched.sourceStoreId };

  // Some clients return flat list with parentId, others nested tree — normalize via flatten
  let flat: ReturnType<typeof flattenCategories>;
  const isFlat = rawList.length > 0 && rawList[0] && typeof rawList[0].parentId !== 'undefined';
  if (isFlat) {
    flat = rawList.map((r: any) => ({
      id: String(r.id ?? r.marketplace_category_id),
      name: String(r.name ?? ''),
      parentId: r.parentId != null ? String(r.parentId) : null,
      level: Number(r.level ?? 0),
      path: String(r.path ?? r.name ?? ''),
      raw: r,
    }));
  } else {
    flat = flattenCategories(rawList);
  }

  let synced = 0;
  for (const cat of flat) {
    try {
      const [row, created] = await MarketplaceGlobalCategory.findOrCreate({
        where: { marketplace, marketplaceCategoryId: cat.id },
        defaults: {
          marketplace,
          marketplaceCategoryId: cat.id,
          name: cat.name,
          parentId: cat.parentId && cat.parentId !== '0' ? cat.parentId : null,
          level: cat.level,
          path: cat.path,
          raw: cat.raw,
          sourceStoreId: fetched.sourceStoreId,
        } as any,
      });
      if (!created) {
        await row.update({
          name: cat.name,
          parentId: cat.parentId && cat.parentId !== '0' ? cat.parentId : null,
          level: cat.level,
          path: cat.path,
          raw: cat.raw,
          sourceStoreId: fetched.sourceStoreId,
          version: (row as any).version + 1,
        } as any);
      }
      synced++;
    } catch (err: any) {
      logger.warn({ err: err.message, marketplace, catId: cat.id }, 'Failed to upsert global category');
    }
  }
  logger.info({ marketplace, synced, sourceStoreId: fetched.sourceStoreId }, 'Global categories synced');
  return { synced, sourceStoreId: fetched.sourceStoreId };
}

export async function syncGlobalBrands(marketplace: MarketplaceType): Promise<{ synced: number; sourceStoreId: number | null }> {
  const fetched = await tryWithActiveIntegrations(marketplace, async (client) => {
    if (typeof (client as any).getBrands !== 'function') throw new Error('getBrands not supported');
    return await (client as any).getBrands();
  });
  if (!fetched) {
    logger.warn({ marketplace }, 'No active integration succeeded for global brand sync');
    return { synced: 0, sourceStoreId: null };
  }
  const rawList = fetched.result as any[];
  if (!Array.isArray(rawList) || rawList.length === 0) return { synced: 0, sourceStoreId: fetched.sourceStoreId };

  let synced = 0;
  for (const b of rawList) {
    const bid = String(b.id ?? b.marketplaceBrandId ?? b.marketplace_brand_id ?? b.brandId ?? '');
    const name = String(b.name ?? b.title ?? '').trim();
    if (!bid || !name) continue;
    try {
      const [row, created] = await MarketplaceGlobalBrand.findOrCreate({
        where: { marketplace, marketplaceBrandId: bid },
        defaults: { marketplace, marketplaceBrandId: bid, name, sourceStoreId: fetched.sourceStoreId } as any,
      });
      if (!created && row.name !== name) {
        await row.update({ name, sourceStoreId: fetched.sourceStoreId } as any);
      }
      synced++;
    } catch (err: any) {
      logger.warn({ err: err.message, marketplace, brandId: bid }, 'Failed to upsert global brand');
    }
  }
  logger.info({ marketplace, synced, sourceStoreId: fetched.sourceStoreId }, 'Global brands synced');
  return { synced, sourceStoreId: fetched.sourceStoreId };
}

export async function syncGlobalCategoryAttributes(marketplace: MarketplaceType, marketplaceCategoryId: string): Promise<{ synced: boolean; sourceStoreId: number | null }> {
  const fetched = await tryWithActiveIntegrations(marketplace, async (client) => {
    if (typeof (client as any).getCategoryAttributes !== 'function') throw new Error('getCategoryAttributes not supported');
    return await (client as any).getCategoryAttributes(marketplaceCategoryId);
  });
  if (!fetched) return { synced: false, sourceStoreId: null };
  const attrs = fetched.result as any;
  if (!attrs) return { synced: false, sourceStoreId: fetched.sourceStoreId };
  const arr = Array.isArray(attrs) ? attrs : [attrs];
  try {
    const [row, created] = await MarketplaceGlobalCategoryAttribute.findOrCreate({
      where: { marketplace, marketplaceCategoryId: String(marketplaceCategoryId) },
      defaults: { marketplace, marketplaceCategoryId: String(marketplaceCategoryId), attributes: arr as any, sourceStoreId: fetched.sourceStoreId } as any,
    });
    if (!created) {
      await row.update({ attributes: arr as any, sourceStoreId: fetched.sourceStoreId } as any);
    }
    logger.info({ marketplace, marketplaceCategoryId, sourceStoreId: fetched.sourceStoreId }, 'Global category attributes synced');
    return { synced: true, sourceStoreId: fetched.sourceStoreId };
  } catch (err: any) {
    logger.warn({ err: err.message, marketplace, marketplaceCategoryId }, 'Failed to upsert global category attributes');
    return { synced: false, sourceStoreId: fetched.sourceStoreId };
  }
}

export async function getGlobalCategories(marketplace: MarketplaceType): Promise<MarketplaceGlobalCategory[]> {
  return MarketplaceGlobalCategory.findAll({ where: { marketplace }, order: [['level', 'ASC'], ['name', 'ASC']] });
}

export async function getGlobalBrands(marketplace: MarketplaceType, opts?: { search?: string; limit?: number }): Promise<MarketplaceGlobalBrand[]> {
  const where: any = { marketplace };
  if (opts?.search) where.name = { [Op.iLike]: `%${opts.search}%` };
  return MarketplaceGlobalBrand.findAll({ where, order: [['name', 'ASC']], limit: opts?.limit ? Math.min(opts.limit, 2000) : undefined });
}

export async function getGlobalCategoryAttributes(marketplace: MarketplaceType, marketplaceCategoryId: string): Promise<MarketplaceGlobalCategoryAttribute | null> {
  return MarketplaceGlobalCategoryAttribute.findOne({ where: { marketplace, marketplaceCategoryId: String(marketplaceCategoryId) } });
}

export async function syncAllGlobalCatalogs(): Promise<Record<string, { categories: number; brands: number }>> {
  const result: Record<string, { categories: number; brands: number }> = {};
  for (const mp of MARKETPLACES) {
    try {
      const cat = await syncGlobalCategories(mp);
      const br = await syncGlobalBrands(mp);
      result[mp] = { categories: cat.synced, brands: br.synced };
    } catch (err: any) {
      logger.warn({ err: err.message, marketplace: mp }, 'syncAllGlobalCatalogs failed for marketplace');
      result[mp] = { categories: 0, brands: 0 };
    }
  }
  return result;
}

// Helper to ensure at least one sync has happened; used by marketplace integration activation
export async function ensureGlobalCatalogFor(marketplace: MarketplaceType): Promise<void> {
  const catCount = await MarketplaceGlobalCategory.count({ where: { marketplace } });
  const brandCount = await MarketplaceGlobalBrand.count({ where: { marketplace } });
  if (catCount === 0) await syncGlobalCategories(marketplace).catch(() => undefined);
  if (brandCount === 0) await syncGlobalBrands(marketplace).catch(() => undefined);
}
