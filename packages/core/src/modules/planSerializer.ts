import { Plan } from '../models/Plan.model.js';

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
    is_active: p.isActive ?? p.is_active ?? true,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : '',
    updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : '',
  };
}

export function serializePlans(plans: Plan[]): PlanPublic[] {
  return plans.map(serializePlan);
}
