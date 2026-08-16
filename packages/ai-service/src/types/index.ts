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

export const productCategories: ProductCategory[] = [
  'giyim',
  'taki',
  'kozmetik',
  'ayakkabi',
  'canta',
  'elektronik',
  'ev_dekorasyon',
  'spor',
  'diger',
];

export type ProcessStatus =
  | 'queued'
  | 'background_removal'
  | 'background_complete'
  | 'comfyui_generating'
  | 'comfyui_complete'
  | 'editing'
  | 'generating'
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

export type ProductCodeType = 'barcode' | 'part_code' | 'model' | 'serial' | 'label_text';

export interface ProductCode {
  type: ProductCodeType;
  value: string;
  confidence?: number;
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
  /** All readable text transcribed from the image (labels, tags, engravings). */
  visibleText?: string;
  /** Structured codes/barcodes/part numbers visible on the product. */
  codes?: ProductCode[];
  /** Free-form observations that don't fit the fixed fields. */
  observations?: string[];
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
