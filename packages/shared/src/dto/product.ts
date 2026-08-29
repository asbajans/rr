/**
 * Canonical product create/update payload shared by web, mobile and core.
 * Backend contract fields: title / sku / priceTRY / quantity (AGENTOPEN.md Faz 0).
 */

import type { AiChannel } from './ai';

export type ProductPayload = {
  title: string;
  sku: string;
  categoryId?: number;
  description?: string;
  gramWeight?: number;
  milyem?: number;
  effectiveMilyem?: number;
  profitMargin?: number;
  priceMultiplier?: number;
  priceTRY?: number;
  priceUSD?: number;
  isB2BEnabled?: boolean;
  b2bDiscount?: number;
  b2bPrice?: number;
  discountRate?: number;
  discountedPrice?: number;
  quantity?: number;
  images?: string[];
  videoUrl?: string;
  marketplaces?: string[];
  marketplaceConfig?: Record<string, unknown>;
  hasVariants?: boolean;
  variantAttributes?: Record<string, unknown>;
  tags?: string[];
  isActive?: boolean;
};

export type Channel = AiChannel;

/** Channels that map to a real marketplace integration. */
export const MARKETPLACE_CHANNELS: Exclude<AiChannel, 'storefront'>[] = [
  'trendyol',
  'hepsiburada',
  'pazarama',
  'n11',
  'amazon',
  'etsy',
  'facebook',
  'instagram',
];

export const ALL_CHANNELS: AiChannel[] = [
  'storefront',
  'trendyol',
  'hepsiburada',
  'pazarama',
  'n11',
  'amazon',
  'etsy',
  'facebook',
  'instagram',
];
