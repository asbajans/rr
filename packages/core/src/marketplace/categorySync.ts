import { Category } from '../models/Category.model.js';
import { Op } from 'sequelize';
import { logger } from '../utils/logger.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 190);
}

interface FlatCategory {
  id: number;
  name: string;
  parentId?: number;
}

function flattenTree(nodes: any[], parentId: number = 0): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const n of nodes) {
    const id = n.id ?? 0;
    result.push({ id, name: n.name ?? '', parentId });
    const kids = n.subCategories;
    if (Array.isArray(kids) && kids.length > 0) {
      result.push(...flattenTree(kids, id));
    }
  }
  return result;
}

/**
 * Fetch marketplace categories via the client, upsert into local categories table.
 * Returns a Map<marketplaceCategoryId, localCategoryId> for quick lookup.
 */
export async function syncMarketplaceCategories(
  marketplace: string,
  storeId: number,
  fetchFn: () => Promise<any[]>,
): Promise<Map<string, number>> {
  const rawCategories = await fetchFn();
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return new Map();
  }

  const flat = flattenTree(rawCategories);
  if (flat.length === 0) return new Map();

  const idMap = new Map<string, number>();
  const parentMap = new Map<string, string>();

  for (const fc of flat) {
    const mpCatId = String(fc.id);
    const slugBase = `${slugify(fc.name)}-${mpCatId}`;
    // prevent duplicates: find existing by marketplaceCategoryId, else by slug
    let cat = await Category.findOne({ where: { storeId, source: marketplace, marketplaceCategoryId: mpCatId } });
    if (cat) {
      await cat.update({ name: { tr: fc.name, en: fc.name }, slug: slugBase, isActive: true } as any);
    } else {
      // also check slug collision from old upsert duplicates
      const bySlug = await Category.findOne({ where: { storeId, slug: slugBase } });
      if (bySlug && (bySlug as any).source === marketplace && (bySlug as any).marketplaceCategoryId === mpCatId) {
        cat = bySlug;
        await cat.update({ name: { tr: fc.name, en: fc.name }, isActive: true } as any);
      } else {
        let slug = slugBase;
        let suf = 1;
        while (await Category.findOne({ where: { storeId, slug } })) slug = `${slugBase}-${suf++}`;
        cat = await Category.create({
          storeId,
          source: marketplace,
          marketplaceCategoryId: mpCatId,
          name: { tr: fc.name, en: fc.name },
          slug,
          isActive: true,
          sortOrder: 0,
          parentId: null,
        } as any);
      }
    }

    idMap.set(mpCatId, (cat as any).id);
    if (fc.parentId && fc.parentId > 0) {
      parentMap.set(mpCatId, String(fc.parentId));
    }
  }

  // Set parent relationships
  for (const [childMpId, parentMpId] of parentMap) {
    const childId = idMap.get(childMpId);
    const parentId = idMap.get(parentMpId);
    if (childId && parentId) {
      await Category.update({ parentId }, { where: { id: childId } });
    }
  }

  logger.info({ marketplace, storeId, count: flat.length }, 'Marketplace categories synced');
  return idMap;
}
