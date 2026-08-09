import { Request, Response, NextFunction } from 'express';
import { Plan } from '../../models/Plan.model.js';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';

export const MODULE_DEFINITIONS: Record<string, { label: string }> = {
  b2b: { label: 'B2B / Beatby' },
  marketplace: { label: 'Pazaryeri Entegrasyonu' },
  ai_product_create: { label: 'AI Ürün Oluşturma' },
  ai_image_generate: { label: 'AI Görsel Üretme' },
  xml_feed: { label: 'XML Feed' },
  variations: { label: 'Varyasyonlar' },
  blog: { label: 'Blog' },
  custom_domain: { label: 'Özel Domain' },
  shipping: { label: 'Kargo Yönetimi' },
  static_pages: { label: 'Statik Sayfalar' },
};

export type ModuleKey = keyof typeof MODULE_DEFINITIONS;

export type ModuleSetting = { enabled: boolean; credit_cost?: number; limit?: number };

function normalizeModuleValue(value: unknown): ModuleSetting | null {
  if (value === true) return { enabled: true };
  if (value === false) return { enabled: false };
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return {
      enabled: v.enabled === true,
      credit_cost: typeof v.credit_cost === 'number' ? v.credit_cost : undefined,
      limit: typeof v.limit === 'number' ? v.limit : undefined,
    };
  }
  return null;
}

function getModuleSettings(plan: Plan | null, key: ModuleKey): ModuleSetting | null {
  if (!plan) return null;
  const modules = (plan.modules as Record<string, unknown> | null) || {};
  if (!(key in modules)) return null;
  return normalizeModuleValue(modules[key]);
}

export async function getPlanForStore(store: Store): Promise<Plan | null> {
  if (!store.planId) return null;
  try {
    return await Plan.findByPk(store.planId);
  } catch {
    return null;
  }
}

export function isModuleEnabled(plan: Plan | null, key: ModuleKey): boolean {
  const mod = getModuleSettings(plan, key);
  // Selected-modules-only: a module is enabled only when it is explicitly
  // listed in the plan (enabled: true). Unlisted modules are disabled so
  // plans actually behave according to what the super admin configured.
  if (!mod) return false;
  return mod.enabled;
}

export function getModuleLimit(plan: Plan | null, key: ModuleKey): number | null {
  return getModuleSettings(plan, key)?.limit ?? null;
}

export function getModuleCreditCost(plan: Plan | null, key: ModuleKey): number | null {
  return getModuleSettings(plan, key)?.credit_cost ?? null;
}

export function requireModule(key: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      if (user?.role === 'superadmin') return next();
      const store = (req as any).store;
      if (!store) return next();
      const plan = await getPlanForStore(store);
      if (isModuleEnabled(plan, key)) return next();
      res.status(403).json({
        error: 'PLAN_MODULE_DISABLED',
        module: key,
        message: `${MODULE_DEFINITIONS[key]?.label || key} modülü planınızda kapalı`,
      });
    } catch (err) {
      next(err);
    }
  };
}

export async function countProductsForStore(storeId: number): Promise<number> {
  return Product.count({ where: { storeId } });
}

export async function getProductQuotaStatus(storeId: number): Promise<{ ok: boolean; limit: number | null; current: number }> {
  const store = await Store.findByPk(storeId);
  if (!store) return { ok: true, limit: null, current: 0 };
  const plan = await getPlanForStore(store);
  if (!plan) return { ok: true, limit: null, current: 0 };
  const limit = Number((plan as any).productLimit ?? plan.productLimit ?? 0);
  if (limit < 0) return { ok: true, limit, current: 0 };
  const current = await countProductsForStore(storeId);
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true, limit, current };
}

export async function assertProductQuota(store: Store): Promise<{ ok: true } | { ok: false; limit: number; current: number }> {
  const plan = await getPlanForStore(store);
  if (!plan) return { ok: true };
  const limit = Number((plan as any).productLimit ?? plan.productLimit ?? 0);
  if (limit < 0) return { ok: true };
  const current = await countProductsForStore(store.id);
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true };
}

export async function assertMarketplaceQuota(store: Store): Promise<{ ok: true } | { ok: false; limit: number; current: number }> {
  const plan = await getPlanForStore(store);
  if (!plan) return { ok: true };
  const limit = getModuleLimit(plan, 'marketplace');
  if (!limit || limit <= 0) return { ok: true }; // limit unset → allow
  const current = await MarketplaceIntegration.count({ where: { storeId: store.id, isActive: true } });
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true };
}
