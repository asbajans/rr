/**
 * Shared DTOs for the AI Product Studio flow.
 * Single contract used by web, mobile and core (see AGENTOPEN.md Faz 0).
 */

export type AiSessionStatus =
  | 'uploaded'
  | 'analyzing'
  | 'review'
  | 'approved'
  | 'publishing'
  | 'completed'
  | 'failed';

export type AiDraftStatus = 'review' | 'approved' | 'rejected' | 'converted';

export type AiChannel =
  | 'storefront'
  | 'trendyol'
  | 'hepsiburada'
  | 'pazarama'
  | 'n11'
  | 'amazon'
  | 'etsy';

export interface AiProductSessionDTO {
  id: string;
  storeId: number;
  userId: number;
  status: AiSessionStatus;
  sourceImageUrl: string;
  processedImageUrl?: string;
  draftId?: number;
  errorMessage?: string;
  creditsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiProductDraftDTO {
  id: number;
  sessionId: string;
  storeId: number;
  title: string;
  description: string;
  shortDescription?: string;
  slug?: string;
  sku?: string;
  categoryId?: number;
  categoryPath?: string[];
  attributes: Record<string, string>;
  tags: string[];
  keywords: string[];
  suggestedPrice?: number;
  priceCurrency: string;
  quantity?: number;
  images: string[];
  confidence: Record<string, number>;
  userEditedFields: string[];
  rawAiResponse: Record<string, unknown>;
  status: AiDraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryCandidate {
  name: string;
  confidence: number;
}

export interface PriceSuggestion {
  min: number;
  max: number;
  currency: string;
  rationale?: string;
}

export interface ProductSpecs {
  material?: string;
  color?: string;
  type?: string;
  style?: string;
  pattern?: string;
  brand?: string;
  dimensions?: string;
  weight?: string;
  category?: string;
}

/**
 * Structured AI analysis result — the contract validated against
 * a JSON schema before any draft is persisted (AGENTOPEN.md §7).
 */
export interface AiAnalysisResult {
  productType?: string;
  title: string;
  description: string;
  shortDescription?: string;
  slug?: string;
  category?: string;
  attributes: Record<string, string>;
  tags?: string[];
  keywords: string[];
  bulletPoints?: string[];
  metaTitle?: string;
  metaDescription?: string;
  specs?: ProductSpecs;
  priceSuggestion?: PriceSuggestion | null;
  categoryCandidates: CategoryCandidate[];
  warnings: string[];
  confidence: Record<string, number>;
}

/** Input used to create an AI product session. */
export interface AiSessionCreateInput {
  sourceImageUrl: string;
  category?: string;
  notes?: string;
  shortDescription?: string;
  keywords?: string[];
  suggestPrice?: boolean;
  targetMarketplaces?: AiChannel[];
}

/** Fields a user may edit on a draft (each tracked in userEditedFields). */
export type AiDraftUpdateInput = Partial<
  Pick<
    AiProductDraftDTO,
    | 'title'
    | 'description'
    | 'shortDescription'
    | 'slug'
    | 'sku'
    | 'categoryId'
    | 'categoryPath'
    | 'attributes'
    | 'tags'
    | 'keywords'
    | 'suggestedPrice'
    | 'priceCurrency'
    | 'quantity'
    | 'images'
  >
>;

export type ChannelValidationStatus =
  | 'ready'
  | 'integration-not-connected'
  | 'category-mapping-needed'
  | 'missing-fields';

export interface ChannelValidationResult {
  channel: AiChannel;
  status: ChannelValidationStatus;
  missingFields: string[];
  message?: string;
  suggestion?: string;
}

export interface PublishDraftInput {
  channels: AiChannel[];
}

/** Per-channel result of a publish (or retry) operation. */
export interface PublishResult {
  channel: AiChannel;
  status: 'queued' | 'published' | 'failed' | 'skipped';
  externalId?: string;
  error?: string;
  retryCount?: number;
}
