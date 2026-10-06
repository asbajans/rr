import { Product } from '../../models/Product.model.js';
import { ProductVariant } from '../../models/ProductVariant.model.js';
import { logger } from '../../utils/logger.js';

export type VariantAttributeMap = Record<string, string[]>;

/** Max auto-generated combinations per product (protects against cartesian explosion). */
const MAX_COMBOS = 200;

function slugPart(value: string): string {
  const tr: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  const mapped = value.split('').map((ch) => tr[ch] ?? ch).join('');
  const slug = mapped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'opt';
}

export function buildVariantSku(baseSku: string, combo: Record<string, string>): string {
  const suffix = Object.values(combo).map(slugPart).filter(Boolean).join('-');
  return `${baseSku}-${suffix}`.slice(0, 100);
}

export function comboKey(combo: Record<string, string>): string {
  return JSON.stringify(Object.keys(combo).sort().map((k) => [k, combo[k]]));
}

/** Sanitizes raw input into { name: [unique non-empty values] }. */
export function cleanVariantAttributes(input: unknown): VariantAttributeMap {
  const clean: VariantAttributeMap = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return clean;
  for (const [rawName, rawValues] of Object.entries(input as Record<string, unknown>)) {
    const name = String(rawName).trim();
    if (!name) continue;
    const values = Array.isArray(rawValues) ? rawValues : [];
    const uniq = [...new Set(
      values.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
    )];
    if (uniq.length > 0) clean[name] = uniq.slice(0, 50);
  }
  return clean;
}

function cartesian(names: string[], clean: VariantAttributeMap): Array<Record<string, string>> {
  let combos: Array<Record<string, string>> = [{}];
  for (const name of names) {
    const next: Array<Record<string, string>> = [];
    for (const combo of combos) {
      for (const value of clean[name]) {
        next.push({ ...combo, [name]: value });
        if (next.length >= MAX_COMBOS) return next;
      }
    }
    combos = next;
  }
  return combos;
}

/**
 * Reconciles ProductVariant rows with the given attribute map.
 * - Creates missing combinations (inherits parent price/stock).
 * - Deletes stale combinations no longer selected.
 * - Preserves existing rows (manual per-variant stock/price edits survive).
 * - Empty map clears all variants and resets hasVariants.
 */
export async function syncProductVariants(
  product: Product,
  input: unknown,
  transaction?: any
): Promise<VariantAttributeMap> {
  const clean = cleanVariantAttributes(input);
  const names = Object.keys(clean);
  const opts = transaction ? { transaction } : undefined;

  if (names.length === 0) {
    await ProductVariant.destroy({ where: { productId: product.id }, ...(opts as object) });
    if (product.hasVariants !== false || JSON.stringify(product.variantAttributes || {}) !== '{}') {
      await product.update({ hasVariants: false, variantAttributes: {} }, transaction ? { transaction } : undefined);
    }
    return {};
  }

  const combos = cartesian(names, clean);
  const wantedKeys = new Set(combos.map(comboKey));
  const existing = await ProductVariant.findAll({
    where: { productId: product.id },
    ...(opts as object),
  });
  const existingByKey = new Map(existing.map((v) => [comboKey((v.attributes as any) || {}), v]));

  for (const variant of existing) {
    if (!wantedKeys.has(comboKey((variant.attributes as any) || {}))) {
      await variant.destroy(opts as any);
    }
  }

  for (const combo of combos) {
    if (existingByKey.has(comboKey(combo))) continue;
    try {
      await ProductVariant.create({
        productId: product.id,
        storeId: product.storeId,
        sku: buildVariantSku(product.sku, combo),
        attributes: combo,
        quantity: product.quantity ?? 0,
        priceTRY: product.priceTRY ?? null,
        priceUSD: product.priceUSD ?? null,
        isActive: true,
      }, opts as any);
    } catch (err) {
      logger.warn({ err, productId: product.id, combo }, 'Failed to auto-create product variant');
    }
  }

  await product.update(
    { hasVariants: true, variantAttributes: clean },
    transaction ? { transaction } : undefined
  );
  return clean;
}
