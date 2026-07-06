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
  | 'completed'
  | 'failed';

export interface SessionUpdate {
  sessionId: string;
  status: ProcessStatus;
  message: string;
  images?: string[];
  error?: string;
}

export interface ComfyWorkflow {
  [key: string]: unknown;
}
