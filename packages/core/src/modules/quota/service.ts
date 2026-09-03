import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { Plan } from '../../models/Plan.model.js';
import { getPlanForStore, countProductsForStore } from '../plan/access.js';
import { createStoreNotification, sendPushToStore } from '../notification/service.js';
import { StoreNotification } from '../../models/StoreNotification.model.js';
import { logger } from '../../utils/logger.js';
import { Op } from 'sequelize';

export type QuotaSeverity = 'ok' | 'warning' | 'critical' | 'exhausted';
export type QuotaKind = 'product' | 'credits';

export interface ProductQuotaStatus {
  kind: 'product';
  current: number;
  limit: number;
  percentUsed: number; // 0-100+
  remaining: number;
  severity: QuotaSeverity;
}

export interface CreditsQuotaStatus {
  kind: 'credits';
  remaining: number;
  allowance: number; // plan.aiCredits per month
  percentRemaining: number; // 0-100
  percentUsed: number;
  severity: QuotaSeverity;
}

export interface QuotaStatusResponse {
  product: ProductQuotaStatus;
  credits: CreditsQuotaStatus;
  nextPlan?: { id: number; name: string; productLimit: number; aiCredits: number; price: number } | null;
}

// Thresholds: product percentUsed, credits percentRemaining
const PRODUCT_WARNING = 80;
const PRODUCT_CRITICAL = 90;
const CREDITS_WARNING_REMAIN = 20; // <=20% remaining => warning
const CREDITS_CRITICAL_REMAIN = 10; // <=10% remaining => critical

function productSeverity(percentUsed: number, remaining: number): QuotaSeverity {
  if (remaining <= 0 || percentUsed >= 100) return 'exhausted';
  if (percentUsed >= PRODUCT_CRITICAL) return 'critical';
  if (percentUsed >= PRODUCT_WARNING) return 'warning';
  return 'ok';
}

function creditsSeverity(percentRemaining: number, remaining: number): QuotaSeverity {
  if (remaining <= 0) return 'exhausted';
  if (percentRemaining <= CREDITS_CRITICAL_REMAIN) return 'critical';
  if (percentRemaining <= CREDITS_WARNING_REMAIN) return 'warning';
  return 'ok';
}

export async function getProductQuotaStatusDetailed(storeId: number): Promise<ProductQuotaStatus> {
  const store = await Store.findByPk(storeId);
  if (!store) {
    return { kind: 'product', current: 0, limit: 0, percentUsed: 0, remaining: 0, severity: 'ok' };
  }
  const plan = await getPlanForStore(store);
  // Unlimited removed: every plan has finite limit. Fallback 0 => treat as exhausted to force upgrade path
  const rawLimit = plan ? Number((plan as any).productLimit ?? 0) : 0;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 0;
  const current = await countProductsForStore(storeId);
  // Guard limit <=0 means misconfigured -> treat as 0 limit (exhausted if any product exists, else ok with 0)
  if (limit <= 0) {
    return {
      kind: 'product',
      current,
      limit: 0,
      percentUsed: current > 0 ? 100 : 0,
      remaining: Math.max(0, limit - current),
      severity: current > 0 ? 'exhausted' : 'ok',
    };
  }
  const percentUsed = Math.round((current / limit) * 100);
  const remaining = Math.max(0, limit - current);
  return {
    kind: 'product',
    current,
    limit,
    percentUsed,
    remaining,
    severity: productSeverity(percentUsed, remaining),
  };
}

