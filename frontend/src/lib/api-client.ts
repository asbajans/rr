type FetchOptions = RequestInit & {
  params?: Record<string, string>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

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
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
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
    return this.get<import('./types').Plan[]>('/api/admin/plans')
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

  // Users
  getUsers() {
    return this.get<import('./types').User[]>('/api/admin/store/users')
  }

  createUser(data: { email: string; name: string; password: string; role: 'admin' | 'staff' }) {
    return this.post<import('./types').User>('/api/admin/store/users', data)
  }

  deleteUser(id: number) {
    return this.delete<void>(`/api/admin/store/users/${id}`)
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
    return this.get<import('./types').PaginatedResponse<import('./types').Product>>('/api/admin/products', { params: filters })
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

  verifyProduct(id: number, marketplace: string) {
    return this.post<{ verified: boolean; externalId?: string; status: string }>(`/api/admin/products/${id}/verify`, { marketplace })
  }

  syncProduct(id: number, marketplaces?: string[]) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/products/${id}/sync`, { marketplaces })
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
    return this.get<import('./types').Category[]>(`/api/admin/categories`, { params: filters })
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

  deleteCategoryMapping(categoryId: number, mappingId: number) {
    return this.delete<void>(`/api/admin/categories/${categoryId}/mappings/${mappingId}`)
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
    return this.get<import('./types').PaginatedResponse<import('./types').B2bProduct>>(`/api/admin/b2b/discover`, { params: filters })
  }

  getB2bSettings(filters?: { productId?: number }) {
    return this.get<import('./types').ProductB2bSetting[]>(`/api/admin/b2b/settings`, { params: filters })
  }

  updateB2bSetting(productId: number, data: { isB2BEnabled: boolean; b2bDiscount?: number; b2bPrice?: number }) {
    return this.put<import('./types').ProductB2bSetting>(`/api/admin/b2b/settings`, { productId, ...data })
  }

  getB2bRequests(type?: 'incoming' | 'outgoing' | 'all', status?: string) {
    return this.get<import('./types').B2BRequest[]>(`/api/admin/b2b/requests`, { params: { type, status } })
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
    return this.get<import('./types').PaginatedResponse<import('./types').DropshippingOrder>>(`/api/admin/orders`, { params: filters })
  }

  getOrder(id: number) {
    return this.get<import('./types').DropshippingOrder>(`/api/admin/orders/${id}`)
  }

  updateOrderStatus(id: number, status: string, note?: string) {
    return this.put<import('./types').DropshippingOrder>(`/api/admin/orders/${id}/status`, { status, note })
  }

  updateOrderTracking(id: number, trackingNumber: string, carrier?: string) {
    return this.put<import('./types').DropshippingOrder>(`/api/admin/orders/${id}/tracking`, { trackingNumber, carrier })
  }

  getOrderHistory(id: number) {
    return this.get<import('./types').OrderStatusHistory[]>(`/api/admin/orders/${id}/history`)
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

  search(query: string, products: any[]) {
    return this.post<{ query: string; results: any[]; count: number }>(`/api/ai/search`, { query, products })
  }

  recommend(product: any, allProducts: any[], type?: string) {
    return this.post<{ type: string; results: any[]; count: number }>(`/api/ai/recommend`, { product, allProducts, type })
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
  getStoreFront(siteCode: string) {
    return this.get<import('./types').StoreFrontData>(`/api/store/${siteCode}`)
  }

  getStoreProducts(siteCode: string, filters?: { page?: number; limit?: number; categoryId?: number; search?: string; priceMin?: number; priceMax?: number }) {
    return this.get<import('./types').PaginatedResponse<import('./types').Product>>(`/api/store/${siteCode}/products`, { params: filters })
  }

  getStoreProduct(siteCode: string, id: number) {
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

  checkout(siteCode: string, data: { items: any[]; shippingAddress: any; paymentMethod: string }) {
    return this.post<{ orderId: number; orderNumber: string; message: string }>(`/api/store/${siteCode}/checkout`, data)
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