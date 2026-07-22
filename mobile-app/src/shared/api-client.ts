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
  async getAdminProducts(filters?: {
    marketplaces?: string[]
    status?: '' | '1' | '0'
    priceMin?: string | number
    priceMax?: string | number
    page?: number
    perPage?: number | 'all'
    b2b?: '' | '1' | '0'
  }) {
    const params: Record<string, string> = {}
    if (filters?.marketplaces?.length) params.marketplace = filters.marketplaces[0]
    if (filters?.status === '1') params.status = 'active'
    else if (filters?.status === '0') params.status = 'inactive'
    if (filters?.b2b) params.b2b = filters.b2b
    if (filters?.priceMin !== undefined && filters.priceMin !== '') params.priceMin = String(filters.priceMin)
    if (filters?.priceMax !== undefined && filters.priceMax !== '') params.priceMax = String(filters.priceMax)
    if (filters?.page) params.page = String(filters.page)
    if (filters?.perPage && filters.perPage !== 'all') params.limit = String(filters.perPage)
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

  async getCategoriesFlat() {
    const r = await this.get<{ categories: Category[] }>('/api/admin/categories', { params: { flat: 'true' } })
    return { data: r.categories }
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
    return this.get<{ sessionId: string; images: number; ready: string[] }>(`/api/ai/status/${sessionId}`)
  }

  getAiOutputUrl(sessionId: string, file: string) {
    return `${API_BASE}/api/ai/output/${encodeURIComponent(sessionId)}/${encodeURIComponent(file)}`
  }

  // Admin Orders (storefront / Aimeos)
  async getAdminOrders() {
    const r = await this.get<{ orders: Order[]; pagination: { total: number } }>('/api/admin/orders')
    return { data: (r.orders || []).map(this.mapOrder), total: r.pagination.total }
  }

  async getAdminOrder(id: string) {
    const r = await this.get<{ order: Order }>(`/api/admin/orders/${id}`)
    return this.mapOrder(r.order)
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
  async getSettings() {
    const r = await this.get<{ store: Store }>('/api/admin/me')
    return r.store
  }

  updateSettings(data: Partial<Store>) {
    return this.put<Store>('/api/admin/me', data)
  }

  // AI
  async processImage(formData: FormData) {
    const entries = Array.from((formData as any).entries?.() ?? [])
    const payload: Record<string, any> = {}
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && v.uri) {
        if (!payload.imageUrl) {
          const uploaded = await this.uploadImage(v.uri, v.name || 'photo.jpg', v.type || 'image/jpeg')
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
    const entries = Array.from((formData as any).entries?.() ?? [])
    for (const [k, v] of entries) {
      if (v && typeof v === 'object' && v.uri) {
        const uploaded = await this.uploadImage(v.uri, v.name || 'photo.jpg', v.type || 'image/jpeg')
        imageUrl = uploaded.url
      } else if (k === 'category') {
        category = v
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
  async getB2bDiscover(params?: { page?: number; search?: string }) {
    const filters: Record<string, string> = {}
    if (params?.page) filters.page = String(params.page)
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
      }
    })
    return { data: products }
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