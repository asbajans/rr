export interface ProcessRequest {
  category: ProductCategory;
}

export type ProductCategory =
  | 'giyim'
  | 'taki'
  | 'kozmetik'
  | 'ayakkabi'
  | 'canta'
  | 'elektronik'
  | 'ev_dekorasyon'
  | 'spor'
  | 'diger';

export type ProcessStatus =
  | 'queued'
  | 'background_removal'
  | 'background_complete'
  | 'comfyui_generating'
  | 'comfyui_complete'
  | 'vision_analyzing'
  | 'vision_complete'
  | 'llm_generating'
  | 'llm_complete'
  | 'completed'
  | 'failed';

export interface SessionUpdate {
  sessionId: string;
  status: ProcessStatus;
  message: string;
  images?: string[];
  error?: string;
  result?: FinalProductResult;
}

export interface ComfyWorkflow {
  [key: string]: unknown;
}

export interface ProductSpecs {
  material: string;
  color: string;
  type: string;
  style: string;
  pattern?: string;
  brand?: string;
  dimensions?: string;
  weight?: string;
  category: ProductCategory;
}

export interface SellerNotes {
  shortDescription?: string;
  keywords?: string;
  targetAudience?: string;
  notes?: string;
}

export interface SeoContent {
  metaTitle: string;
  metaDescription: string;
  slug: string;
  longDescription: string;
  keywords: string[];
}

export interface TrendyolListing {
  title: string;
  description: string;
  attributes: Record<string, string>;
  forbiddenWordsRemoved: string[];
}

export interface AmazonListing {
  bulletPoints: string[];
  description: string;
  keywords: string;
}

export interface FinalProductResult {
  sessionId: string;
  category: ProductCategory;
  images: {
    original: string;
    backgroundRemoved: string;
    generated: string[];
  };
  specs: ProductSpecs;
  seo: SeoContent;
  trendyol: TrendyolListing;
  amazon: AmazonListing;
}
