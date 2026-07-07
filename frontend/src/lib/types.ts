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

export type PaginatedResponse<T> = {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
}
