import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { AuthResponse, User, DashboardData, PaginatedResponse, Store, Product, Order, ApiKey, CreatedApiKey, Plan, StoreFrontData, StoreProduct, Subscription, ProductDetail, DropshippingOrder, MarketplaceData, MarketplaceEntry, MarketplaceCategory, Category, MarketplaceSyncEntry, ProductB2bSetting, B2bProductItem, B2bRequest } from './types'

const API_BASE = 'https://api.rahatio.com.tr'
const TOKEN_KEY = 'auth_token'

type FetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: string
  params?: Record<string, string>
}

class ApiClient {
  private token: string | null = null

  async init() {
    try {
      this.token = await SecureStore.getItemAsync(TOKEN_KEY)
    } catch {
      this.token = await AsyncStorage.getItem(TOKEN_KEY)
    }
  }

  async setToken(token: string | null) {
    this.token = token
    if (token) {
      try {
        await SecureStore.setItemAsync(TOKEN_KEY, token)
      } catch {
        await AsyncStorage.setItem(TOKEN_KEY, token)
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(TOKEN_KEY)
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY)
      }
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options
    const urlParts = [`${API_BASE}${path}`]
    if (params) {
      const searchParams = new URLSearchParams(params)
      urlParts.push(`?${searchParams.toString()}`)
    }
    const url = urlParts.join('')

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(fetchOptions.headers || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(url, { ...fetchOptions, headers })

    if (!res.ok) {
      let errorMsg: string
      try {
        const error = await res.json()
        errorMsg = error.error || error.message || `HTTP ${res.status}`
      } catch {
        errorMsg = `HTTP ${res.status}`
      }
      throw new Error(errorMsg)
    }

    return res.json()
  }

  get<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  post<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  put<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  delete<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    const url = `${API_BASE}${path}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return fetch(url, { method: 'POST', headers, body: formData }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(error.error || error.message || `HTTP ${res.status}`)
      }
      return res.json()
    })
  }

  async downloadFile(path: string, filename: string) {
    const url = `${API_BASE}${path}?token=${this.token || ''}`
    const dest = `${cacheDirectory}${filename}`
    const result = await downloadAsync(url, dest)
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri)
    }
    return result.uri
  }

  // Auth
  login(email: string, password: string) {
    return this.post<AuthResponse>('/api/auth/login', { email, password })
  }

  register(name: string, email: string, password: string, store_name?: string) {
    return this.post<AuthResponse>('/api/auth/register', { name, email, password, store_name })
  }

  me() {
    return this.get<User>('/api/auth/me')
  }

  logout() {
    return this.post<void>('/api/auth/logout')
  }

  // Dashboard
  getDashboard() {
    return this.get<DashboardData>('/api/admin/dashboard')
  }

  // Admin Stores
  getAdminStores(page = 1) {
    return this.get<PaginatedResponse<Store>>(`/api/admin/stores?page=${page}`)
  }

  getAdminStore(id: number) {
    return this.get<Store>(`/api/admin/stores/${id}`)
  }

  createAdminStore(data: Partial<Store>) {
    return this.post<Store>('/api/admin/stores', data)
  }

  updateAdminStore(id: number, data: Partial<Store>) {
    return this.put<Store>(`/api/admin/stores/${id}`, data)
  }

  deleteAdminStore(id: number) {
    return this.delete<void>(`/api/admin/stores/${id}`)
  }

  // Admin Users
  getAdminUsers(page = 1) {
    return this.get<PaginatedResponse<User>>(`/api/admin/users?page=${page}`)
  }

  getAdminUser(id: number) {
    return this.get<User>(`/api/admin/users/${id}`)
  }

  updateAdminUser(id: number, data: Partial<User>) {
    return this.put<User>(`/api/admin/users/${id}`, data)
  }

  deleteAdminUser(id: number) {
    return this.delete<void>(`/api/admin/users/${id}`)
  }

  // Admin Plans
  getAdminPlans() {
    return this.get<Plan[]>('/api/admin/plans')
  }

  getAdminPlan(id: number) {
    return this.get<Plan>(`/api/admin/plans/${id}`)
  }

  createAdminPlan(data: Partial<Plan>) {
    return this.post<Plan>('/api/admin/plans', data)
  }

  updateAdminPlan(id: number, data: Partial<Plan>) {
    return this.put<Plan>(`/api/admin/plans/${id}`, data)
  }

  deleteAdminPlan(id: number) {
    return this.delete<void>(`/api/admin/plans/${id}`)
  }

  // Admin Products
  getAdminProducts(filters?: {
    marketplaces?: string[]
    status?: '' | '1' | '0'
    priceMin?: string | number
    priceMax?: string | number
    page?: number
    perPage?: number | 'all'
    b2b?: '' | '1' | '0'
  }) {
    const params = new URLSearchParams()
    if (filters?.marketplaces?.length) params.set('marketplaces', filters.marketplaces.join(','))
    if (filters?.status) params.set('status', filters.status)
    if (filters?.b2b) params.set('b2b', filters.b2b)
    if (filters?.priceMin !== undefined && filters.priceMin !== '') params.set('price_min', String(filters.priceMin))
    if (filters?.priceMax !== undefined && filters.priceMax !== '') params.set('price_max', String(filters.priceMax))
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const qs = params.toString()
    return this.get<{
      data: Product[]
      total: number
      page: number
      per_page: number
      last_page: number
    }>(`/api/admin/products${qs ? '?' + qs : ''}`)
  }

  getAdminProduct(id: string) {
    return this.get<ProductDetail>(`/api/admin/products/${id}`)
  }

  createAdminProduct(data: {
    title: string
    sku: string
    categoryId?: number
    description?: string
    gramWeight?: number
    milyem?: number
    effectiveMilyem?: number
    profitMargin?: number
    priceMultiplier?: number
    priceTRY?: number
    priceUSD?: number
    isB2BEnabled?: boolean
    b2bDiscount?: number
    b2bPrice?: number
    discountRate?: number
    quantity?: number
    images?: string[]
    videoUrl?: string
    marketplaces?: string[]
    marketplaceConfig?: Record<string, any>
    hasVariants?: boolean
    variantAttributes?: Record<string, any>
    tags?: string[]
  }) {
    return this.post<Product>('/api/admin/products', data)
  }

  updateAdminProduct(id: string, data: {
    title?: string
    sku?: string
    categoryId?: number
    description?: string
    gramWeight?: number
    milyem?: number
    effectiveMilyem?: number
    profitMargin?: number
    priceMultiplier?: number
    priceTRY?: number
    priceUSD?: number
    isB2BEnabled?: boolean
    b2bDiscount?: number
    b2bPrice?: number
    discountRate?: number
    quantity?: number
    images?: string[]
    videoUrl?: string
    marketplaces?: string[]
    marketplaceConfig?: Record<string, any>
    hasVariants?: boolean
    variantAttributes?: Record<string, any>
    tags?: string[]
  }) {
    return this.put<Product>(`/api/admin/products/${id}`, data)
  }

  deleteAdminProduct(id: string) {
    return this.delete<void>(`/api/admin/products/${id}`)
  }

  deleteAdminProductsBulk(ids: string[]) {
    return this.post<void>('/api/admin/products/bulk-delete', { ids })
  }

  verifyProduct(id: string, marketplace: string) {
    return this.post<{
      marketplace: string
      exists: boolean
      marketplace_product_id?: string | null
      error?: string | null
      sync?: MarketplaceSyncEntry | null
    }>(`/api/admin/products/${id}/verify`, { marketplace })
  }

  getMarketplaceTrees() {
    return this.get<{ trees: Record<string, MarketplaceCategory[]> }>('/api/admin/integrations/marketplace-trees')
  }

  getCategoriesFlat() {
    return this.get<{ data: Category[] }>('/api/admin/categories/flat')
  }

  uploadImage(fileUri: string, fileName: string, mimeType: string) {
    const formData = new FormData()
    formData.append('file', { uri: fileUri, name: fileName, type: mimeType } as any)
    return this.upload<{ path: string; url: string }>('/api/admin/upload', formData).then((r) => ({
      path: r.path,
      url: r.url && r.url.startsWith('http') ? r.url : `${API_BASE}${r.url}`,
    }))
  }

  generateProductDescription(data: {
    name: string
    brand?: string
    category?: string
    price?: number
    keywords?: string
    field?: 'description' | 'title'
  }) {
    return this.post<{ description?: string; title?: string }>('/api/ai/generate-description', data)
  }

  editProductImage(data: { image_urls: string[]; prompt: string; category?: string }) {
    return this.post<{ sessionId: string; message?: string }>('/api/ai/edit-image', data)
  }

  getAiStatus(sessionId: string) {
    return this.get<{ sessionId: string; images: number; ready: string[] }>(`/api/ai/status/${sessionId}`)
  }

  getAiOutputUrl(sessionId: string, file: string) {
    return `${API_BASE}/api/ai/output/${encodeURIComponent(sessionId)}/${encodeURIComponent(file)}`
  }

  // Admin Orders (storefront / Aimeos)
  getAdminOrders() {
    return this.get<{ data: Order[]; total: number }>('/api/admin/orders')
  }

  getAdminOrder(id: string) {
    return this.get<Order>(`/api/admin/orders/${id}`)
  }

  // Admin Dropshipping / Marketplace Orders
  getAdminDropshippingOrders(params?: { status?: string; marketplace?: string; page?: number }) {
    const qs = params
      ? '?' + Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
          .join('&')
      : ''
    return this.get<{ data: DropshippingOrder[]; total: number; current_page: number; last_page: number }>(
      `/api/admin/orders/dropshipping${qs}`,
    )
  }

  getAdminDropshippingOrder(id: number) {
    return this.get<DropshippingOrder>(`/api/admin/orders/dropshipping/${id}`)
  }

  // Admin API Keys
  getAdminApiKeys() {
    return this.get<ApiKey[]>('/api/admin/api-keys')
  }

  createAdminApiKey(data: { name: string }) {
    return this.post<CreatedApiKey>('/api/admin/api-keys', data)
  }

  deleteAdminApiKey(id: number) {
    return this.delete<void>(`/api/admin/api-keys/${id}`)
  }

  // Settings
  getSettings() {
    return this.get<Store>('/api/admin/settings')
  }

  updateSettings(data: Partial<Store>) {
    return this.put<Store>('/api/admin/settings', data)
  }

  // AI
  processImage(formData: FormData) {
    return this.upload<{ url: string }>('/api/ai/process-image', formData)
  }

  analyzeProduct(formData: FormData) {
    return this.upload<{
      specs: { material: string; color: string; type: string; style: string; category: string }
      title: string
      description: string
      short_description: string
      meta_title: string
      meta_description: string
      keywords: string[]
      slug: string
    }>('/api/ai/analyze-product', formData)
  }

  // Subscription
  getSubscription() {
    return this.get<{ subscription: Subscription | null; plan: Plan | null }>('/api/admin/subscription')
  }

  createCheckoutSession(planId: number) {
    return this.post<{ url: string }>('/api/admin/subscription/checkout', { plan_id: planId })
  }

  createPortalSession() {
    return this.post<{ url: string }>('/api/admin/subscription/portal')
  }

  cancelSubscription() {
    return this.post<{ message: string }>('/api/admin/subscription/cancel')
  }

  getPlans() {
    return this.get<Plan[]>('/api/admin/plans')
  }

  purchaseCredits(credits: number) {
    return this.post<{ url: string }>('/api/admin/subscription/purchase-credits', { credits })
  }

  // B2B product settings
  getProductB2b(id: string) {
    return this.get<ProductB2bSetting | null>(`/api/b2b/settings/${id}`)
  }

  updateProductB2b(data: { product_id: string; is_b2b_enabled: boolean; b2b_discount?: number | null; b2b_price?: number | null }) {
    return this.put<ProductB2bSetting>('/api/b2b/settings', data)
  }

  bulkSetB2b(ids: string[], is_b2b_enabled: boolean) {
    return this.post<{ updated: number }>('/api/b2b/bulk', { ids, is_b2b_enabled })
  }

  // B2B discover / requests / clone
  getB2bDiscover(params?: { page?: number; search?: string }) {
    const q = new URLSearchParams()
    if (params?.page) q.set('page', String(params.page))
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return this.get<{ data: B2bProductItem[]; total: number; current_page: number; last_page: number }>(
      `/api/b2b/discover${qs ? `?${qs}` : ''}`
    )
  }

  getB2bRequests(params?: { type?: 'incoming' | 'outgoing'; status?: string }) {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.status) q.set('status', params.status)
    const qs = q.toString()
    return this.get<{ data: B2bRequest[] }>(`/api/b2b/requests${qs ? `?${qs}` : ''}`)
  }

  createB2bRequest(data: { product_id: string; to_store_id?: string; note?: string }) {
    return this.post<B2bRequest>('/api/b2b/requests', data)
  }

  updateB2bRequest(id: string, status: 'approved' | 'rejected') {
    return this.put<B2bRequest>(`/api/b2b/requests/${id}`, { status })
  }

  cloneB2bRequest(id: string) {
    return this.post<B2bRequest>(`/api/b2b/requests/${id}/clone`, {})
  }

  getB2bListed() {
    return this.get<{ data: B2bProductItem[] }>('/api/b2b/listed')
  }

  // Slave Download
  downloadSlavePhp() {
    return this.downloadFile('/api/admin/slave/download-php', 'rahatio-slave.php')
  }

  downloadSlaveVercel() {
    return this.downloadFile('/api/admin/slave/download-vercel', 'rahatio-slave-vercel.zip')
  }

  // Store Frontend
  getStoreFront(siteCode: string) {
    return this.get<StoreFrontData>(`/api/store/${siteCode}`)
  }

  getStoreProduct(siteCode: string, id: string) {
    return this.get<StoreProduct>(`/api/store/${siteCode}/products/${id}`)
  }
}

export const api = new ApiClient()