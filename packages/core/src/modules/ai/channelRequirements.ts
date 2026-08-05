import type { AiChannel, ChannelValidationResult } from '@rahatio/shared';
import { AiProductDraft } from '../../models/AiProductDraft.model.js';
import { MarketplaceIntegration } from '../../models/MarketplaceIntegration.model.js';
import { MarketplaceCategoryMapping } from '../../models/Category.model.js';

export interface ChannelRule {
  requiredFields: string[];
  requiresCategoryMapping: boolean;
  requiresBrand: boolean;
}

export const CHANNEL_RULES: Record<AiChannel, ChannelRule> = {
  storefront: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: false, requiresBrand: false },
  trendyol: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: true },
  hepsiburada: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: true },
  pazarama: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: true },
  n11: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: false },
  amazon: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: true },
  etsy: { requiredFields: ['title', 'description', 'price', 'quantity'], requiresCategoryMapping: true, requiresBrand: false },
};

export const MARKETPLACE_CHANNEL_KEYS: AiChannel[] = [
  'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy',
];

function missingFieldsFor(draft: AiProductDraft, requiredFields: string[]): string[] {
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (field === 'title' && !draft.title?.trim()) missing.push(field);
    if (field === 'description' && !draft.description?.trim()) missing.push(field);
    if (field === 'price' && (draft.suggestedPrice == null || Number(draft.suggestedPrice) <= 0)) missing.push(field);
    if (field === 'quantity' && (draft.quantity == null || Number(draft.quantity) < 0)) missing.push(field);
  }
  return missing;
}

function draftBrand(draft: AiProductDraft): string | null {
  const attrs = (draft.attributes || {}) as Record<string, unknown>;
  const brand = attrs.brand ?? attrs.brandName ?? attrs.marka;
  return typeof brand === 'string' && brand.trim() ? brand.trim() : null;
}

/**
 * Validates a draft against a list of target channels. A missing field or
 * mapping only blocks publishing — never draft persistence (AGENTOPEN Faz 3).
 */
export async function validateDraftForChannels(
  draft: AiProductDraft,
  channels: AiChannel[]
): Promise<ChannelValidationResult[]> {
  const results: ChannelValidationResult[] = [];
  for (const channel of channels) {
    const rule = CHANNEL_RULES[channel];
    const channelMissing = missingFieldsFor(draft, rule.requiredFields);

    if (rule.requiresBrand && !draftBrand(draft)) {
      channelMissing.push('brand');
    }

    if (rule.requiresCategoryMapping) {
      const integration = await MarketplaceIntegration.findOne({
        where: { storeId: draft.storeId, marketplace: channel, isActive: true },
      });
      if (!integration) {
        results.push({
          channel,
          status: 'integration-not-connected',
          missingFields: channelMissing,
          suggestion: `${channel} entegrasyonunu Pazaryerleri ekranından bağlayın.`,
        });
        continue;
      }

      const mapping = draft.categoryId
        ? await MarketplaceCategoryMapping.findOne({
            where: { categoryId: draft.categoryId, marketplace: channel },
          })
        : null;
      if (!draft.categoryId || !mapping) {
        results.push({
          channel,
          status: 'category-mapping-needed',
          missingFields: channelMissing,
          suggestion: 'Ürünün kategorisini seçin ve bu kategori için pazaryeri eşlemesini tamamlayın.',
        });
        continue;
      }
    }

    if (channelMissing.length > 0) {
      results.push({
        channel,
        status: 'missing-fields',
        missingFields: channelMissing,
        suggestion: `Yayınlamadan önce şu alanları tamamlayın: ${channelMissing.join(', ')}.`,
      });
      continue;
    }

    results.push({ channel, status: 'ready', missingFields: [] });
  }

  return results;
}
