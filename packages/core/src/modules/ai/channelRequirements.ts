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

function missingFieldsFor(draft: AiProductDraft): string[] {
  const missing: string[] = [];
  if (!draft.title || !draft.title.trim()) missing.push('title');
  if (!draft.description || !draft.description.trim()) missing.push('description');
  if (draft.suggestedPrice == null || Number(draft.suggestedPrice) <= 0) missing.push('price');
  if (draft.quantity == null || Number(draft.quantity) < 0) missing.push('quantity');
  return missing;
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
  const missing = missingFieldsFor(draft);

  for (const channel of channels) {
    const rule = CHANNEL_RULES[channel];
    const channelMissing = [...missing];

    if (rule.requiresCategoryMapping) {
      const integration = await MarketplaceIntegration.findOne({
        where: { storeId: draft.storeId, marketplace: channel, isActive: true },
      });
      if (!integration) {
        results.push({ channel, status: 'integration-not-connected', missingFields: channelMissing });
        continue;
      }

      const mapping = draft.categoryId
        ? await MarketplaceCategoryMapping.findOne({
            where: { categoryId: draft.categoryId, marketplace: channel },
          })
        : null;
      if (!draft.categoryId || !mapping) {
        results.push({ channel, status: 'category-mapping-needed', missingFields: channelMissing });
        continue;
      }
    }

    if (channelMissing.length > 0) {
      results.push({ channel, status: 'missing-fields', missingFields: channelMissing });
      continue;
    }

    results.push({ channel, status: 'ready', missingFields: [] });
  }

  return results;
}
