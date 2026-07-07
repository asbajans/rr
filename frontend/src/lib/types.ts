export type User = {
  id: number
  name: string
  email: string
  ai_credits: number
  store_id: number | null
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
  price: number
  ai_credits: number
  product_limit: number
}

export type Product = {
  id: string
  code: string
  label: string
  status: number
  price?: number
  stock?: number
}