export async function getCreditsQuotaStatusDetailed(userId: number, storeId: number): Promise<CreditsQuotaStatus> {
  const [user, store] = await Promise.all([User.findByPk(userId), Store.findByPk(storeId)]);
  const remaining = Math.max(0, Number(user?.aiCredits ?? 0));
  const plan = store ? await getPlanForStore(store) : null;
  const allowanceRaw = plan ? Number((plan as any).aiCredits ?? 0) : 0;
  const allowance = Number.isFinite(allowanceRaw) ? Math.max(0, allowanceRaw) : 0;
  // If allowance is 0 (e.g. free plan with 0), percentRemaining based on remaining alone: 0 -> exhausted, else ok until thresholds
  let percentRemaining: number;
  let percentUsed: number;
  if (allowance > 0) {
    percentRemaining = Math.round((remaining / allowance) * 100);
    percentUsed = 100 - percentRemaining;
  } else {
    // No allowance (edge): treat remaining==0 as exhausted, remaining<=5 as critical, <=10 as warning
    if (remaining <= 0) percentRemaining = 0;
    else if (remaining <= 5) percentRemaining = 5;
    else if (remaining <= 10) percentRemaining = 15;
    else percentRemaining = 100;
    percentUsed = remaining <= 0 ? 100 : 0;
  }
  return {
    kind: 'credits',
    remaining,
    allowance,
    percentRemaining: Math.min(100, Math.max(0, percentRemaining)),
    percentUsed: Math.min(100, Math.max(0, percentUsed)),
    severity: creditsSeverity(percentRemaining, remaining),
  };
}

export async function getQuotaStatus(userId: number, storeId: number): Promise<QuotaStatusResponse> {
  const [product, credits] = await Promise.all([
    getProductQuotaStatusDetailed(storeId),
    getCreditsQuotaStatusDetailed(userId, storeId),
  ]);
  let nextPlan = null;
  try {
    if (product.severity !== 'ok' || credits.severity !== 'ok') {
      const store = await Store.findByPk(storeId);
      const plan = store ? await getPlanForStore(store) : null;
      if (plan) {
        const candidates = await Plan.findAll({ where: { isActive: true }, order: [['price', 'ASC']] });
        // Find next higher plan that increases either limit
        const sorted = candidates.sort((a, b) => Number(a.price) - Number(b.price));
        const idx = sorted.findIndex(p => p.id === plan.id);
        for (let i = idx + 1; i < sorted.length; i++) {
          const cand = sorted[i] as any;
          if (Number(cand.productLimit) > product.limit || Number(cand.aiCredits) > credits.allowance) {
            nextPlan = { id: Number(cand.id), name: String(cand.name), productLimit: Number(cand.productLimit), aiCredits: Number(cand.aiCredits), price: Number(cand.price) };
            break;
          }
        }
        // Fallback: highest plan
        if (!nextPlan && sorted.length > 0) {
          const top = sorted[sorted.length - 1] as any;
          if (top.id !== plan.id) nextPlan = { id: Number(top.id), name: String(top.name), productLimit: Number(top.productLimit), aiCredits: Number(top.aiCredits), price: Number(top.price) };
        }
      }
    }
  } catch { /* ignore */ }
  return { product, credits, nextPlan };
}

// ---- Notification throttle + creation ----

const NOTIF_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours per severity/kind

async function shouldCreateNotification(storeId: number, kind: QuotaKind, severity: QuotaSeverity): Promise<boolean> {
  if (severity === 'ok') return false;
  const type = `quota_${kind}_${severity}`; // e.g. quota_product_warning
  const since = new Date(Date.now() - NOTIF_COOLDOWN_MS);
  const recent = await StoreNotification.findOne({
    where: { storeId, type, createdAt: { [Op.gte]: since } as any },
    order: [['createdAt', 'DESC']],
  });
  return !recent;
}

