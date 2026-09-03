import { Request, Response, NextFunction } from 'express';
import { Plan } from '../../models/Plan.model.js';
import { Store } from '../../models/Store.model.js';
import { Product } from '../../models/Product.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';

export const MODULE_DEFINITIONS: Record<string, { label: string; description?: string }> = {
  b2b: { label: 'B2B / Beatby (Eski - uyumluluk)', description: 'Geriye dönük uyumluluk için. Yeni planlarda b2b_request / b2b_supply kullanın.' },
  b2b_request: { label: 'B2B Talep Etme (Ürün İsteme)', description: 'B2B keşfet, talep oluşturma ve klonlama. Diğer satıcıların B2B’ye açtığı ürünleri talep edebilir.' },
  b2b_supply: { label: 'B2B Tedarik Etme (Ürün Gönderme)', description: 'Kendi ürünlerini B2B’ye açma. Onaylı tedarikçi başvurusu gerekir.' },
  marketplace: { label: 'Pazaryeri Entegrasyonu', description: 'Trendyol, Hepsiburada, Pazarama, N11, Amazon, Etsy gibi dış pazaryerleri. Kendi Siteniz bu limite dahil değildir.' },
  ai_product_create: { label: 'AI Ürün Oluşturma' },
  ai_image_generate: { label: 'AI Görsel Üretme' },
  xml_feed: { label: 'XML Feed' },
  variations: { label: 'Varyasyonlar' },
  blog: { label: 'Blog' },
  blog_generation: { label: 'AI Blog Üretimi' },
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
  // If plan has no modules object at all, treat as fully open (legacy plans / default open)
  if (!plan || !plan.modules || Object.keys(plan.modules as object).length === 0) return true;
  const mod = getModuleSettings(plan, key);
  if (mod) return mod.enabled;
  // Legacy fallback: old plans only have 'b2b' key → treat as both request/supply
  if ((key === 'b2b_request' || key === 'b2b_supply') && plan.modules) {
    const legacy = getModuleSettings(plan, 'b2b' as ModuleKey);
    if (legacy) return legacy.enabled;
  }
  // Selected-modules-only: unlisted modules are disabled only when plan explicitly lists some modules
  return false;
}

export function isB2BRequestEnabled(plan: Plan | null): boolean {
  return isModuleEnabled(plan, 'b2b_request' as ModuleKey) || isModuleEnabled(plan, 'b2b' as ModuleKey);
}

export function isB2BSupplyEnabled(plan: Plan | null): boolean {
  return isModuleEnabled(plan, 'b2b_supply' as ModuleKey) || isModuleEnabled(plan, 'b2b' as ModuleKey);
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
  const raw = Number((plan as any).productLimit ?? plan.productLimit ?? 0);
  // Unlimited (-1) removed: treat <=0 as 0 limit (misconfigured → exhausted if any product exists)
  const limit = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const current = await countProductsForStore(storeId);
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true, limit, current };
}

export async function assertProductQuota(store: Store): Promise<{ ok: true } | { ok: false; limit: number; current: number }> {
  const plan = await getPlanForStore(store);
  if (!plan) return { ok: true };
  const raw = Number((plan as any).productLimit ?? plan.productLimit ?? 0);
  const limit = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const current = await countProductsForStore(store.id);
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true };
}

export async function assertMarketplaceQuota(store: Store): Promise<{ ok: true } | { ok: false; limit: number; current: number }> {
  const plan = await getPlanForStore(store);
  if (!plan) return { ok: true };
  // Marketplace modülü kapalıysa limit kontrolü yapma — requireModule zaten engeller
  if (!isModuleEnabled(plan, 'marketplace')) return { ok: true };
  let limit = getModuleLimit(plan, 'marketplace');
  // Limit tanımlı değilse varsayılan 1 kabul et (UI ile tutarlılık, aksi halde sınırsız gibi davranır)
  if (limit == null) limit = 1;
  if (limit <= 0) return { ok: true }; // 0 = sınırsız gibi (özel durum)
  // Kendi Sitem (storefront) bu sayıya dahil değildir — sadece dış pazaryeri entegrasyonları sayılır
  const current = await MarketplaceIntegration.count({ where: { storeId: store.id, isActive: true } });
  if (current >= limit) return { ok: false, limit, current };
  return { ok: true };
}

export async function assertSupplierApproved(store: Store): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { Supplier } = await import('../../models/Supplier.model.js');
  const supplier = await Supplier.findOne({ where: { storeId: store.id } });
  if (!supplier) return { ok: false, reason: 'SUPPLIER_NOT_APPLIED' };
  if (supplier.applicationStatus !== 'approved' || supplier.contractStatus !== 'active') {
    return { ok: false, reason: supplier.applicationStatus === 'rejected' ? 'SUPPLIER_REJECTED' : 'SUPPLIER_NOT_APPROVED' };
  }
  return { ok: true };
}
