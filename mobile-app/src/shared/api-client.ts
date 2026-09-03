import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { AuthResponse, MeResponse, User, DashboardData, PaginatedResponse, Store, Product, Order, ApiKey, CreatedApiKey, Plan, StoreFrontData, StoreProduct, Subscription, ProductDetail, DropshippingOrder, MarketplaceData, MarketplaceEntry, MarketplaceCategory, Category, Brand, MarketplaceSyncEntry, ProductB2bSetting, B2bProductItem, B2bRequest, AiProductSession, AiProductDraft, AiChannelValidationResult, AiSessionStatusResponse, AiCategory } from './types'

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
      let errBody: any
      try {
        const error = await res.json()
        errBody = error
        errorMsg = error.error || error.message || `HTTP ${res.status}`
      } catch {
        errorMsg = `HTTP ${res.status}`
      }
      const err = new Error(errorMsg) as Error & { code?: string; data?: any; status?: number }
      err.code = errBody?.error
      err.data = errBody
      err.status = res.status
      throw err
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

  // Field mapping helpers
  private mapProduct(p: any): any {
    if (!p) return p
    const hasTRY = p.priceTRY !== null && p.priceTRY !== undefined
    const hasUSD = p.priceUSD !== null && p.priceUSD !== undefined
    return {
      ...p,
      code: p.sku ?? p.code,
      label: p.title ?? p.label,
      status: p.isActive !== undefined ? (p.isActive ? 1 : 0) : p.status,
      price: p.priceTRY ?? p.priceUSD ?? p.price,
      price_currency: hasTRY ? 'TRY' : hasUSD ? 'USD' : 'TRY',
      price_try: p.priceTRY ?? null,
      price_usd: p.priceUSD ?? null,
      stock: p.quantity ?? p.stock,
      gram_weight: p.gramWeight ?? null,
      milyem: p.milyem ?? null,
      effective_milyem: p.effectiveMilyem ?? null,
      profit_margin: p.profitMargin ?? 0,
      price_multiplier: p.priceMultiplier ?? 1.0,
      discount_rate: p.discountRate ?? 0,
      discounted_price: p.discountedPrice ?? null,
      b2b_enabled: p.isB2BEnabled ?? p.b2b_enabled,
      b2b_discount: p.b2bDiscount ?? p.b2b_discount,
      b2b_price: p.b2bPrice ?? p.b2b_price,
      has_variants: p.hasVariants ?? false,
      variant_attributes: p.variantAttributes ?? null,
      tags: p.tags ?? null,
      video_url: p.videoUrl ?? null,
      is_b2b_clone: p.originalProductId ? true : (p.is_b2b_clone ?? false),
      original_product_id: p.originalProductId ?? null,
      original_store_id: p.originalStoreId ?? null,
      slug: p.slug ?? null,
      category_id: p.categoryId ?? p.category_id ?? null,
      created_at: p.createdAt ?? p.created_at,
      updated_at: p.updatedAt ?? p.updated_at,
    }
  }

  private mapOrder(o: any): any {
    if (!o) return o
    const address = o.shippingAddress || o.shipping_address
    return {
      ...o,
      id: Number(o.id),
      grand_total: o.totalAmount ?? o.grand_total,
      shipping_address: typeof address === 'object' ?
        [address.addressLine1, address.addressLine2, address.city, address.state, address.country].filter(Boolean).join(', ')
        : (address || ''),
      customer_name: o.customerName || (typeof address === 'object' ? (address.name || address.fullName || address.firstName + ' ' + address.lastName || '') : ''),
      customer_email: o.customerEmail || (typeof address === 'object' ? (address.email || '') : ''),
      customer_phone: o.customerPhone || (typeof address === 'object' ? (address.phone || address.phoneNumber || '') : ''),
      external_id: o.marketplaceOrderId || o.orderNumber || o.external_id,
      subtotal: o.subtotal ?? (o.totalAmount ? Number(o.totalAmount) * 0.9 : 0),
      shipping: o.shipping ?? 0,
      tax: o.tax ?? 0,
    }
  }

  // Auth
  login(email: string, password: string) {
    return this.post<AuthResponse>('/api/auth/login', { email, password })
  }

  register(name: string, email: string, password: string, store_name?: string) {
    return this.post<AuthResponse>('/api/auth/register', { name, email, password, store_name })
  }

  me() {
    return this.get<MeResponse>('/api/auth/me').then(r => ({ user: r.user, store: r.store }))
  }

  logout() {
    return this.post<void>('/api/auth/logout')
  }

  registerFcmToken(token: string) {
    return this.post<{ success: boolean }>('/api/auth/fcm-token', { token })
  }

  changePassword(currentPassword: string | undefined, newPassword: string) {
    const body: Record<string, string> = { newPassword }
    if (currentPassword) body.currentPassword = currentPassword
    return this.post<{ success: boolean; message: string }>('/api/auth/change-password', body)
  }

  getGoogleConfig() {
    return this.get<{ enabled: boolean; clientId: string | null; clientIds: string[] }>('/api/auth/google/config')
  }

  googleLogin(idToken: string, accessToken?: string) {
    const payload: Record<string, string> = {}
    if (idToken) payload.idToken = idToken
    if (accessToken) payload.accessToken = accessToken
    if (!payload.idToken && !accessToken) payload.credential = idToken
    return this.post<AuthResponse>('/api/auth/google', payload)
  }

  resetUserPassword(userId: number, newPassword: string) {
    return this.put<{ success: boolean; message: string }>(`/api/admin/users/${userId}/password`, { newPassword })
  }

  async getQuotaStatus() {
    return this.get<import('./types').QuotaStatus>('/api/admin/quota/status')
  }

  // Dashboard
  async getDashboard() {
    const r = await this.get<any>('/api/admin/dashboard')
    return {
      user: r.user || null,
      store: r.store
        ? {
            id: r.store.id,
            name: r.store.name,
            site_code: r.store.siteCode ?? r.store.site_code ?? '',
            domain: r.store.domain ?? null,
            email: r.store.email ?? null,
            is_active: r.store.isActive ?? r.store.is_active ?? true,
          }
        : null,
      plan: r.plan || null,
      subscription: r.subscription || null,
      quota: r.quota || null,
      stats: {
        total_products: r.totalProducts ?? 0,
        active_products: r.activeProducts ?? 0,
        total_orders: r.totalOrders ?? 0,
        pending_orders: r.pendingOrders ?? 0,
        ai_credits: r.currentCredits ?? 0,
        total_revenue: r.totalRevenue ?? 0,
        active_integrations: r.activeIntegrations ?? 0,
        low_stock_count: r.lowStockCount ?? 0,
      },
      orderStatusCounts: r.orderStatusCounts ?? {},
    } as DashboardData
  }

  // Admin Stores
  async getAdminStores(page = 1) {
    const r = await this.get<any>(`/api/admin/stores?page=${page}`)
    const raw = Array.isArray(r) ? r : (r.data || r.stores || [])
    const stores: Store[] = raw.map((s: any) => ({
      id: s.id,
      name: s.name,
      site_code: s.siteCode ?? s.site_code ?? '',
      domain: s.domain ?? null,
      email: s.email ?? null,
      is_active: s.isActive ?? s.is_active ?? true,
    }))
    return {
      data: stores,
      total: stores.length,
      current_page: 1,
      last_page: 1,
      per_page: stores.length || 50,
    } as PaginatedResponse<Store>
  }

  async getAdminStore(id: number) {
    const r = await this.get<any>(`/api/admin/stores/${id}`)
    const s = r.store || r.data || r
    return {
      id: s.id,
      name: s.name,
      site_code: s.siteCode ?? s.site_code ?? '',
      domain: s.domain ?? null,
      email: s.email ?? null,
      is_active: s.isActive ?? s.is_active ?? true,
    } as Store
  }

  async createAdminStore(data: Partial<Store>) {
    const payload: any = { name: data.name }
    if (data.site_code) payload.siteCode = data.site_code
    if (data.email) payload.email = data.email
    if (data.domain) payload.domain = data.domain
    const r = await this.post<any>('/api/admin/stores', payload)
    const s = r.store || r.data || r
    return {
      id: s.id,
      name: s.name,
      site_code: s.siteCode ?? s.site_code ?? '',
      domain: s.domain ?? null,
      email: s.email ?? null,
      is_active: true,
    } as Store
  }

  async updateAdminStore(id: number, data: Partial<Store>) {
    const payload: any = {}
    if (data.name) payload.name = data.name
    if (data.site_code) payload.siteCode = data.site_code
    if (data.email) payload.email = data.email
    if (data.domain) payload.domain = data.domain
    if (data.is_active !== undefined) payload.isActive = data.is_active
    await this.put<any>(`/api/admin/stores/${id}`, payload)
    return this.getAdminStore(id)
  }

  deleteAdminStore(id: number) {
    return this.delete<void>(`/api/admin/stores/${id}`)
  }

  // Admin Users
  async getAdminUsers(page = 1) {
    const r = await this.get<any>(`/api/admin/users?page=${page}`)
    const raw = Array.isArray(r) ? r : (r.data || r.users || [])
    const users: User[] = raw.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      ai_credits: u.aiCredits ?? u.ai_credits ?? 0,
      store_id: u.storeId ?? u.store_id ?? null,
      is_admin: u.role === 'superadmin' || u.is_admin === true,
    }))
    const pagination = r.pagination || {}
    return {
      data: users,
      total: pagination.total ?? users.length,
      current_page: pagination.page ?? pagination.current_page ?? 1,
      last_page: pagination.totalPages ?? pagination.last_page ?? 1,
      per_page: pagination.limit ?? pagination.per_page ?? (users.length || 50),
    } as PaginatedResponse<User>
  }

  async getAdminUser(id: number) {
    const r = await this.get<any>(`/api/admin/users/${id}`)
    const u = r.user || r.data || r
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      ai_credits: u.aiCredits ?? u.ai_credits ?? 0,
      store_id: u.storeId ?? u.store_id ?? null,
      is_admin: u.role === 'superadmin' || u.is_admin === true,
    } as User
  }

  async updateAdminUser(id: number, data: Partial<User>) {
    const payload: any = {}
    if (data.name) payload.name = data.name
    if (data.email) payload.email = data.email
    if (data.is_admin !== undefined) payload.role = data.is_admin ? 'superadmin' : 'staff'
    await this.put<any>(`/api/admin/users/${id}`, payload)
    return this.getAdminUser(id)
  }

  deleteAdminUser(id: number) {
    return this.delete<void>(`/api/admin/users/${id}`)
  }

  // Admin Plans
  async getAdminPlans() {
    const r = await this.get<any>('/api/admin/plans')
    return (r.plans || r.data || r) as Plan[]
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
  async getAdminProducts(filters?: {
    marketplaces?: string[]
    status?: '' | '1' | '0'
    priceMin?: string | number
    priceMax?: string | number
    search?: string
    page?: number
    perPage?: number | 'all'
    b2b?: '' | '1' | '0'
  }) {
    const params: Record<string, string> = {}
    if (filters?.marketplaces?.length) params.marketplaces = filters.marketplaces.join(',')
    if (filters?.status === '1') params.status = 'active'
    else if (filters?.status === '0') params.status = 'inactive'
    if (filters?.b2b) params.b2b = filters.b2b
    if (filters?.search) params.search = filters.search
    if (filters?.priceMin !== undefined && filters.priceMin !== '') params.priceMin = String(filters.priceMin)
    if (filters?.priceMax !== undefined && filters.priceMax !== '') params.priceMax = String(filters.priceMax)
    if (filters?.page) params.page = String(filters.page)
    if (filters?.perPage && filters.perPage !== 'all') params.limit = String(filters.perPage)
    else if (filters?.perPage === 'all') params.limit = 'all'
    const r = await this.get<{ products: Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/products', { params })
    return {
      data: (r.products || []).map(this.mapProduct),
      total: r.pagination.total,
      current_page: r.pagination.page,
      per_page: r.pagination.limit,
      last_page: r.pagination.totalPages,
    }
  }

  async getAdminProduct(id: string) {
    const r = await this.get<{ product: ProductDetail }>(`/api/admin/products/${id}`)
    return this.mapProduct(r.product)
  }

  createAdminProduct(data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) {
      if (data.price_currency === 'USD') payload.priceUSD = data.price
      else payload.priceTRY = data.price
    }
    if (data.price_try !== undefined) payload.priceTRY = data.price_try
    if (data.price_usd !== undefined) payload.priceUSD = data.price_usd
    if (data.stock !== undefined) payload.quantity = data.stock
    if (data.status !== undefined) payload.isActive = data.status === '1' || data.status === true
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description) payload.description = data.description
    if (data.gram_weight !== undefined) payload.gramWeight = data.gram_weight
    if (data.milyem !== undefined) payload.milyem = data.milyem
    if (data.profit_margin !== undefined) payload.profitMargin = data.profit_margin
    if (data.price_multiplier !== undefined) payload.priceMultiplier = data.price_multiplier
    if (data.video_url) payload.videoUrl = data.video_url
    if (data.tags) payload.tags = data.tags
    return this.post<{ product: Product }>('/api/admin/products', payload).then(r => r.product)
  }

  updateAdminProduct(id: string, data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) {
      if (data.price_currency === 'USD') payload.priceUSD = data.price
      else payload.priceTRY = data.price
    }
    if (data.price_try !== undefined) payload.priceTRY = data.price_try
    if (data.price_usd !== undefined) payload.priceUSD = data.price_usd
    if (data.stock !== undefined) payload.quantity = data.stock
    if (data.status !== undefined) payload.isActive = data.status === '1' || data.status === true
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description !== undefined) payload.description = data.description
    if (data.gram_weight !== undefined) payload.gramWeight = data.gram_weight
    if (data.milyem !== undefined) payload.milyem = data.milyem
    if (data.profit_margin !== undefined) payload.profitMargin = data.profit_margin
    if (data.price_multiplier !== undefined) payload.priceMultiplier = data.price_multiplier
    if (data.video_url) payload.videoUrl = data.video_url
    if (data.tags) payload.tags = data.tags
    return this.put<{ product: Product }>(`/api/admin/products/${id}`, payload).then(r => r.product)
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

  getBrands(filters?: { marketplace?: string; search?: string }) {
    const params: Record<string, string> = {}
    if (filters?.marketplace) params.marketplace = filters.marketplace
    if (filters?.search) params.search = filters.search
    return this.get<{ brands: Brand[] }>('/api/admin/brands', { params }).then(r => r.brands)
  }

  async getCategoriesFlat() {
    const r = await this.get<{ categories: Category[] }>('/api/admin/categories', { params: { flat: 'true' } })
    return { data: r.categories }
  }

  async getCategoriesTree() {
    const r = await this.get<{ categories: Category[] }>('/api/admin/categories/tree')
    return { data: r.categories }
  }

  createCategory(data: { name: Record<string, string>; slug: string; parentId?: number; translations?: Record<string, string>; icon?: string; sortOrder?: number; isActive?: boolean }) {
    return this.post<{ category: Category }>('/api/admin/categories', data).then(r => r.category)
  }

  updateCategory(id: number, data: { name?: Record<string, string>; slug?: string; parentId?: number | null; translations?: Record<string, string>; icon?: string; sortOrder?: number; isActive?: boolean }) {
    return this.put<{ category: Category }>(`/api/admin/categories/${id}`, data).then(r => r.category)
  }

  deleteCategory(id: number) {
    return this.delete<{ success?: boolean }>(`/api/admin/categories/${id}`)
  }

  getVariations() {
    return this.get<{ variations: any[] }>('/api/admin/variations').then(r => r.variations)
  }

  getVariation(id: number) {
    return this.get<{ variation: any }>(`/api/admin/variations/${id}`).then(r => r.variation)
  }

  createVariation(data: { name: string; type: string; options?: string[] }) {
    return this.post<{ variation: any }>('/api/admin/variations', data).then(r => r.variation)
  }

  updateVariation(id: number, data: { name?: string; type?: string }) {
    return this.put<{ variation: any }>(`/api/admin/variations/${id}`, data).then(r => r.variation)
  }

  deleteVariation(id: number) {
    return this.delete<{ success?: boolean }>(`/api/admin/variations/${id}`)
  }

  addVariationOption(id: number, value: string, sortOrder?: number) {
    return this.post<{ option: any }>(`/api/admin/variations/${id}/options`, { value, sortOrder }).then(r => r.option)
  }

  updateVariationOption(id: number, optionId: number, value: string, sortOrder?: number) {
    return this.put<{ option: any }>(`/api/admin/variations/${id}/options/${optionId}`, { value, sortOrder }).then(r => r.option)
  }

  deleteVariationOption(id: number, optionId: number) {
    return this.delete<{ success?: boolean }>(`/api/admin/variations/${id}/options/${optionId}`)
  }

  uploadImage(fileUri: string, fileName: string, mimeType: string) {
    const formData = new FormData()
    formData.append('file', { uri: fileUri, name: fileName, type: mimeType } as any)
    return this.upload<{ path: string; url: string }>('/api/admin/upload', formData).then((r) => ({
      path: r.path,
      url: r.url && r.url.startsWith('http') ? r.url : `${API_BASE}${r.url}`,
    }))
  }

  generateProductDescription(data: { name?: string; brand?: string; category?: string; price?: number; field?: string; title?: string; keywords?: string[] }) {
    const payload: Record<string, any> = {}
    if (data.title) payload.title = data.title
    else if (data.name) payload.title = data.name
    if (data.category) payload.category = data.category
    if (data.brand) payload.attributes = { ...payload.attributes, brand: data.brand }
    if (data.price) payload.attributes = { ...payload.attributes, price: data.price }
    if (data.keywords) payload.keywords = data.keywords
    return this.post<{ description: string; title: string; keywords: string[]; slug: string }>('/api/ai/generate-description', payload)
  }

  editProductImage(data: { image_urls: string[]; prompt: string; category?: string }) {
    return this.post<{ sessionId: string; message?: string }>('/api/ai/edit-image', data)
  }

  getAiStatus(sessionId: string) {
    return this.get<{ sessionId: string; images: number; ready: string[]; error?: string }>(`/api/ai/status/${sessionId}`)
  }

  getAiOutputUrl(sessionId: string, file: string) {
    return `${API_BASE}/api/ai/output/${encodeURIComponent(sessionId)}/${encodeURIComponent(file)}`
  }

  // AI Product Studio (agentic listing flow)
  async createAiProductSession(input: {
    sourceImageUrl: string
    sourceImageUrls?: string[]
    category?: string
    category_id?: number
    condition?: 'new' | 'refurbished' | 'used' | 'salvage'
    notes?: string
    short_description?: string
    keywords?: string[]
    suggest_price?: boolean
    target_marketplaces?: string[]
  }) {
    const r = await this.post<{ session: any; draft: any }>('/api/ai/product-sessions', input)
    return {
      session: r.session as AiProductSession,
      draft: r.draft as AiProductDraft | null,
    }
  }

  async getAiProductSession(id: string) {
    const r = await this.get<{ session: any; draft: any }>(`/api/ai/product-sessions/${id}`)
    return {
      session: r.session as AiProductSession,
      draft: r.draft as AiProductDraft | null,
    }
  }

  async getAiProductSessionStatus(id: string) {
    return this.get<AiSessionStatusResponse>(`/api/ai/product-sessions/${id}/status`)
  }

  async getAiProductDraftBySession(id: string) {
    const r = await this.get<{ draft: any }>(`/api/ai/product-sessions/${id}/draft`)
    return r.draft as AiProductDraft
  }

  async listAiProductDrafts() {
    const r = await this.get<{ drafts: any[] }>('/api/ai/product-drafts')
    return (r.drafts || []) as AiProductDraft[]
  }

  async getAiProductDraft(id: number) {
    const r = await this.get<{ draft: any }>(`/api/ai/product-drafts/${id}`)
    return r.draft as AiProductDraft
  }

  async updateAiProductDraft(id: number, patch: Partial<AiProductDraft>) {
    const r = await this.put<{ draft: any }>(`/api/ai/product-drafts/${id}`, patch)
    return r.draft as AiProductDraft
  }

  async approveAiProductDraft(id: number) {
    const r = await this.post<{ draft: any }>(`/api/ai/product-drafts/${id}/approve`)
    return r.draft as AiProductDraft
  }

  async validateAiProductChannels(id: number, channels: string[], selections?: Record<string, any>) {
    const body: any = { channels }
    if (selections && Object.keys(selections).length) body.selections = selections
    const r = await this.post<{ results: AiChannelValidationResult[] }>(`/api/ai/product-drafts/${id}/validate-channels`, body)
    return (r.results || []) as AiChannelValidationResult[]
  }

  async publishAiProductDraft(id: number, channels: string[], selections?: Record<string, any>) {
    const body: any = { channels }
    if (selections && Object.keys(selections).length) body.selections = selections
    return this.post<{ ok: boolean; productId?: number; results: any[] }>(`/api/ai/product-drafts/${id}/publish`, body)
  }

  async retryAiProductPublish(id: number, channels?: string[]) {
    return this.post<{ ok: boolean; retried: number; results: any[] }>(
      `/api/ai/product-drafts/${id}/publish/retry`,
      channels && channels.length ? { channels } : undefined
    )
  }

  async getAiProductPublishState(id: number) {
    return this.get<{ productId: number | null; draftStatus: string; listings: any[] }>(`/api/ai/product-drafts/${id}/publish`)
  }

  async deleteAiProductDraft(id: number) {
    return this.delete<{ ok: boolean }>(`/api/ai/product-drafts/${id}`)
  }

  // AI Categories (user-defined categories + auto-generated attribute schemas)
  async listAiCategories() {
    const r = await this.get<{ categories: AiCategory[]; defaultCategoryId: number | null }>('/api/admin/ai/categories')
    return { categories: r.categories || [], defaultCategoryId: r.defaultCategoryId }
  }

  // Upload image(s) then start an agentic session in one call (max 2 photos).
  async createAiProductSessionFromImage(imageUris: string[], opts?: { category?: string; categoryId?: number; condition?: 'new' | 'refurbished' | 'used' | 'salvage'; shortDescription?: string; suggestPrice?: boolean; targetMarketplaces?: string[] }) {
    const urls: string[] = []
    for (const uri of imageUris) {
      const uploaded = await this.uploadImage(uri, `photo-${Date.now()}-${urls.length}.jpg`, 'image/jpeg')
      urls.push(uploaded.url)
    }
    return this.createAiProductSession({
      sourceImageUrl: urls[0],
      sourceImageUrls: urls,
      category: opts?.category,
      category_id: opts?.categoryId,
      condition: opts?.condition,
      short_description: opts?.shortDescription,
      suggest_price: opts?.suggestPrice,
      target_marketplaces: opts?.targetMarketplaces,
    })
  }

  // Admin Orders
  async getAdminOrders() {
    const r = await this.get<any>('/api/admin/orders')
    const orders = r.orders || r.data || []
    const pagination = r.pagination || {}
    return {
      data: orders.map(this.mapOrder),
      total: pagination.total ?? orders.length,
      current_page: pagination.page ?? 1,
      last_page: pagination.totalPages ?? 1,
      per_page: pagination.limit ?? 20,
    }
  }

  async getAdminOrder(id: string) {
    const r = await this.get<any>(`/api/admin/orders/${id}`)
    return this.mapOrder(r.order || r.data || r)
  }

  async getAdminOrderCapabilities(id: string) {
    return this.get<{ marketplace: string; integrationConnected: boolean; actions: Array<{ action: string; available: boolean; reason?: string | null }>; unsupported: string[] }>(`/api/admin/orders/${id}/capabilities`)
  }

  updateMarketplaceInvoice(id: string, invoiceLink: string) {
    return this.post<{ success: boolean; invoiceUrl: string }>(`/api/admin/orders/${id}/marketplace/invoice`, { invoiceLink })
  }

  updateMarketplaceReturn(id: string, refundId: string, decision: 'approve' | 'reject') {
    return this.post<{ success: boolean; decision: string }>(`/api/admin/orders/${id}/marketplace/return`, { refundId, decision })
  }

  // Dropshipping / Marketplace Orders (uses same /api/admin/orders endpoint)
  async getAdminDropshippingOrders(params?: { status?: string; marketplace?: string; page?: number; limit?: number; search?: string }) {
    const queryParams: Record<string, string> = {}
    if (params?.status) queryParams.status = params.status
    if (params?.marketplace) queryParams.marketplace = params.marketplace
    if (params?.page) queryParams.page = String(params.page)
    if (params?.limit) queryParams.limit = String(Math.min(params.limit, 100))
    if (params?.search) queryParams.search = params.search
    const r = await this.get<any>('/api/admin/orders', { params: Object.keys(queryParams).length ? queryParams : undefined })
    const ordersRaw = r.orders || r.data || []
    const pagination = r.pagination || {}
    const total = pagination.total ?? ordersRaw.length
    const current_page = pagination.page ?? 1
    const last_page = pagination.totalPages ?? 1
    const orders = ordersRaw.map((o: any) => {
      const address = o.shippingAddress || o.shipping_address
      return {
        ...o,
        id: Number(o.id),
        grand_total: o.totalAmount ?? o.grand_total,
        shipping_address: typeof address === 'object' ?
          [address.addressLine1, address.addressLine2, address.city, address.state, address.country].filter(Boolean).join(', ')
          : (address || ''),
        customer_name: o.customerName || (typeof address === 'object' ? (address.name || address.fullName || '') : ''),
        customer_email: o.customerEmail || (typeof address === 'object' ? (address.email || '') : ''),
        customer_phone: o.customerPhone || (typeof address === 'object' ? (address.phone || '') : ''),
      external_id: o.marketplaceOrderNumber || o.marketplaceOrderId || o.orderNumber || o.external_id,
        subtotal: o.subtotal ?? (o.totalAmount ? Number(o.totalAmount) * 0.9 : 0),
        shipping: o.shipping ?? 0,
        tax: o.tax ?? 0,
      }
    })
    return { data: orders, total, current_page, last_page }
  }

  async getAdminDropshippingOrder(id: number) {
    const r = await this.get<any>(`/api/admin/orders/${id}`)
    return this.mapOrder(r.order || r.data || r)
  }

  // Order management (status/tracking/label/refund etc.)
  updateOrderStatus(id: string, status: string, note?: string) {
    return this.put<any>(`/api/admin/orders/${id}/status`, { status, note })
  }

  updateOrderTracking(id: string, trackingNumber: string, carrier?: string) {
    return this.put<any>(`/api/admin/orders/${id}/tracking`, { trackingNumber, carrier })
  }

  getOrderLabel(id: string) {
    return this.get<{ labelUrl: string | null; labelZpl: string | null; cargoCompany: string | null; reason?: string | null }>(`/api/admin/orders/${id}/label`)
  }

  createOrderInvoice(id: string, provider = 'manual') {
    return this.post<any>(`/api/admin/orders/${id}/invoice`, { provider })
  }

  createShippingLabel(id: string, provider = 'manual') {
    return this.post<any>(`/api/admin/orders/${id}/shipping-label`, { provider })
  }

  refundOrder(id: string, amount?: number, reason?: string) {
    return this.post<{ success: boolean; refId: string; paymentStatus: string }>(`/api/admin/orders/${id}/refund`, { amount, reason })
  }

  // Product / marketplace sync
  syncProduct(productId: string | number, marketplaces?: string[]) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/products/${productId}/sync`, { marketplaces })
  }

  syncAllToMarketplace(marketplace: string) {
    return this.post<{ success: boolean; enqueued: number; message: string }>(`/api/admin/integrations/${marketplace}/sync-all`)
  }

  getMarketplaceIntegrations() {
    return this.get<{ integrations: any[] }>('/api/admin/integrations').then(r => r.integrations || [])
  }

  getMarketplaceCategoryAttributes(marketplace: string, categoryId: string | number) {
    return this.get<{ attributes: any[] }>(`/api/admin/integrations/${marketplace}/categories/${categoryId}/attributes`)
  }

  // AI product studio channel selections (marketplace category/brand/attributes)
  async validateAiProductChannelsWithSelections(id: number, channels: string[], selections?: Record<string, { categoryId?: string | number | null; brandId?: string | null; brand?: string | null; attributes?: any[] }>) {
    return this.post<{ results: AiChannelValidationResult[] }>(`/api/ai/product-drafts/${id}/validate-channels`, { channels, ...(selections ? { selections } : {}) }).then(r => r.results || [])
  }

  async publishAiProductDraftWithSelections(id: number, channels: string[], selections?: Record<string, { categoryId?: string | number | null; brandId?: string | null; brand?: string | null; attributes?: any[] }>) {
    return this.post<{ ok: boolean; productId?: number; results: any[] }>(`/api/ai/product-drafts/${id}/publish`, { channels, ...(selections ? { selections } : {}) })
  }

  // Admin API Keys
  async getAdminApiKeys() {
    const r = await this.get<any>('/api/admin/api-keys')
    const raw = Array.isArray(r) ? r : (r.keys || [])
    return raw.map((k: any) => ({
      id: k.id,
      store_id: k.storeId ?? k.store_id ?? 0,
      name: k.name,
      key: k.key ?? k.keyPrefix ?? '',
      allowed_ips: k.allowedIps ?? k.allowed_ips ?? null,
      expires_at: k.expiresAt ?? k.expires_at ?? null,
      last_used_at: k.lastUsedAt ?? k.last_used_at ?? null,
      created_at: k.createdAt ?? k.created_at,
      store: k.store ?? null,
    })) as ApiKey[]
  }

  async createAdminApiKey(data: { name: string }) {
    const r = await this.post<any>('/api/admin/api-keys', data)
    return {
      api_key: {
        id: r.id,
        store_id: r.storeId ?? r.store_id ?? 0,
        name: r.name ?? data.name,
        key: r.keyPrefix ?? '',
        allowed_ips: r.allowedIps ?? null,
        expires_at: r.expiresAt ?? null,
        last_used_at: null,
        created_at: r.createdAt ?? new Date().toISOString(),
      },
      plain_text: r.key ?? '',
    } as CreatedApiKey
  }

  deleteAdminApiKey(id: number) {
    return this.delete<void>(`/api/admin/api-keys/${id}`)
  }

  // Settings
  async getSettings() {
    const r = await this.get<any>('/api/admin/me')
    const s = r.store || {}
    return {
      id: s.id,
      name: s.name,
      site_code: s.siteCode ?? s.site_code,
      domain: s.domain ?? null,
      email: s.email ?? null,
      is_active: s.isActive ?? s.is_active ?? true,
    } as Store
  }

  async updateSettings(data: Partial<Store>) {
    const payload: Record<string, any> = {}
    if (data.name) payload.name = data.name
    if (data.domain) payload.domain = data.domain
    if (data.email) payload.email = data.email
    if (data.site_code) payload.siteCode = data.site_code
    await this.put<any>('/api/admin/me', payload)
    return this.getSettings()
  }

  // AI
  async processImage(formData: FormData) {
    const entries: [string, FormDataEntryValue][] = Array.from((formData as any).entries() ?? [])
    const payload: Record<string, any> = {}
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && (v as any).uri) {
        if (!payload.imageUrl) {
          const uploaded = await this.uploadImage((v as any).uri, (v as any).name || 'photo.jpg', (v as any).type || 'image/jpeg')
          payload.imageUrl = uploaded.url
        }
      } else {
        payload[k] = v
      }
    }
    if (!payload.category) payload.category = 'diger'
    return this.post<{ sessionId: string; message: string }>('/api/ai/process-image', payload)
  }

  async analyzeProduct(formData: FormData) {
    let imageUrl: string | undefined
    let category: string | undefined
    const entries: [string, FormDataEntryValue][] = Array.from((formData as any).entries() ?? [])
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && (v as any).uri) {
        const uploaded = await this.uploadImage((v as any).uri, (v as any).name || 'photo.jpg', (v as any).type || 'image/jpeg')
        imageUrl = uploaded.url
      } else if (k === 'category') {
        category = v as string
      }
    }
    return this.post<{
      specs: { material: string; color: string; type: string; style: string; category: string }
      title: string
      description: string
      short_description: string
      meta_title: string
      meta_description: string
      keywords: string[]
      slug: string
    }>('/api/ai/analyze-product', { imageUrl, category })
  }

  // Subscription (data comes from /me, no dedicated endpoint)
  async getSubscription() {
    const r = await this.get<any>('/api/admin/me')
    const sub = r.subscription || null
    const plan = r.subscription?.plan || r.store?.plan || r.plan || null
    return {
      subscription: sub ? {
        id: sub.id ?? 0,
        store_id: sub.storeId ?? sub.store_id ?? 0,
        plan_id: sub.planId ?? sub.plan_id ?? 0,
        stripe_id: sub.stripeSubscriptionId ?? sub.stripe_id ?? null,
        stripe_status: sub.stripeStatus ?? sub.stripe_status ?? null,
        payment_method: sub.paymentMethod ?? sub.payment_method ?? '',
        quantity: sub.quantity ?? 1,
        trial_ends_at: sub.trialEndsAt ?? sub.trial_ends_at ?? null,
        ends_at: sub.canceledAt ?? sub.ends_at ?? null,
        renews_at: sub.currentPeriodEnd ?? sub.renews_at ?? null,
        status: sub.status ?? 'inactive',
      } as Subscription : null,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        slug: plan.slug ?? '',
        description: plan.description ?? null,
        price: Number(plan.price ?? 0),
        currency: plan.currency ?? 'TRY',
        ai_credits: plan.aiCredits ?? plan.ai_credits ?? 0,
        product_limit: plan.productLimit ?? plan.product_limit ?? 0,
        store_limit: plan.storeLimit ?? plan.store_limit ?? 1,
        is_active: plan.isActive ?? plan.is_active ?? true,
        created_at: plan.createdAt ?? plan.created_at ?? '',
        updated_at: plan.updatedAt ?? plan.updated_at ?? '',
      } as Plan : null,
    }
  }

  createCheckoutSession(planId: number) {
    return this.post<{ url: string | null }>('/api/admin/subscription/checkout', { planId })
  }

  createPortalSession() {
    return this.post<{ url: string }>('/api/admin/subscription/portal')
  }

  cancelSubscription() {
    return this.post<{ message: string }>('/api/admin/subscription/cancel')
  }

  async getPlans() {
    const r = await this.get<any>('/api/admin/plans')
    return (r.plans || r.data || r) as Plan[]
  }

  purchaseCredits(credits: number) {
    return this.post<{ url: string }>('/api/admin/subscription/purchase-credits', { credits })
  }

  // B2B product settings
  async getProductB2b(id: string) {
    const raw = await this.get<{ setting: any }>(`/api/admin/b2b/settings/${id}`).catch(() => ({ setting: null }))
    if (!raw?.setting) return null as ProductB2bSetting | null
    const s = raw.setting
    return {
      product_id: String(s.productId ?? id),
      is_b2b_enabled: !!s.isB2BEnabled,
      b2b_discount: s.b2bDiscount ?? null,
      b2b_price: s.b2bPrice ?? null,
    } as ProductB2bSetting
  }

  updateProductB2b(data: { product_id: string; is_b2b_enabled: boolean; b2b_discount?: number | null; b2b_price?: number | null }) {
    return this.put<any>('/api/admin/b2b/settings', {
      productId: Number(data.product_id),
      isB2BEnabled: data.is_b2b_enabled,
      b2bDiscount: data.b2b_discount,
      b2bPrice: data.b2b_price,
    })
  }

  bulkSetB2b(ids: string[], is_b2b_enabled: boolean) {
    return this.post<{ updated: number }>('/api/admin/b2b/bulk', { ids, isB2BEnabled: is_b2b_enabled })
  }

  // B2B discover / requests / clone
  async getB2bDiscover(params?: { page?: number; limit?: number; search?: string }) {
    const filters: Record<string, string> = {}
    if (params?.page) filters.page = String(params.page)
    if (params?.limit) filters.limit = String(Math.min(params.limit, 100))
    if (params?.search) filters.search = params.search
    const raw = await this.get<any>('/api/admin/b2b/discover', { params: filters })
    const products = (raw.products || []).map((p: any) => ({
      id: String(p.id),
      code: p.sku || '',
      label: p.title || '',
      price: p.priceTRY ?? null,
      currency: 'TRY',
      stock: p.quantity ?? 0,
      images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
      store_id: String(p.store?.id ?? ''),
      store_name: p.store?.name ?? null,
      store_code: p.store?.siteCode ?? null,
      b2b_discount: p.b2bDiscount ?? p.b2bSetting?.b2bDiscount ?? null,
      b2b_price: p.b2bPrice ?? p.b2bSetting?.b2bPrice ?? p.priceTRY ?? null,
      is_b2b_enabled: !!p.isB2BEnabled,
      supplier: p.supplier ? {
        name: p.supplier.name || '',
        ratingAvg: Number(p.supplier.ratingAvg ?? 0),
        ratingCount: Number(p.supplier.ratingCount ?? 0),
        ratingEnabled: p.supplier.ratingEnabled !== false,
        maxShipmentDays: Number(p.supplier.maxShipmentDays ?? 3),
      } : null,
    }))
    return {
      data: products,
      total: raw.pagination?.total ?? products.length,
      current_page: raw.pagination?.page ?? 1,
      last_page: raw.pagination?.totalPages ?? 1,
      per_page: raw.pagination?.limit ?? 20,
    }
  }

  async getB2bRequests(params?: { type?: 'incoming' | 'outgoing'; status?: string }) {
    const filters: Record<string, string> = {}
    if (params?.type) filters.type = params.type
    if (params?.status) filters.status = params.status
    const raw = await this.get<{ requests: any[] }>('/api/admin/b2b/requests', { params: filters })
    const list = raw.requests || []
    const mapped: B2bRequest[] = list.map((r: any) => {
      const prod = r.product || {}
      return {
        id: String(r.id),
        product_id: String(r.productId || prod.id || ''),
        status: r.status,
        note: r.requestNote || r.note || null,
        created_at: r.createdAt || r.created_at,
        from_store_id: r.requesterStore?.id ? String(r.requesterStore.id) : undefined,
        to_store_id: r.ownerStore?.id ? String(r.ownerStore.id) : undefined,
        from_store_name: r.requesterStore?.name ?? null,
        to_store_name: r.ownerStore?.name ?? null,
        product: prod.id ? {
          id: String(prod.id),
          code: prod.sku || '',
          label: prod.title || '',
          price: prod.priceTRY ?? null,
          stock: prod.quantity ?? 0,
        } : null,
      }
    })
    return { data: mapped }
  }

  createB2bRequest(data: { product_id: string; to_store_id?: string; note?: string }) {
    return this.post<B2bRequest>('/api/admin/b2b/requests', {
      productId: Number(data.product_id),
      toStoreId: data.to_store_id ? Number(data.to_store_id) : undefined,
      requestNote: data.note,
    })
  }

  updateB2bRequest(id: string, status: 'approved' | 'rejected') {
    return this.put<B2bRequest>(`/api/admin/b2b/requests/${id}`, { status })
  }

  cloneB2bRequest(id: string) {
    return this.post<B2bRequest>(`/api/admin/b2b/requests/${id}/clone`, {})
  }

  async getB2bListed() {
    const raw = await this.get<any>('/api/admin/b2b/listed')
    const products = (raw.products || []).map((lp: any) => {
      const p = lp.product || {}
      return {
        id: String(lp.id),
        code: p.sku || '',
        label: p.title || '',
        price: p.priceTRY ?? null,
        currency: 'TRY',
        stock: p.quantity ?? 0,
        store_id: String(lp.storeId ?? ''),
        store_name: lp.originalStore?.name ?? lp.original_store?.name ?? null,
        b2b_discount: null,
        b2b_price: p.priceTRY ?? null,
        is_b2b_enabled: true,
        supplier: lp.supplier ? {
          name: lp.supplier.name || '',
          ratingAvg: Number(lp.supplier.ratingAvg ?? 0),
          ratingCount: Number(lp.supplier.ratingCount ?? 0),
          ratingEnabled: lp.supplier.ratingEnabled !== false,
          maxShipmentDays: Number(lp.supplier.maxShipmentDays ?? 3),
        } : null,
      }
    })
    return { data: products }
  }

  // Slave Download
  downloadSlavePhp() {
    return this.downloadFile('/api/slave/download-php', 'rahatio-slave.php')
  }

  downloadSlaveVercel() {
    return this.downloadFile('/api/slave/download-vercel', 'rahatio-slave-vercel.zip')
  }

  // Supplier (dropshipping / B2B)
  async getSupplierProfile() {
    const r = await this.get<any>('/api/admin/supplier/profile')
    return r.supplier || r.data || r
  }

  updateSupplierProfile(data: Record<string, unknown>) {
    return this.put<{ supplier: any }>('/api/admin/supplier/profile', data)
  }

  getSupplierOrders(params?: { page?: number; status?: string }) {
    const queryParams: Record<string, string> = {}
    if (params?.page) queryParams.page = String(params.page)
    if (params?.status) queryParams.status = params.status
    return this.get<any>('/api/admin/supplier/orders', { params: Object.keys(queryParams).length ? queryParams : undefined })
  }

  supplierAcceptOrder(id: number, note?: string) {
    return this.post<{ order: any }>(`/api/admin/supplier/orders/${id}/accept`, { note })
  }

  supplierRejectOrder(id: number, note?: string) {
    return this.post<{ order: any }>(`/api/admin/supplier/orders/${id}/reject`, { note })
  }

  supplierShipOrder(id: number, trackingNumber: string, carrier?: string, note?: string) {
    return this.post<{ order: any }>(`/api/admin/supplier/orders/${id}/ship`, { trackingNumber, carrier, note })
  }

  supplierReturnOrder(id: number, note?: string) {
    return this.post<{ order: any }>(`/api/admin/supplier/orders/${id}/return`, { note })
  }

  getSupplierSettlements(params?: { page?: number }) {
    return this.get<any>('/api/admin/supplier/settlements', { params: params?.page ? { page: String(params.page) } : undefined })
  }

  getSupplierSettlementPeriod(period: string) {
    return this.get<any>('/api/admin/supplier/settlements/period', { params: { period } })
  }

  requestSupplierSettlement(period: string) {
    return this.post<{ settlement: any }>('/api/admin/supplier/settlements/request', { period })
  }

  cancelSupplierSettlement(id: number) {
    return this.post<{ settlement: any }>(`/api/admin/supplier/settlements/${id}/cancel`)
  }

  markSupplierSettlementPaid(id: number, payoutRef?: string) {
    return this.post<{ settlement: any }>(`/api/admin/supplier/settlements/${id}/mark-paid`, { payoutRef })
  }

  applySupplierApplication(documents: { taxDocument?: string; signatureDocument?: string; tradeRegistryDocument?: string }) {
    return this.post<any>('/api/admin/supplier/profile/apply', documents).then((r) => r.supplier || r.data || r)
  }

  getSupplierApplications(status?: string) {
    const params = status ? { status } : undefined
    return this.get<any>('/api/admin/supplier/applications', { params }).then((r) => r.data || r)
  }

  approveSupplierApplication(id: number) {
    return this.post<any>(`/api/admin/supplier/applications/${id}/approve`).then((r) => r.supplier || r.data || r)
  }

  rejectSupplierApplication(id: number, note?: string) {
    return this.post<any>(`/api/admin/supplier/applications/${id}/reject`, { note }).then((r) => r.supplier || r.data || r)
  }

  // Supplier ratings (buyer -> supplier)
  rateSupplier(data: { supplierId: number; orderId: number; rating: number; comment?: string }) {
    return this.post<{ rating: any }>('/api/admin/supplier/ratings', data)
  }

  getMySupplierRatings() {
    return this.get<any>('/api/admin/supplier/ratings').then((r) => r.ratings || r.data || [])
  }

  deleteMySupplierRating(id: number) {
    return this.delete<any>(`/api/admin/supplier/ratings/${id}`)
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
