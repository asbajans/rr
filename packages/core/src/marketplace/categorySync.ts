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
    const slug = `${slugify(fc.name)}-${mpCatId}`;

    const [cat] = await Category.upsert({
      storeId,
      source: marketplace,
      marketplaceCategoryId: mpCatId,
      name: { tr: fc.name, en: fc.name },
      slug,
      isActive: true,
      sortOrder: 0,
    } as any);

    idMap.set(mpCatId, cat.id);
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
