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
