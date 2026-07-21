type FetchOptions = RequestInit & {
  params?: Record<string, string | number | undefined>
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

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
    return this.get<import('./types').DashboardData>('/api/admin/dashboard')
  }

  // Store / Plan / Subscription
  getStoreMe() {
    return this.get<import('./types').StoreMeResponse>('/api/admin/store/me')
  }

  updateStoreMe(data: Partial<import('./types').Store>) {
    return this.put<import('./types').Store>('/api/admin/store/me', data)
  }

  getPlans() {
    return this.get<{ plans: import('./types').Plan[] }>('/api/admin/plans').then(r => r.plans)
  }

  getAdminPlans() {
    return this.getPlans()
  }

  getSubscription() {
    return this.get<import('./types').Subscription>('/api/admin/store/me/subscription')
  }

  changePlan(planId: number) {
    return this.post<import('./types').Subscription>('/api/admin/store/plan/change', { planId })
  }

  createCheckoutSession(planId: number, successUrl: string, cancelUrl: string) {
    return this.post<{ url: string }>('/api/admin/store/subscription/checkout', { planId, successUrl, cancelUrl })
  }

  createPortalSession(returnUrl: string) {
    return this.post<{ url: string }>('/api/admin/store/subscription/portal', { returnUrl })
  }

  cancelSubscription() {
    return this.post<{ message: string }>('/api/admin/store/subscription/cancel')
  }

  buyCredits(credits: number) {
    return this.post<{ url: string }>('/api/admin/store/subscription/purchase-credits', { credits })
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
    return this.get<import('./types').ApiKey[]>('/api/admin/store/api-keys')
  }

  createApiKey(data: { name: string; allowedIps?: string[]; expiresAt?: string }) {
    return this.post<{ key: string; keyPrefix: string; id: number }>('/api/admin/store/api-keys', data)
  }

  deleteApiKey(id: number) {
    return this.delete<void>(`/api/admin/store/api-keys/${id}`)
  }

  // Products
  getProducts(filters?: {
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
    return this.get<import('./types').PaginatedResponse<import('./types').Product>>('/api/admin/products', { params })
  }

  getProduct(id: number) {
    return this.get<import('./types').Product>(`/api/admin/products/${id}`)
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
  getProductVariants(productId: number) {
    return this.get<import('./types').ProductVariant[]>(`/api/admin/products/${productId}/variants`)
  }

  createProductVariant(productId: number, data: {
    sku: string
    attributes: Record<string, any>
    gramWeight?: number
    quantity?: number
    priceTRY?: number
    priceUSD?: number
    b2bPrice?: number
    isActive?: boolean
  }) {
    return this.post<import('./types').ProductVariant>(`/api/admin/products/${productId}/variants`, data)
  }

  updateProductVariant(variantId: number, data: Partial<import('./types').ProductVariant>) {
    return this.put<import('./types').ProductVariant>(`/api/admin/variants/${variantId}`, data)
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
    return this.get<import('./types').Category[]>(`/api/admin/categories`, { params })
  }

  getCategoryTree() {
    return this.get<import('./types').Category[]>(`/api/admin/categories/tree`)
  }

  getCategory(id: number) {
    return this.get<import('./types').Category>(`/api/admin/categories/${id}`)
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
    return this.get<import('./types').Variation[]>(`/api/admin/variations`)
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
    return this.get<import('./types').MarketplaceIntegration[]>(`/api/admin/integrations`)
  }

  getIntegration(marketplace: string) {
    return this.get<import('./types').MarketplaceIntegration>(`/api/admin/integrations/${marketplace}`)
  }

  updateIntegration(marketplace: string, data: { isActive?: boolean; config?: Record<string, any>; etsyCategoryId?: string; etsyShippingProfileId?: string }) {
    return this.put<import('./types').MarketplaceIntegration>(`/api/admin/integrations/${marketplace}`, data)
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
  getB2bDiscover(filters?: { page?: number; limit?: number; search?: string }) {
    const params: Record<string, string> = {}
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') params[k] = String(v) })
    return this.get<import('./types').PaginatedResponse<import('./types').B2bProduct>>(`/api/admin/b2b/discover`, { params })
  }

  getB2bSettings(filters?: { productId?: number } | string | number) {
    const params: Record<string, string> = {}
    if (filters && typeof filters === 'object' && 'productId' in filters) params.productId = String(filters.productId)
    else if (typeof filters === 'number' || typeof filters === 'string') params.productId = String(filters)
    return this.get<import('./types').ProductB2bSetting[]>(`/api/admin/b2b/settings`, { params })
  }

  updateB2bSetting(productId: number, data: { isB2BEnabled: boolean; b2bDiscount?: number; b2bPrice?: number }) {
    return this.put<import('./types').ProductB2bSetting>(`/api/admin/b2b/settings`, { productId, ...data })
  }

  getB2bRequests(type?: 'incoming' | 'outgoing' | 'all', status?: string) {
    const params: Record<string, string> = {}
    if (type) params.type = type
    if (status) params.status = status
    return this.get<import('./types').B2BRequest[]>(`/api/admin/b2b/requests`, { params })
  }

  createB2bRequest(data: { productId: number; variantId?: number; requestNote?: string; profitMargin?: number; marketplaces?: string[] }) {
    return this.post<import('./types').B2BRequest>(`/api/admin/b2b/requests`, data)
  }

  updateB2bRequest(id: number, data: { status: 'approved' | 'rejected'; profitMargin?: number }) {
    return this.put<import('./types').B2BRequest>(`/api/admin/b2b/requests/${id}`, data)
  }

  getB2bListed(filters?: { page?: number; limit?: number }) {
    return this.get<import('./types').PaginatedResponse<import('./types').B2BListedProduct>>(`/api/admin/b2b/listed`, { params: filters })
  }

  // Orders
  getOrders(filters?: { page?: number; limit?: number; status?: string; marketplace?: string; search?: string; dateFrom?: string; dateTo?: string }) {
    return this.get<{ orders: import('./types').DropshippingOrder[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/orders`, { params: filters })
  }

  getOrder(id: number) {
    return this.get<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}`)
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

  processImage(formData: FormData) {
    return this.upload<{ sessionId: string; message: string }>(`/api/ai/process-image`, formData)
  }

  getAiStatus(sessionId: string) {
    return this.get<{ sessionId: string; images: number; ready: string[] }>(`/api/ai/status/${sessionId}`)
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
    }>(`/api/ai/analyze-product`, formData)
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
  getSettings() {
    return this.get<import('./types').Store>(`/api/admin/store/settings`)
  }

  updateSettings(data: Partial<import('./types').Store>) {
    return this.put<import('./types').Store>(`/api/admin/store/settings`, data)
  }

  // Pages
  getPages() {
    return this.get<import('./types').Page[]>(`/api/admin/pages`)
  }

  getPage(id: number) {
    return this.get<import('./types').Page>(`/api/admin/pages/${id}`)
  }

  createPage(data: Partial<import('./types').Page>) {
    return this.post<import('./types').Page>(`/api/admin/pages`, data)
  }

  updatePage(id: number, data: Partial<import('./types').Page>) {
    return this.put<import('./types').Page>(`/api/admin/pages/${id}`, data)
  }

  deletePage(id: number) {
    return this.delete<void>(`/api/admin/pages/${id}`)
  }

  // External Feeds
  getFeeds() {
    return this.get<import('./types').ExternalFeed[]>(`/api/admin/feeds`)
  }

  getFeed(id: number) {
    return this.get<import('./types').ExternalFeed>(`/api/admin/feeds/${id}`)
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
    return this.get<import('./types').FeedSyncLog[]>(`/api/admin/feeds/${id}/logs`)
  }

  // Store Locations
  getLocations() {
    return this.get<import('./types').StoreLocation[]>(`/api/admin/locations`)
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
    return this.get<import('./types').StorePaymentMethod[]>(`/api/admin/payment-methods`)
  }

  updatePaymentMethod(method: string, data: { isActive: boolean; config?: Record<string, string> }) {
    return this.put<import('./types').StorePaymentMethod>(`/api/admin/payment-methods/${method}`, data)
  }

  // Credits
  getCreditLogs() {
    return this.get<import('./types').CreditLog[]>(`/api/admin/ai/credits/logs`)
  }

  getCreditStats() {
    return this.get<{ currentCredits: number; totalConsumed: number; totalGranted: number }>(`/api/admin/ai/credits/stats`)
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

  getStoreProducts(siteCode: string, filters?: { page?: number; limit?: number; categoryId?: number; search?: string; priceMin?: number; priceMax?: number }) {
    return this.get<import('./types').PaginatedResponse<import('./types').Product>>(`/api/store/${siteCode}/products`, { params: filters })
  }

  getStoreProduct(siteCode: string, id: number | string) {
    return this.get<import('./types').Product>(`/api/store/${siteCode}/products/${id}`)
  }

  getStoreCategories(siteCode: string) {
    return this.get<import('./types').Category[]>(`/api/store/${siteCode}/categories`)
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
      .then(r => ({ data: r.products, total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }))
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

  getCategoriesFlat() {
    return this.get<{ data: import('./types').Category[] }>('/api/admin/categories', { params: { flat: 'true' } })
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
    const formData = new FormData()
    formData.append('prompt', data.prompt)
    if (data.image_urls[0]) formData.append('imageUrl', data.image_urls[0])
    if (data.category) formData.append('category', data.category)
    return this.upload<{ sessionId: string }>(`/api/ai/process-image`, formData)
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
  getShippingSettings() {
    return this.get<import('./types').Store>('/api/admin/store/settings')
      .then(s => ({ id: s.id, method: (s as any).shippingSettings?.method || 'flat_rate', flat_rate: (s as any).shippingSettings?.flat_rate || 0, free_shipping_threshold: (s as any).shippingSettings?.free_shipping_threshold || null, zones: (s as any).shippingSettings?.zones || null, is_active: (s as any).shippingSettings?.is_active ?? true }))
  }

  updateShippingSettings(data: { method: string; flat_rate: number; is_active: boolean; free_shipping_threshold?: number }) {
    return this.put<any>('/api/admin/store/settings', { shippingSettings: data })
      .then(() => ({ id: 1, method: data.method, flat_rate: data.flat_rate, is_active: data.is_active, free_shipping_threshold: data.free_shipping_threshold ?? null, zones: null as any[] | null }))
  }

  // Super Admin
  getAdminStores() {
    return this.get<{ data: import('./types').Store[] }>('/api/admin/stores').then(r => ({ data: (r as any).stores ?? r.data ?? [] }))
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