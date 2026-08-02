import { Plan } from '../models/Plan.model.js';
import { Subscription } from '../models/Subscription.model.js';

export interface SubscriptionPublic {
  id: number;
  store_id: number;
  plan_id: number;
  stripe_id: string | null;
  stripe_status: string | null;
  payment_method: string;
  quantity: number;
  trial_ends_at: string | null;
  ends_at: string | null;
  renews_at: string | null;
  status: string;
  plan?: PlanPublic | null;
}

export function serializeSubscription(sub: Subscription): SubscriptionPublic {
  const s = sub as any;
  return {
    id: Number(s.id),
    store_id: Number(s.storeId ?? s.store_id),
    plan_id: Number(s.planId ?? s.plan_id),
    stripe_id: s.stripeSubscriptionId ?? s.stripe_id ?? null,
    stripe_status: s.status ?? null,
    payment_method: s.paymentMethod ?? s.payment_method ?? '',
    quantity: s.quantity ?? 1,
    trial_ends_at: s.trialEndsAt ? new Date(s.trialEndsAt).toISOString() : null,
    ends_at: s.canceledAt ? new Date(s.canceledAt).toISOString() : null,
    renews_at: s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toISOString() : null,
    status: s.status ?? 'inactive',
    plan: s.plan ? serializePlan(s.plan) : null,
  };
}

export interface PlanPublic {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  ai_credits: number;
  product_limit: number;
  store_limit: number;
  modules: Record<string, { enabled: boolean; credit_cost?: number; limit?: number }> | null;
  hosting: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function serializePlan(plan: Plan): PlanPublic {
  const p = plan as any;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug ?? '',
    description: p.description ?? null,
    price: Number(p.price ?? 0),
    currency: p.currency ?? 'TRY',
    ai_credits: p.aiCredits ?? p.ai_credits ?? 0,
    product_limit: p.productLimit ?? p.product_limit ?? 0,
    store_limit: p.storeLimit ?? p.store_limit ?? 1,
    modules: p.modules ?? null,
    hosting: p.hosting ?? 'rahatio',
    is_active: p.isActive ?? p.is_active ?? true,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : '',
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
  };
}

export function serializePlans(plans: Plan[]): PlanPublic[] {
  return plans.map(serializePlan);
}
