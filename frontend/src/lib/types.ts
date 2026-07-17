export type User = {
  id: number
  name: string
  email: string
  ai_credits: number
  store_id: number | null
  is_admin: boolean
}

export type AuthResponse = {
  user: User
  store?: {
    id: number
    name: string
    site_code: string
    domain: string | null
    email: string | null
  }
  token: string
}

export type Store = {
  id: number
  name: string
  site_code: string
  domain: string | null
  email: string | null
  is_active: boolean
}

export type Plan = {
  id: number
  name: string
  slug: string
  description: string | null
  price: number
  currency: string
  ai_credits: number
  product_limit: number
  store_limit: number
  modules: Record<string, { enabled: boolean; credit_cost?: number; limit?: number }> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MarketplaceCategory = {
  id?: string
  marketplace_category_id?: string
  name: string
  parent_id: string | null
  level: number
  path: string | null
  children?: MarketplaceCategory[]
}

export type MarketplaceEntry = {
  category?: string
  category_id?: string
  brand?: string
  on_sale?: boolean
  status?: number
}

export type MarketplaceSyncStatus = 'none' | 'pending' | 'synced' | 'error'

export type MarketplaceSyncEntry = {
  status: MarketplaceSyncStatus
  marketplace_product_id?: string | null
  error_message?: string | null
  checked_at?: string | null
}

export type Product = {
  id: string
  code: string
  label: string
  status: number
  price?: number
  stock?: number
  marketplaces?: string[]
  marketplace_data?: Record<string, MarketplaceEntry>
  marketplace_sync?: Record<string, MarketplaceSyncEntry>
  images?: string[]
  media_url?: string
  description?: string | null
  category?: string | null
  brand?: string | null
  is_b2b_clone?: boolean
  b2b_source_store_id?: string | null
}

export type DashboardData = {
  user: User
  store: Store | null
  stats: {
    total_products: number
    total_orders: number
    ai_credits: number
  }
}

export type Order = {
  id: string
  [key: string]: unknown
}

export type ApiKey = {
  id: number
  store_id: number
  name: string
  key: string
  allowed_ips: string | null
  expires_at: string | null
  last_used_at: string | null
  created_at: string
  store?: Store
}

export type CreatedApiKey = {
  api_key: ApiKey
  plain_text: string
}

export type StoreProduct = {
  'product.id': string
  'product.code': string
  'product.label': string
  'product.status': number
  price: number | null
  currency: string | null
  image: string | null
  description: string | null
}

export type StoreFrontData = {
  store: {
    id: number
    name: string
    site_code: string
    domain: string | null
    email: string | null
  }
  products: StoreProduct[]
  total: number
}

export type PaginatedResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export type Subscription = {
  id: number
  store_id: number
  plan_id: number
  stripe_id: string | null
  stripe_status: string | null
  payment_method: string
  quantity: number
  trial_ends_at: string | null
  ends_at: string | null
  renews_at: string | null
  status: string
  plan?: Plan
}

// Category Types
export type MarketplaceMapping = {
  id: number
  category_id: number
  marketplace: string
  marketplace_category_id: string
  marketplace_category_name: string
  marketplace_parent_id: string | null
}

export type Category = {
  id: number
  parent_id: number | null
  slug: string
  name: string
  translations: Record<string, string> | null
  icon: string | null
  sort_order: number
  is_active: boolean
  children?: Category[]
  marketplaceMappings?: MarketplaceMapping[]
  path?: string
  created_at: string
  updated_at: string
}

// External Feed Types
export type ExternalFeed = {
  id: number
  store_id: number
  name: string
  feed_url: string
  file_format: 'xml' | 'csv' | 'xlsx' | 'json'
  auth_type: 'none' | 'basic' | 'bearer' | 'api-key'
  auth_credentials: Record<string, string> | null
  pricing_mode: 'fixed' | 'gold-formula'
  currency: 'TRY' | 'USD'
  default_gram_weight: number | null
  default_milyem: number | null
  default_profit_margin: number | null
  price_multiplier: number
  default_category: string | null
  default_category_id: number | null
  default_is_b2b_enabled: boolean
  default_quantity: number
  default_marketplaces: string[] | null
  field_mapping: Record<string, string> | null
  auto_sync: boolean
  update_interval: 'manual' | 'hourly' | 'daily' | 'weekly'
  last_sync_at: string | null
  last_sync_result: { total?: number; imported?: number; failed?: number; error?: string; errors?: string[] } | null
  is_active: boolean
  created_at: string
  updated_at: string
  sync_logs?: FeedSyncLog[]
}

// Payment Method Types
export type StorePaymentMethod = {
  id: number | null
  store_id?: number
  method: string
  label: string
  is_active: boolean
  config: Record<string, string>
}

// Store Location Types
export type StoreLocation = {
  id: number
  store_id: number
  name: string | null
  latitude: number
  longitude: number
  address: string
  city: string
  country: string
  phone: string | null
  working_hours: string[] | null
  is_primary: boolean
  created_at: string
}

// Order Workflow Types
export type DropshippingOrder = {
  id: number
  external_id: string
  marketplace: string
  status: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  shipping_address?: string
  grand_total: string
  currency: string
  created_at: string
  ordered_at?: string
}

export type DropshippingOrderDetail = DropshippingOrder & {
  items: { sku: string; name: string; quantity: number; unitPrice: number }[]
  subtotal: string
  shipping: string
  tax: string
  tracking_number: string | null
  tracking_company: string | null
  note: string | null
  status_history: {
    id: number
    from_status: string | null
    to_status: string
    note: string | null
    user: { name: string } | null
    created_at: string
  }[]
}

// Checkout Types
export type CustomerAddress = {
  id: number
  store_id: number
  user_id: string | null
  full_name: string
  phone: string
  country: string
  city: string
  district: string | null
  zip: string | null
  address_line: string
  is_default: boolean
  created_at: string
}

export type CheckoutPayload = {
  items: { product_id: string; sku: string; name: string; quantity: number; unit_price: number }[]
  customer: { name: string; email: string; phone: string }
  address_id?: number
  shipping?: { full_name: string; phone: string; city: string; address_line: string }
  payment_method: string
  note?: string
}

// Marketplace Integration Types
export type MarketplaceIntegration = {
  id: number | null
  store_id?: number
  marketplace: string
  label: string
  is_active: boolean
  config: Record<string, string>
  fields: Record<string, string>
}

// Variation Types
export type Variation = {
  id: number
  store_id: number
  name: string
  type: 'select' | 'color' | 'text'
  options?: VariationOption[]
  created_at: string
  updated_at: string
}

export type VariationOption = {
  id: number
  variation_id: number
  value: string
  sort_order: number
}

export type ProductVariant = {
  id: number
  store_id: number
  product_id: string
  sku: string
  price: number | null
  currency: string
  stock: number
  attributes: Record<string, string> | null
  image: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FeedSyncLog = {
  id: number
  feed_id: number
  store_id: number
  status: 'running' | 'success' | 'failed'
  started_at: string | null
  completed_at: string | null
  summary: { total?: number; imported?: number; failed?: number; error?: string; errors?: string[] } | null
  created_at: string
}

export type FeedTestResult = {
  success: boolean
  message: string
  headers: string | null
  preview: string | null
  error: string | null
}

// B2B Types
export type B2bStoreInfo = {
  id: number
  name: string
  site_code: string
}

export type B2bProductItem = {
  id: string
  product: {
    id: string
    code: string
    label: string
    status: number
    price: number | null
    currency: string
    stock: number | null
    image: string | null
  }
  store: B2bStoreInfo
  b2b_discount: number | null
  b2b_price: number | null
  my_request_status: string | null
  my_request_id: number | null
}

export type B2bRequestItem = {
  id: number
  product_id: string
  product: {
    id: string
    code: string
    label: string
    status: number
    price: number | null
    currency: string
    stock: number | null
    image: string | null
  } | null
  from_store: B2bStoreInfo | null
  to_store: B2bStoreInfo | null
  status: string
  note: string | null
  created_at: string
}

export type B2bSetting = {
  store_id?: number
  product_id?: string
  is_b2b_enabled: boolean
  b2b_discount: number | null
  b2b_price: number | null
  product?: {
    id: string
    code: string
    label: string
    price: number | null
    stock: number | null
    image: string | null
  }
}

export type Page = {
  id: number
  store_id: number
  type: 'page' | 'blog'
  title: string
  slug: string
  content: string
  meta_title: string | null
  meta_description: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}
