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
  is_active: boolean
  created_at: string
  updated_at: string
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
  b2b_enabled?: boolean
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
  error?: string
}

export type MarketplaceSyncStatus = 'none' | 'pending' | 'synced' | 'error'

export type MarketplaceSyncEntry = {
  status: MarketplaceSyncStatus
  marketplace_product_id?: string | null
  error_message?: string | null
  checked_at?: string | null
}

export type Category = {
  id: number | string
  name: string
  path?: string
  slug?: string
  parent_id?: number | string | null
}

export type DashboardData = {
  user: User
  store: Store | null
  plan: Plan | null
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

export type ProductB2bSetting = {
  product_id: string
  is_b2b_enabled: boolean
  b2b_discount: number | null
  b2b_price: number | null
}

// per-marketplace sync data (keyed by marketplace slug)
export interface MarketplaceData {
  status?: 'pending' | 'active' | 'rejected' | string
  on_sale?: boolean
  category?: string
  brand?: string
  error?: string
  raw?: any
}

// rich product detail returned by GET /api/admin/products/{id}
export interface ProductDetail {
  id: string | number
  code?: string
  label?: string
  status?: number
  price?: number | string
  currency?: string
  stock?: number | string
  image?: string
  images?: string[]
  description?: string
  category?: string
  brand?: string
  marketplaces?: string[]
  marketplace_data?: Record<string, MarketplaceEntry>
  marketplace_sync?: Record<string, MarketplaceSyncEntry>
  created_at?: string
  updated_at?: string
}

// dropshipping order (marketplace order) returned by /api/admin/orders/dropshipping
export interface DropshippingOrder {
  id: number
  external_id?: string
  marketplace?: string
  status?: string
  status_label?: string
  status_color?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  shipping_address?: string
  shipping_city?: string
  shipping_district?: string
  shipping_country?: string
  zip_code?: string
  items?: any[]
  subtotal?: number
  shipping_cost?: number
  discount?: number
  tax?: number
  grand_total?: number
  currency?: string
  ordered_at?: string
  tracking_number?: string
  tracking_company?: string
  shipping_company?: string
  carrier?: string
  created_at?: string
  updated_at?: string
  status_history?: OrderStatusHistory[]
}

export interface OrderStatusHistory {
  id: number
  from_status?: string | null
  to_status?: string
  note?: string | null
  created_at?: string
  user?: { id: number; name: string } | null
}