function quotaNotificationContent(kind: QuotaKind, severity: QuotaSeverity, product: ProductQuotaStatus, credits: CreditsQuotaStatus) {
  if (kind === 'product') {
    if (severity === 'exhausted') {
      return {
        title: 'Ürün limitiniz doldu',
        body: `Mağazanızdaki ürün sayısı limitinize ulaştı (${product.current}/${product.limit}). Yeni ürün ekleyemezsiniz. Planınızı yükseltin.`,
        data: { kind, severity, current: product.current, limit: product.limit, percentUsed: product.percentUsed, cta: 'upgrade_plan' },
      };
    }
    if (severity === 'critical') {
      return {
        title: 'Ürün limitiniz dolmak üzere',
        body: `Ürün limitinizin %${product.percentUsed}’ini doldurdunuz (${product.current}/${product.limit}). Yakında yeni ürün ekleyemezsiniz.`,
        data: { kind, severity, current: product.current, limit: product.limit, percentUsed: product.percentUsed, cta: 'upgrade_plan' },
      };
    }
    return {
      title: 'Ürün limitinize yaklaşıyorsunuz',
      body: `Ürün limitinizin %${product.percentUsed}’ini doldurdunuz (${product.current}/${product.limit}). Planınızı gözden geçirin.`,
      data: { kind, severity, current: product.current, limit: product.limit, percentUsed: product.percentUsed, cta: 'upgrade_plan' },
    };
  } else {
    if (severity === 'exhausted') {
      return {
        title: 'AI krediniz bitti',
        body: `AI krediniz tükendi (${credits.remaining}/${credits.allowance}). AI ile ürün açıklaması, görsel düzenleme ve blog üretimi durdu. Kredi alın veya üst pakete geçin.`,
        data: { kind, severity, remaining: credits.remaining, allowance: credits.allowance, percentRemaining: credits.percentRemaining, cta: 'buy_credits' },
      };
    }
    if (severity === 'critical') {
      return {
        title: 'AI krediniz kritik seviyede',
        body: `AI krediniz azaldı: ${credits.remaining} kaldı (%${credits.percentRemaining}). Yakında AI özellikleri duracak.`,
        data: { kind, severity, remaining: credits.remaining, allowance: credits.allowance, percentRemaining: credits.percentRemaining, cta: 'buy_credits' },
      };
    }
    return {
      title: 'AI krediniz azalıyor',
      body: `AI kredinizin %${100 - credits.percentRemaining}’ini kullandınız. Kalan: ${credits.remaining}/${credits.allowance}.`,
      data: { kind, severity, remaining: credits.remaining, allowance: credits.allowance, percentRemaining: credits.percentRemaining, cta: 'buy_credits' },
    };
  }
}

export async function checkAndNotifyQuota(storeId: number, userId?: number | null): Promise<void> {
  try {
    const product = await getProductQuotaStatusDetailed(storeId);
    let credits: CreditsQuotaStatus | null = null;
    if (userId) {
      credits = await getCreditsQuotaStatusDetailed(userId, storeId);
    } else {
      // Fallback: pick owner for credits
      const owner = await User.findOne({ where: { storeId, role: 'owner' as any } });
      if (owner) credits = await getCreditsQuotaStatusDetailed(owner.id, storeId);
    }
    // Product notifications
    if (product.severity !== 'ok' && await shouldCreateNotification(storeId, 'product', product.severity)) {
      const content = quotaNotificationContent('product', product.severity, product, credits || { remaining: 0, allowance: 0, percentRemaining: 0, percentUsed: 100, kind: 'credits', severity: 'ok' } as any);
      const notif = await createStoreNotification({ storeId, userId: userId || null, type: `quota_product_${product.severity}`, title: content.title, body: content.body, data: content.data as any });
      if (notif) await sendPushToStore(storeId, content.title, content.body, { ...content.data } as any);
      logger.info({ storeId, severity: product.severity }, 'Quota product notification created');
    }
    // Credits notifications
    if (credits && credits.severity !== 'ok' && await shouldCreateNotification(storeId, 'credits', credits.severity)) {
      const content = quotaNotificationContent('credits', credits.severity, product, credits);
      const notif = await createStoreNotification({ storeId, userId: userId || null, type: `quota_credits_${credits.severity}`, title: content.title, body: content.body, data: content.data as any });
      if (notif) await sendPushToStore(storeId, content.title, content.body, { ...content.data } as any);
      logger.info({ storeId, severity: credits.severity }, 'Quota credits notification created');
    }
  } catch (err) {
    logger.warn({ err, storeId }, 'checkAndNotifyQuota failed (non-fatal)');
  }
}
