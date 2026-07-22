type FetchOptions = RequestInit & {
  params?: Record<string, string | number | undefined>
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

function mapProduct(p: any): any {
  if (!p) return p
  return {
    ...p,
    code: p.sku ?? p.code,
    label: p.title ?? p.label,
    status: p.isActive !== undefined ? (p.isActive ? 1 : 0) : p.status,
    price: p.priceTRY ?? p.price,
    stock: p.quantity ?? p.stock,
    b2b_enabled: p.isB2BEnabled ?? p.b2b_enabled,
    b2b_discount: p.b2bDiscount ?? p.b2b_discount,
    b2b_price: p.b2bPrice ?? p.b2b_price,
  }
}

function mapPaymentMethod(p: any): any {
  if (!p) return p
  return {
    ...p,
    method: p.type ?? p.method,
    label: p.label ?? (p.type ? p.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : ''),
    is_active: p.isActive ?? p.is_active,
    created_at: p.createdAt ?? p.created_at,
    updated_at: p.updatedAt ?? p.updated_at,
  }
}

const MARKETPLACE_LABELS: Record<string, string> = {
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  pazarama: 'Pazarama',
  n11: 'N11',
  amazon: 'Amazon',
  etsy: 'Etsy',
}

const MARKETPLACE_FIELDS: Record<string, Record<string, string>> = {
  trendyol: { apiKey: 'API Anahtarı', apiSecret: 'API Secret', supplierId: 'Tedarikçi ID' },
  hepsiburada: { username: 'Kullanıcı Adı', password: 'Şifre', merchantId: 'Mağaza ID' },
  pazarama: { clientId: 'Client ID', clientSecret: 'Client Secret', apiKey: 'API Anahtar' },
  n11: { appKey: 'App Key', appSecret: 'App Secret' },
  amazon: { refreshToken: 'Refresh Token', sellerId: 'Satıcı ID', awsAccessKey: 'AWS Access Key', awsSecretKey: 'AWS Secret Key' },
  etsy: { clientId: 'Client ID', clientSecret: 'Client Secret' },
}

function mapIntegration(i: any): any {
  if (!i) return null
  return {
    ...i,
    is_active: i.isActive ?? i.is_active,
    label: MARKETPLACE_LABELS[i.marketplace] ?? i.marketplace,
    fields: MARKETPLACE_FIELDS[i.marketplace] ?? {},
  }
}

function mapPage(p: any): any {
  if (!p) return p
  return {
    ...p,
    store_id: p.storeId ?? p.store_id,
    is_active: p.isActive ?? p.is_active,
    created_at: p.createdAt ?? p.created_at,
    updated_at: p.updatedAt ?? p.updated_at,
  }
}

function mapOrder(o: any): any {
  if (!o) return o
  const address = o.shippingAddress || o.shipping_address
  return {
    ...o,
    grand_total: o.totalAmount ?? o.grand_total,
    shipping_address: typeof address === 'object' ? [address.addressLine1, address.addressLine2, address.city, address.state].filter(Boolean).join(', ') : (address || ''),
    customer_name: o.customerName || (typeof address === 'object' ? address?.name || address?.fullName || '' : ''),
    customer_email: o.customerEmail || (typeof address === 'object' ? address?.email || '' : ''),
    customer_phone: o.customerPhone || (typeof address === 'object' ? address?.phone || '' : ''),
    external_id: o.marketplaceOrderId || o.orderNumber || o.external_id,
    subtotal: o.subtotal ?? (o.totalAmount ? Number(o.totalAmount) * 0.9 : 0),
    shipping: o.shipping ?? 0,
    tax: o.tax ?? 0,
  }
}

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  getToken() {
    return this.token
  }

  private async request<T>(path: string, options: FetchOptions & { isFormData?: boolean } = {}): Promise<T> {
    const { params, isFormData, ...fetchOptions } = options
    const url = new URL(`${API_BASE}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, String(v)) })
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    }

    if (!isFormData) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const res = await fetch(url.toString(), { ...fetchOptions, headers })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(error.error || error.message || `HTTP ${res.status}`)
    }

    return res.json()
  }

  get<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  post<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined })
  }

  put<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined })
  }

  patch<T>(path: string, body?: unknown, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
  }

  upload<T>(path: string, body: FormData) {
    return this.request<T>(path, { method: 'POST', body, isFormData: true })
  }

  delete<T>(path: string, options?: FetchOptions & { body?: unknown }) {
    const { body, ...rest } = options ?? {}
    return this.request<T>(path, {
      ...rest,
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  // Auth
  login(email: string, password: string) {
    return this.post<import('./types').AuthResponse>('/api/auth/login', { email, password })
  }

  register(name: string, email: string, password: string, storeName?: string) {
    return this.post<import('./types').AuthResponse>('/api/auth/register', { name, email, password, storeName })
  }

  me() {
    return this.get<import('./types').AuthMeResponse>('/api/auth/me')
  }

  logout() {
    return this.post<void>('/api/auth/logout')
  }

  refreshToken(refreshToken: string) {
    return this.post<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', { refreshToken })
  }

  // Dashboard
  getDashboard() {
    return this.get<any>('/api/admin/dashboard').then(r => ({
      user: r.user || null,
      store: r.store || null,
      stats: {
        total_products: r.totalProducts ?? 0,
        total_orders: r.totalOrders ?? 0,
        ai_credits: r.currentCredits ?? 0,
        total_revenue: r.totalRevenue ?? 0,
        active_integrations: r.activeIntegrations ?? 0,
      },
    }))
  }

  // Store / Plan / Subscription
  getStoreMe() {
    return this.get<import('./types').StoreMeResponse>('/api/admin/me')
  }

  updateStoreMe(data: Partial<import('./types').Store>) {
    return this.put<import('./types').Store>('/api/admin/me', data)
  }

  getPlans() {
    return this.get<{ plans: import('./types').Plan[] }>('/api/admin/plans').then(r => r.plans)
  }

  getAdminPlans() {
    return this.getPlans()
  }

  async getSubscription() {
    const r = await this.get<{ subscription: import('./types').Subscription }>('/api/admin/me')
    return r.subscription
  }

  changePlan(planId: number) {
    return this.post<import('./types').Subscription>('/api/admin/plan/change', { planId })
  }

  createCheckoutSession(planId: number, successUrl: string, cancelUrl: string) {
    return this.post<{ url: string }>('/api/admin/subscription/checkout', { planId, successUrl, cancelUrl })
  }

  createPortalSession(returnUrl: string) {
    return this.post<{ url: string }>('/api/admin/subscription/portal', { returnUrl })
  }

  cancelSubscription() {
    return this.post<{ message: string }>('/api/admin/subscription/cancel')
  }

  buyCredits(credits: number) {
    return this.post<{ url: string }>('/api/admin/subscription/purchase-credits', { credits })
  }

  // Users
  getUsers() {
    return this.get<{ data: import('./types').User[]; pagination?: any }>('/api/admin/users')
  }

  getAdminUsers() {
    return this.getUsers().then(r => r.data ?? [])
  }

  createUser(data: { email: string; name: string; password: string; role: 'admin' | 'staff' }) {
    return this.post<import('./types').User>('/api/admin/users', data)
  }

  deleteUser(id: number) {
    return this.delete<void>(`/api/admin/users/${id}`)
  }

  // API Keys
  getApiKeys() {
    return this.get<import('./types').ApiKey[]>('/api/admin/api-keys')
  }

  createApiKey(data: { name: string; allowedIps?: string[]; expiresAt?: string }) {
    return this.post<{ key: string; keyPrefix: string; id: number }>('/api/admin/api-keys', data)
  }

  deleteApiKey(id: number) {
    return this.delete<void>(`/api/admin/api-keys/${id}`)
  }

  // Products
  async getProducts(filters?: {
    page?: number
    limit?: number
    status?: string
    categoryId?: number
    marketplace?: string
    priceMin?: number
    priceMax?: number
    search?: string
  }) {
    const params: Record<string, string> = {}
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params[k] = String(v) })
    }
    const r = await this.get<{ products: import('./types').Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/products', { params })
    return { data: r.products.map(mapProduct), current_page: r.pagination.page, per_page: r.pagination.limit, total: r.pagination.total, last_page: r.pagination.totalPages } as import('./types').PaginatedResponse<import('./types').Product>
  }

  async getProduct(id: number) {
    const r = await this.get<{ product: import('./types').Product }>(`/api/admin/products/${id}`)
    return mapProduct(r.product)
  }

  createProduct(data: {
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
    discountedPrice?: number
    quantity?: number
    images?: string[]
    videoUrl?: string
    marketplaces?: string[]
    marketplaceConfig?: Record<string, any>
    hasVariants?: boolean
    variantAttributes?: Record<string, any>
    tags?: string[]
  }) {
    return this.post<import('./types').Product>('/api/admin/products', data)
  }

  updateProduct(id: number, data: Partial<import('./types').Product>) {
    return this.put<import('./types').Product>(`/api/admin/products/${id}`, data)
  }

  deleteProduct(id: number) {
    return this.delete<void>(`/api/admin/products/${id}`)
  }

  bulkDeleteProducts(ids: number[]) {
    return this.post<void>('/api/admin/products/bulk-delete', { ids })
  }

  verifyProduct(id: number | string, marketplace: string) {
    return this.post<{ verified: boolean; externalId?: string; status: string; sync?: any; exists?: boolean; marketplace_product_id?: string; error?: string }>(`/api/admin/products/${id}/verify`, { marketplace })
  }

  // Product Variants
  async getProductVariants(productId: number) {
    const r = await this.get<{ variants: import('./types').ProductVariant[] }>(`/api/admin/products/${productId}/variants`)
    return r.variants
  }

  async createProductVariant(productId: number, data: {
    sku: string
    attributes: Record<string, any>
    gramWeight?: number
    quantity?: number
    priceTRY?: number
    priceUSD?: number
    b2bPrice?: number
    isActive?: boolean
  }) {
    const r = await this.post<{ variant: import('./types').ProductVariant }>(`/api/admin/products/${productId}/variants`, data)
    return r.variant
  }

  async updateProductVariant(variantId: number, data: Partial<import('./types').ProductVariant>) {
    const r = await this.put<{ variant: import('./types').ProductVariant }>(`/api/admin/variants/${variantId}`, data)
    return r.variant
  }

  deleteProductVariant(variantId: number) {
    return this.delete<void>(`/api/admin/variants/${variantId}`)
  }

  // Categories
  getCategories(filters?: { flat?: boolean; isActive?: boolean }) {
    const params: Record<string, string> = {}
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params[k] = String(v) })
    }
    return this.get<{ categories: import('./types').Category[] }>(`/api/admin/categories`, { params }).then(r => r.categories)
  }

  getCategoryTree() {
    return this.get<{ categories: import('./types').Category[] }>(`/api/admin/categories/tree`).then(r => r.categories)
  }

  getCategory(id: number) {
    return this.get<{ category: import('./types').Category }>(`/api/admin/categories/${id}`).then(r => r.category)
  }

  createCategory(data: {
    name: Record<string, string>
    slug: string
    parentId?: number
    translations?: Record<string, string>
    icon?: string
    sortOrder?: number
    isActive?: boolean
  }) {
    return this.post<import('./types').Category>('/api/admin/categories', data)
  }

  updateCategory(id: number, data: Partial<import('./types').Category>) {
    return this.put<import('./types').Category>(`/api/admin/categories/${id}`, data)
  }

  deleteCategory(id: number) {
    return this.delete<void>(`/api/admin/categories/${id}`)
  }

  getCategoryMappings(categoryId: number) {
    return this.get<import('./types').MarketplaceCategoryMapping[]>(`/api/admin/categories/${categoryId}/mappings`)
  }

  createCategoryMapping(categoryId: number, data: {
    marketplace: string
    marketplaceCategoryId: string
    name: string
    parentId?: string
  }) {
    return this.post<import('./types').MarketplaceCategoryMapping>(`/api/admin/categories/${categoryId}/mappings`, data)
  }

  updateCategoryMapping(categoryId: number, mappingId: number, data: Partial<import('./types').MarketplaceCategoryMapping>) {
    return this.put<import('./types').MarketplaceCategoryMapping>(`/api/admin/categories/${categoryId}/mappings/${mappingId}`, data)
  }

  deleteCategoryMapping(categoryId: number, mappingIdOrMarketplace: number | string) {
    return this.delete<void>(`/api/admin/categories/${categoryId}/mappings/${mappingIdOrMarketplace}`)
  }

  // Variations
  getVariations() {
    return this.get<{ variations: import('./types').Variation[] }>(`/api/admin/variations`).then(r => r.variations)
  }

  createVariation(data: { name: string; type: string; options?: { value: string; sortOrder?: number }[] }) {
    return this.post<import('./types').Variation>('/api/admin/variations', data)
  }

  updateVariation(id: number, data: { name?: string; type?: string }) {
    return this.put<import('./types').Variation>(`/api/admin/variations/${id}`, data)
  }

  deleteVariation(id: number) {
    return this.delete<void>(`/api/admin/variations/${id}`)
  }

  createVariationOption(variationId: number, data: { value: string; sortOrder?: number }) {
    return this.post<import('./types').VariationOption>(`/api/admin/variations/${variationId}/options`, data)
  }

  updateVariationOption(variationId: number, optionId: number, data: { value?: string; sortOrder?: number }) {
    return this.put<import('./types').VariationOption>(`/api/admin/variations/${variationId}/options/${optionId}`, data)
  }

  deleteVariationOption(variationId: number, optionId: number) {
    return this.delete<void>(`/api/admin/variations/${variationId}/options/${optionId}`)
  }

  // Marketplace Integrations
  getIntegrations() {
    return this.get<{ integrations: any[] }>(`/api/admin/integrations`).then(r => (r.integrations || []).map(mapIntegration))
  }

  getIntegration(marketplace: string) {
    return this.get<any>(`/api/admin/integrations/${marketplace}`).then(r => mapIntegration(r.integration ?? r))
  }

  updateIntegration(marketplace: string, data: { isActive?: boolean; config?: Record<string, any>; etsyCategoryId?: string; etsyShippingProfileId?: string }) {
    return this.put<any>(`/api/admin/integrations/${marketplace}`, data).then(r => mapIntegration(r.integration ?? r))
  }

  importIntegrationProducts(marketplace: string, maxPages = 10) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/integrations/${marketplace}/import`, { maxPages })
  }

  getImportJobStatus(jobId: string) {
    return this.get<{ jobId: string; state: string; progress: number; data: any; result: any; failedReason: string }>(`/api/admin/sync/import/${jobId}`)
  }

  syncProduct(productId: number, marketplaces?: string[]) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/sync/product/${productId}`, { marketplaces })
  }

  getMarketplaceCategories(marketplace: string) {
    return this.get<{ categories: any[] }>(`/api/admin/integrations/${marketplace}/categories`)
  }

  // B2B
  async getB2bDiscover(filters?: { page?: number; limit?: number; search?: string }) {
    const params: Record<string, string> = {}
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params[k] = String(v) })
    const raw = await this.get<any>(`/api/admin/b2b/discover`, { params })
    const products = (raw.products || []).map((p: any) => {
      const img = Array.isArray(p.images) ? p.images[0] : p.image || null
      return {
        id: String(p.id),
        product: {
          id: String(p.id),
          code: p.sku || '',
          label: p.title || '',
          status: p.isActive ? 1 : 0,
          price: p.priceTRY ?? null,
          currency: 'TRY',
          stock: p.quantity ?? null,
          image: img,
        },
        store: {
          id: p.store?.id || 0,
          name: p.store?.name || '',
          site_code: p.store?.siteCode || '',
        },
        b2b_discount: p.b2bDiscount ?? p.b2bSetting?.b2bDiscount ?? null,
        b2b_price: p.b2bPrice ?? p.b2bSetting?.b2bPrice ?? p.priceTRY ?? null,
        my_request_status: null,
        my_request_id: null,
      }
    })
    return {
      data: products,
      total: raw.pagination?.total ?? products.length,
      current_page: raw.pagination?.page ?? 1,
      last_page: raw.pagination?.totalPages ?? 1,
      per_page: raw.pagination?.limit ?? 20,
    }
  }

  async getB2bSettings(filters?: { productId?: number } | string | number) {
    const params: Record<string, string> = {}
    if (filters && typeof filters === 'object' && 'productId' in filters) params.productId = String(filters.productId)
    else if (typeof filters === 'number' || typeof filters === 'string') params.productId = String(filters)
    const raw = await this.get<{ settings: any[] }>(`/api/admin/b2b/settings`, { params })
    return (raw.settings || []).map((s: any) => {
      const prod = s.product || {}
      return {
        store_id: s.storeId,
        product_id: String(s.productId),
        is_b2b_enabled: s.isB2BEnabled,
        b2b_discount: s.b2bDiscount ?? null,
        b2b_price: s.b2bPrice ?? null,
        product: {
          id: String(prod.id || s.productId),
          code: prod.sku || '',
          label: prod.title || '',
          price: prod.priceTRY ?? null,
          stock: prod.quantity ?? null,
          image: Array.isArray(prod.images) ? prod.images[0] : null,
        },
      }
    })
  }

  async updateB2bSetting(productId: number, data: { isB2BEnabled: boolean; b2bDiscount?: number; b2bPrice?: number }) {
    const raw = await this.put<{ setting: any }>(`/api/admin/b2b/settings`, { productId, ...data })
    const s = raw.setting || {}
    return {
      store_id: s.storeId,
      product_id: String(s.productId),
      is_b2b_enabled: s.isB2BEnabled,
      b2b_discount: s.b2bDiscount ?? null,
      b2b_price: s.b2bPrice ?? null,
    }
  }

  async getB2bRequests(type?: 'incoming' | 'outgoing' | 'all', status?: string) {
    const params: Record<string, string> = {}
    if (type) params.type = type
    if (status) params.status = status
    const raw = await this.get<{ requests: any[] }>(`/api/admin/b2b/requests`, { params })
    const list = raw.requests || []
    return list.map((r: any) => {
      const prod = r.product || {}
      const img = Array.isArray(prod.images) ? prod.images[0] : null
      return {
        id: r.id,
        product_id: String(r.productId || prod.id || ''),
        product: {
          id: String(prod.id || ''),
          code: prod.sku || '',
          label: prod.title || '',
          status: prod.isActive ? 1 : 0,
          price: prod.priceTRY ?? null,
          currency: 'TRY',
          stock: prod.quantity ?? null,
          image: img,
        },
        from_store: r.requesterStore ? { id: r.requesterStore.id, name: r.requesterStore.name, site_code: r.requesterStore.siteCode } : null,
        to_store: r.ownerStore ? { id: r.ownerStore.id, name: r.ownerStore.name, site_code: r.ownerStore.siteCode } : null,
        status: r.status,
        note: r.requestNote || r.note || null,
        created_at: r.createdAt || r.created_at,
      }
    })
  }

  createB2bRequest(data: { productId: number; variantId?: number; requestNote?: string; profitMargin?: number; marketplaces?: string[] }) {
    return this.post<import('./types').B2BRequest>(`/api/admin/b2b/requests`, data)
  }

  updateB2bRequest(id: number, data: { status: 'approved' | 'rejected'; profitMargin?: number }) {
    return this.put<import('./types').B2BRequest>(`/api/admin/b2b/requests/${id}`, data)
  }

  cloneB2bProduct(requestId: number) {
    return this.post<import('./types').Product>(`/api/admin/b2b/requests/${requestId}/clone`)
  }

  async getB2bListed(filters?: { page?: number; limit?: number }) {
    const raw = await this.get<any>(`/api/admin/b2b/listed`, { params: filters })
    const products = (raw.products || []).map((lp: any) => {
      const product = lp.product || {}
      const originalStore = lp.originalStore || lp.original_store || {}
      return {
        id: lp.id,
        storeId: lp.storeId,
        originalStoreId: lp.originalStoreId,
        productId: lp.productId,
        originalProductId: lp.originalProductId,
        b2bRequestId: lp.b2bRequestId,
        profitMargin: lp.profitMargin,
        created_at: lp.createdAt || lp.created_at,
        product: {
          id: String(product.id || ''),
          code: product.sku || '',
          label: product.title || '',
          status: product.isActive ? 1 : 0,
          price: product.priceTRY ?? null,
          currency: 'TRY',
          stock: product.quantity ?? null,
          image: Array.isArray(product.images) ? product.images[0] : null,
        },
        original_store: {
          id: originalStore.id || 0,
          name: originalStore.name || '',
          site_code: originalStore.siteCode || '',
        },
      }
    })
    return {
      data: products,
      total: raw.pagination?.total ?? products.length,
      current_page: raw.pagination?.page ?? 1,
      last_page: raw.pagination?.totalPages ?? 1,
      per_page: raw.pagination?.limit ?? 20,
    }
  }

  // Orders
  async getOrders(filters?: { page?: number; limit?: number; status?: string; marketplace?: string; search?: string; dateFrom?: string; dateTo?: string }) {
    const r = await this.get<{ orders: import('./types').DropshippingOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/orders`, { params: filters })
    return { ...r, orders: r.orders.map(mapOrder) }
  }

  async getOrder(id: number) {
    const r = await this.get<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}`)
    return { order: mapOrder(r.order) }
  }

  updateOrderStatus(id: number, status: string, note?: string) {
    return this.put<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}/status`, { status, note })
  }

  updateOrderTracking(id: number, trackingNumber: string, carrier?: string) {
    return this.put<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}/tracking`, { trackingNumber, carrier })
  }

  getOrderHistory(id: number) {
    return this.get<{ history: import('./types').OrderStatusHistory[] }>(`/api/admin/orders/${id}/history`)
  }

  bulkUpdateOrderStatus(ids: number[], status: string, note?: string) {
    return this.post<{ updated: number }>(`/api/admin/orders/bulk-status`, { ids, status, note })
  }

  // Integration Webhooks
  webhookOrder(marketplace: string, payload: any) {
    return this.post<{ order: any; created: boolean }>(`/api/admin/integration/webhook/order`, { marketplace, payload })
  }

  webhookStock(marketplace: string, productId: string, quantity: number) {
    return this.post<{ success: boolean; quantity: number }>(`/api/admin/integration/webhook/stock`, { marketplace, productId, quantity })
  }

  webhookPrice(marketplace: string, productId: string, price: number) {
    return this.post<{ success: boolean; price: number }>(`/api/admin/integration/webhook/price`, { marketplace, productId, price })
  }

  // AI
  getAiCredits() {
    return this.get<{ credits: number }>(`/api/ai/credits`)
  }

  async processImage(formData: FormData) {
    const entries = Array.from(formData.entries())
    const payload: Record<string, any> = {}
    for (const [k, v] of entries) {
      if (v instanceof File) {
        if (!payload.imageUrl) {
          const uploaded = await this.uploadImage(v)
          payload.imageUrl = uploaded.url
        }
      } else {
        payload[k] = v
      }
    }
    if (!payload.category) payload.category = 'diger'
    return this.post<{ sessionId: string; message: string }>(`/api/ai/process-image`, payload)
  }

  getAiStatus(sessionId: string) {
    return this.get<{ sessionId: string; images: number; ready: string[] }>(`/api/ai/status/${sessionId}`)
  }

  async analyzeProduct(formData: FormData) {
    let imageUrl: string | undefined
    const file = formData.get('image') || formData.get('imageUrl')
    if (file instanceof File) {
      const uploaded = await this.uploadImage(file)
      imageUrl = uploaded.url
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
    }>(`/api/ai/analyze-product`, { imageUrl })
  }

  generateDescription(data: { title: string; category: string; attributes?: Record<string, any>; keywords?: string[] }) {
    return this.post<{ description: string; title: string; keywords: string[]; slug: string }>(`/api/ai/generate-description`, data)
  }

  chat(message: string, history?: { role: string; content: string }[], storeInfo?: Record<string, string>) {
    return this.post<{ reply: string }>(`/api/ai/chat`, { message, history, storeInfo })
  }

  aiChat(message: string, history?: { role: string; content: string }[], storeInfo?: Record<string, string>) {
    return this.chat(message, history, storeInfo)
  }

  search(query: string, products: any[]) {
    return this.post<{ query: string; results: any[]; count: number }>(`/api/ai/search`, { query, products })
  }

  aiSearch(query: string, products: any[]) {
    return this.search(query, products)
  }

  recommend(product: any, allProducts: any[], type?: string) {
    return this.post<{ type: string; results: any[]; count: number }>(`/api/ai/recommend`, { product, allProducts, type })
  }

  aiRecommend(product: any, allProducts: any[], type?: string) {
    return this.recommend(product, allProducts, type)
  }

  // Media Upload
  uploadImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return this.upload<{ path: string; url: string }>(`/api/admin/upload`, formData).then((r) => ({
      path: r.path,
      url: r.url && r.url.startsWith('http') ? r.url : `${API_BASE}${r.url}`,
    }))
  }

  // Settings
  async getSettings() {
    const raw = await this.get<{ store: import('./types').Store }>(`/api/admin/me`)
    return raw.store
  }

  async updateSettings(data: Partial<import('./types').Store>) {
    const raw = await this.put<import('./types').Store>(`/api/admin/me`, data)
    return raw
  }

  // Pages
  getPages() {
    return this.get<{ pages: any[] }>(`/api/admin/pages`).then(r => (r.pages || []).map(mapPage))
  }

  getPage(id: number) {
    return this.get<any>(`/api/admin/pages/${id}`).then(r => mapPage(r.page ?? r))
  }

  createPage(data: Partial<import('./types').Page>) {
    const body = { ...data, isActive: data.is_active, is_active: undefined }
    return this.post<any>(`/api/admin/pages`, body).then(r => mapPage(r.page ?? r))
  }

  updatePage(id: number, data: Partial<import('./types').Page>) {
    const body = { ...data, isActive: data.is_active, is_active: undefined }
    return this.put<any>(`/api/admin/pages/${id}`, body).then(r => mapPage(r.page ?? r))
  }

  deletePage(id: number) {
    return this.delete<void>(`/api/admin/pages/${id}`)
  }

  // External Feeds
  async getFeeds() {
    const r = await this.get<{ feeds: import('./types').ExternalFeed[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/feeds`)
    return { data: r.feeds, total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }
  }

  getFeed(id: number) {
    return this.get<{ feed: import('./types').ExternalFeed }>(`/api/admin/feeds/${id}`).then(r => r.feed)
  }

  createFeed(data: Partial<import('./types').ExternalFeed>) {
    return this.post<import('./types').ExternalFeed>(`/api/admin/feeds`, data)
  }

  updateFeed(id: number, data: Partial<import('./types').ExternalFeed>) {
    return this.put<import('./types').ExternalFeed>(`/api/admin/feeds/${id}`, data)
  }

  deleteFeed(id: number) {
    return this.delete<void>(`/api/admin/feeds/${id}`)
  }

  testFeed(id: number) {
    return this.post<import('./types').FeedTestResult>(`/api/admin/feeds/${id}/test`)
  }

  syncFeed(id: number) {
    return this.post<import('./types').FeedSyncLog>(`/api/admin/feeds/${id}/sync`)
  }

  getFeedLogs(id: number) {
    return this.get<{ logs: import('./types').FeedSyncLog[] }>(`/api/admin/feeds/${id}/logs`).then(r => r.logs)
  }

  // Store Locations
  getLocations() {
    return this.get<{ locations: import('./types').StoreLocation[] }>(`/api/admin/locations`).then(r => r.locations)
  }

  createLocation(data: Partial<import('./types').StoreLocation>) {
    return this.post<import('./types').StoreLocation>(`/api/admin/locations`, data)
  }

  updateLocation(id: number, data: Partial<import('./types').StoreLocation>) {
    return this.put<import('./types').StoreLocation>(`/api/admin/locations/${id}`, data)
  }

  deleteLocation(id: number) {
    return this.delete<void>(`/api/admin/locations/${id}`)
  }

  // Payment Methods
  getPaymentMethods() {
    return this.get<{ paymentMethods: any[] }>(`/api/admin/payment-methods`).then(r => (r.paymentMethods || []).map(mapPaymentMethod))
  }

  updatePaymentMethod(method: string, data: { isActive: boolean; config?: Record<string, string> }) {
    const body = { isActive: data.isActive, config: data.config }
    return this.put<any>(`/api/admin/payment-methods/${method}`, body).then(r => mapPaymentMethod(r.paymentMethod ?? r))
  }

  // Credits
  getCreditLogs() {
    return this.get<any>(`/api/admin/ai/credits/logs`).then(r => {
      const raw = r.logs ?? r.data ?? []
      return raw.map((log: any) => ({
        id: log.id,
        userId: log.userId,
        storeId: log.storeId,
        action: log.action,
        module: log.module,
        amount: log.amount,
        balanceBefore: log.balanceBefore,
        balanceAfter: log.balanceAfter,
        balance_before: log.balanceBefore ?? log.balance_before,
        balance_after: log.balanceAfter ?? log.balance_after,
        created_at: log.createdAt ?? log.created_at,
        createdAt: log.createdAt,
        note: log.note || '',
      }))
    })
  }

  getCreditStats() {
    return this.get<any>(`/api/admin/ai/credits/stats`).then(r => ({
      currentCredits: r.currentCredits,
      totalConsumed: r.totalConsumed,
      totalGranted: r.totalGranted,
      current_credits: r.currentCredits ?? r.current_credits,
      total_consumed: r.totalConsumed ?? r.total_consumed,
      total_granted: r.totalGranted ?? r.total_granted,
    }))
  }

  // Storefront (Public)
  getPublicBlog(type: string) {
    return this.get<{ id: number; title: string; slug: string; meta_title: string | null; meta_description: string | null; created_at: string }[]>(`/api/store/platform/pages`, { params: { type } })
  }

  getStoreFront(siteCode: string) {
    return this.get<import('./types').StoreFrontData>(`/api/store/${siteCode}`)
  }

  getAddresses(siteCode: string) {
    return this.get<any[]>(`/api/store/${siteCode}/addresses`).then(r => ({ data: Array.isArray(r) ? r : (r as any).data ?? (r as any).addresses ?? [] }))
  }

  getCheckoutPaymentMethods(siteCode: string) {
    return this.get<any[]>(`/api/store/${siteCode}/payment-methods`).then(r => ({ data: (Array.isArray(r) ? r : (r as any).data ?? r).map((m: any) => ({ method: m.method || m.name, label: m.label || m.name })) }))
  }

  async getStoreProducts(siteCode: string, filters?: { page?: number; limit?: number; categoryId?: number; search?: string; priceMin?: number; priceMax?: number }) {
    const r = await this.get<{ products: import('./types').Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/store/${siteCode}/products`, { params: filters })
    return { data: r.products.map(mapProduct), current_page: r.pagination.page, per_page: r.pagination.limit, total: r.pagination.total, last_page: r.pagination.totalPages } as import('./types').PaginatedResponse<import('./types').Product>
  }

  async getStoreProduct(siteCode: string, id: number | string) {
    const r = await this.get<{ product: import('./types').Product }>(`/api/store/${siteCode}/products/${id}`)
    return mapProduct(r.product)
  }

  async getStoreCategories(siteCode: string) {
    const r = await this.get<{ categories: import('./types').Category[] }>(`/api/store/${siteCode}/categories`)
    return r.categories
  }

  getStoreLocations(siteCode: string) {
    return this.get<import('./types').StoreLocation[]>(`/api/store/${siteCode}/locations`)
  }

  getStorePaymentMethods(siteCode: string) {
    return this.get<import('./types').StorePaymentMethod[]>(`/api/store/${siteCode}/payment-methods`)
  }

  saveAddress(siteCode: string, data: { type: string; name: string; phone: string; address: string; city: string; district: string; postalCode: string; country: string }) {
    return this.post<any>(`/api/store/${siteCode}/addresses`, data)
  }

  checkout(siteCode: string, data: Record<string, any>) {
    return this.post<{ orderId: number; orderNumber: string; message: string }>(`/api/store/${siteCode}/checkout`, data)
  }

  // Product Admin (products/page.tsx legacy interface)
  getAdminProducts(filters?: {
    page?: number; perPage?: number | 'all'; status?: '' | '1' | '0';
    marketplaces?: string[]; priceMin?: string; priceMax?: string; search?: string; b2b?: string;
  }) {
    const params: Record<string, string> = {}
    if (filters?.page) params.page = String(filters.page)
    if (filters?.perPage && filters.perPage !== 'all') params.limit = String(filters.perPage)
    if (filters?.status === '1') params.status = 'active'
    else if (filters?.status === '0') params.status = 'inactive'
    if (filters?.marketplaces?.length) params.marketplace = filters.marketplaces[0]
    if (filters?.priceMin) params.priceMin = filters.priceMin
    if (filters?.priceMax) params.priceMax = filters.priceMax
    if (filters?.search) params.search = filters.search
    return this.get<{ products: import('./types').Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/products', { params })
      .then(r => ({ data: r.products.map(mapProduct), total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }))
  }

  createAdminProduct(data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) payload.priceTRY = data.price
    if (data.stock !== undefined) payload.quantity = data.stock
    if (data.status !== undefined) payload.isActive = data.status === '1' || data.status === true
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description) payload.description = data.description
    return this.post<{ product: import('./types').Product }>('/api/admin/products', payload).then(r => r.product)
  }

  updateAdminProduct(id: string | number, data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) payload.priceTRY = data.price
    if (data.stock !== undefined) payload.quantity = data.stock
    if (data.status !== undefined) payload.isActive = data.status === '1' || data.status === true
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description !== undefined) payload.description = data.description
    return this.put<{ product: import('./types').Product }>(`/api/admin/products/${id}`, payload).then(r => r.product)
  }

  deleteAdminProduct(id: string | number) {
    return this.delete<void>(`/api/admin/products/${id}`)
  }

  deleteAdminProductsBulk(ids: string[]) {
    return this.post<{ success: boolean; deleted: number }>('/api/admin/products/bulk-delete', { ids: ids.map(Number) })
  }

  getMarketplaceTrees() {
    return this.get<{ trees: Record<string, import('./types').MarketplaceCategory[]> }>('/api/admin/integrations/marketplace-trees')
  }

  async getCategoriesFlat() {
    const r = await this.get<{ categories: import('./types').Category[] }>('/api/admin/categories', { params: { flat: 'true' } })
    return { data: r.categories }
  }

  generateProductDescription(data: { name?: string; brand?: string; category?: string; price?: number; field?: string; title?: string; attributes?: Record<string, any>; keywords?: string[] }) {
    const payload: Record<string, any> = {}
    if (data.title) payload.title = data.title
    else if (data.name) payload.title = data.name
    if (data.category) payload.category = data.category
    if (data.brand) payload.attributes = { ...payload.attributes, brand: data.brand }
    if (data.price) payload.attributes = { ...payload.attributes, price: data.price }
    if (data.attributes) payload.attributes = { ...payload.attributes, ...data.attributes }
    if (data.keywords) payload.keywords = data.keywords
    return this.post<{ description: string; title: string; keywords: string[]; slug: string }>('/api/ai/generate-description', payload)
  }

  editProductImage(data: { image_urls: string[]; prompt: string; category?: string }) {
    return this.post<{ sessionId: string }>(`/api/ai/process-image`, { imageUrl: data.image_urls[0], prompt: data.prompt, category: data.category || 'diger' })
  }

  getAiOutputUrl(sessionId: string, filename: string) {
    return `${API_BASE}/api/ai/output/${sessionId}/${filename}`
  }

  updateB2bSettings(data: { product_id: string | number; is_b2b_enabled: boolean; b2b_discount: number | null; b2b_price: number | null }) {
    return this.put<any>('/api/admin/b2b/settings', {
      productId: Number(data.product_id),
      isB2BEnabled: data.is_b2b_enabled,
      b2bDiscount: data.b2b_discount,
      b2bPrice: data.b2b_price,
    })
  }

  // API Keys (admin interface)
  getAdminApiKeys() {
    return this.get<{ keys: import('./types').ApiKey[] }>('/api/admin/api-keys').then(r => r.keys)
  }

  createAdminApiKey(data: { name: string }) {
    return this.post<{ key: string; keyPrefix: string; id: number }>('/api/admin/api-keys', data)
      .then(r => ({ plain_text: r.key, api_key: { id: r.id, name: data.name, keyPrefix: r.keyPrefix } as any }))
  }

  deleteAdminApiKey(id: number) {
    return this.delete<void>(`/api/admin/api-keys/${id}`)
  }

  // Shipping
  async getShippingSettings() {
    const raw = await this.get<{ store: any }>('/api/admin/me')
    const s = raw.store
    const ss = s.shippingSettings || {}
    return { id: s.id, method: ss.method || 'flat_rate', flat_rate: ss.flat_rate || 0, free_shipping_threshold: ss.free_shipping_threshold || null, zones: ss.zones || null, is_active: ss.is_active ?? true }
  }

  async updateShippingSettings(data: { method: string; flat_rate: number; is_active: boolean; free_shipping_threshold?: number }) {
    const raw = await this.put<{ store: any }>('/api/admin/me', { shippingSettings: data })
    return { id: raw.store?.id || 1, method: data.method, flat_rate: data.flat_rate, is_active: data.is_active, free_shipping_threshold: data.free_shipping_threshold ?? null, zones: null as any[] | null }
  }

  // Super Admin
  getAdminStores() {
    return this.get<{ data: import('./types').Store[] }>('/api/admin/stores').then(r => ({
      data: ((r as any).stores ?? r.data ?? []).map((s: any) => ({
        ...s,
        site_code: s.siteCode ?? s.site_code,
        is_active: s.isActive ?? s.is_active,
        tax_settings: s.taxSettings ?? s.tax_settings,
        shipping_settings: s.shippingSettings ?? s.shipping_settings,
      }))
    }))
  }

  updateAdminUser(id: number, data: Record<string, any>) {
    return this.put<any>(`/api/admin/users/${id}`, data)
  }

  assignPlanToUser(userId: number, planId: number) {
    return this.post<{ message: string }>(`/api/admin/users/${userId}/assign-plan`, { planId })
  }

  createAdminPlan(data: Record<string, any>) {
    return this.post<any>('/api/admin/plans', data)
  }

  updateAdminPlan(id: number, data: Record<string, any>) {
    return this.put<any>(`/api/admin/plans/${id}`, data)
  }

  deleteAdminPlan(id: number) {
    return this.delete<void>(`/api/admin/plans/${id}`)
  }

  // Store Menu
  getMenus() {
    return this.get<{ menus: import('./types.js').StoreMenu[] }>('/api/admin/menus').then(r => r.menus)
  }

  getMenu(id: number) {
    return this.get<{ menu: import('./types.js').StoreMenu }>(`/api/admin/menus/${id}`).then(r => r.menu)
  }

  createMenu(data: { name: string; slug: string; items?: any[]; location?: string; isActive?: boolean }) {
    return this.post<{ menu: import('./types.js').StoreMenu }>('/api/admin/menus', data).then(r => r.menu)
  }

  updateMenu(id: number, data: Partial<{ name: string; slug: string; items: any[]; location: string; isActive: boolean }>) {
    return this.put<{ menu: import('./types.js').StoreMenu }>(`/api/admin/menus/${id}`, data).then(r => r.menu)
  }

  deleteMenu(id: number) {
    return this.delete<void>(`/api/admin/menus/${id}`)
  }

  // Slave Download
  downloadSlavePhp() {
    return this.download('/api/admin/slave/download-php')
  }

  downloadSlaveVercel() {
    return this.download('/api/admin/slave/download-vercel')
  }

  private download(path: string) {
    const url = new URL(`${API_BASE}${path}`)
    if (this.token) {
      url.searchParams.set('token', this.token)
    }
    window.open(url.toString(), '_blank')
  }
}

export const api = new ApiClient()