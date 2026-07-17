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

  register(name: string, email: string, password: string, store_name?: string) {
    return this.post<import('./types').AuthResponse>('/api/auth/register', { name, email, password, store_name })
  }

  me() {
    return this.get<import('./types').User>('/api/auth/me')
  }

  logout() {
    return this.post<void>('/api/auth/logout')
  }

  // Dashboard
  getDashboard() {
    return this.get<import('./types').DashboardData>('/api/admin/dashboard')
  }

  // Admin Stores
  getAdminStores(page = 1) {
    return this.get<import('./types').PaginatedResponse<import('./types').Store>>(`/api/admin/stores?page=${page}`)
  }

  getAdminStore(id: number) {
    return this.get<import('./types').Store>(`/api/admin/stores/${id}`)
  }

  createAdminStore(data: Partial<import('./types').Store>) {
    return this.post<import('./types').Store>('/api/admin/stores', data)
  }

  updateAdminStore(id: number, data: Partial<import('./types').Store>) {
    return this.put<import('./types').Store>(`/api/admin/stores/${id}`, data)
  }

  deleteAdminStore(id: number) {
    return this.delete<void>(`/api/admin/stores/${id}`)
  }

  // Admin Users
  getAdminUsers(page = 1) {
    return this.get<import('./types').PaginatedResponse<import('./types').User>>(`/api/admin/users?page=${page}`)
  }

  getAdminUser(id: number) {
    return this.get<import('./types').User>(`/api/admin/users/${id}`)
  }

  updateAdminUser(id: number, data: Partial<import('./types').User>) {
    return this.put<import('./types').User>(`/api/admin/users/${id}`, data)
  }

  deleteAdminUser(id: number) {
    return this.delete<void>(`/api/admin/users/${id}`)
  }

  // Admin Plans
    assignPlanToUser(userId: number, planId: number) {
        return this.post<{ message: string }>('/api/admin/subscription/assign', {
            user_id: userId,
            plan_id: planId,
        })
    }

    getAdminPlans() {
    return this.get<import('./types').Plan[]>('/api/admin/plans')
  }

  getAdminPlan(id: number) {
    return this.get<import('./types').Plan>(`/api/admin/plans/${id}`)
  }

  createAdminPlan(data: Partial<import('./types').Plan>) {
    return this.post<import('./types').Plan>('/api/admin/plans', data)
  }

  updateAdminPlan(id: number, data: Partial<import('./types').Plan>) {
    return this.put<import('./types').Plan>(`/api/admin/plans/${id}`, data)
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
    b2b?: '1' | '0'
  }) {
    const params = new URLSearchParams()
    if (filters?.marketplaces?.length) params.set('marketplaces', filters.marketplaces.join(','))
    if (filters?.status) params.set('status', filters.status)
    if (filters?.priceMin !== undefined && filters.priceMin !== '') params.set('price_min', String(filters.priceMin))
    if (filters?.priceMax !== undefined && filters.priceMax !== '') params.set('price_max', String(filters.priceMax))
    if (filters?.b2b) params.set('b2b', filters.b2b)
    if (filters?.page) params.set('page', String(filters.page))
    if (filters?.perPage) params.set('per_page', String(filters.perPage))
    const qs = params.toString()
    return this.get<{
      data: import('./types').Product[]
      total: number
      page: number
      per_page: number
      last_page: number
    }>(`/api/admin/products${qs ? '?' + qs : ''}`)
  }

  getAdminProduct(id: string) {
    return this.get<import('./types').Product>(`/api/admin/products/${id}`)
  }

  getProductTaxonomies() {
    return this.get<{ categories: Record<string, string[]>; brands: Record<string, string[]> }>('/api/admin/products/taxonomies')
  }

  createAdminProduct(data: { code: string; label: string; price?: number; stock?: number; status?: number; description?: string; media_urls?: string[]; marketplaces?: string[]; marketplace_data?: Record<string, import('./types').MarketplaceEntry> }) {
    return this.post<import('./types').Product>('/api/admin/products', data)
  }

  updateAdminProduct(id: string, data: { label?: string; price?: number; stock?: number; status?: number; description?: string; media_urls?: string[]; marketplaces?: string[]; marketplace_data?: Record<string, import('./types').MarketplaceEntry> }) {
    return this.put<import('./types').Product>(`/api/admin/products/${id}`, data)
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
      detail?: unknown
      sync?: import('./types').MarketplaceSyncEntry | null
    }>(`/api/admin/products/${id}/verify`, { marketplace })
  }

  // Admin Orders
  getAdminOrders() {
    return this.get<{ data: import('./types').Order[]; total: number }>('/api/admin/orders')
  }

  getAdminOrder(id: string) {
    return this.get<import('./types').Order>(`/api/admin/orders/${id}`)
  }

  getDropshippingOrders(params?: { status?: string }) {
    const qs = params?.status ? `?status=${params.status}` : ''
    return this.get<{ data: import('./types').DropshippingOrder[] }>(`/api/admin/orders/dropshipping${qs}`)
  }

  getDropshippingOrder(id: number) {
    return this.get<import('./types').DropshippingOrderDetail>(`/api/admin/orders/dropshipping/${id}`)
  }

  updateOrderStatus(id: number, status: string, note?: string) {
    return this.put<import('./types').DropshippingOrderDetail>(`/api/admin/orders/dropshipping/${id}/status`, { status, note })
  }

  updateOrderTracking(id: number, tracking_number: string, tracking_company?: string) {
    return this.put<import('./types').DropshippingOrderDetail>(`/api/admin/orders/dropshipping/${id}/tracking`, { tracking_number, tracking_company })
  }

  getOrderStats() {
    return this.get<{ data: { status: string; label: string; color: string; count: number }[] }>('/api/admin/orders/stats')
  }

  // Admin API Keys
  getAdminApiKeys() {
    return this.get<import('./types').ApiKey[]>('/api/admin/api-keys')
  }

  createAdminApiKey(data: { name: string }) {
    return this.post<{ api_key: import('./types').ApiKey; plain_text: string }>('/api/admin/api-keys', data)
  }

  deleteAdminApiKey(id: number) {
    return this.delete<void>(`/api/admin/api-keys/${id}`)
  }

  // Settings
  getSettings() {
    return this.get<import('./types').Store>('/api/admin/settings')
  }

  updateSettings(data: Partial<import('./types').Store>) {
    return this.put<import('./types').Store>('/api/admin/settings', data)
  }

  // Media Upload
  uploadImage(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return this.upload<{ path: string; url: string }>('/api/admin/upload', formData).then((r) => ({
      path: r.path,
      url: r.url && r.url.startsWith('http') ? r.url : `${API_BASE}${r.url}`,
    }))
  }

  // Store Frontend (public)
  getStoreFront(siteCode: string) {
    return this.get<import('./types').StoreFrontData>(`/api/store/${siteCode}`)
  }

  getStoreProduct(siteCode: string, id: string) {
    return this.get<import('./types').StoreProduct>(`/api/store/${siteCode}/products/${id}`)
  }

  getPublicBlog(siteCode: string) {
    return this.get<{ id: number; title: string; slug: string; meta_title: string | null; meta_description: string | null; created_at: string }[]>(`/api/store/${siteCode}/blog`)
  }

  getPublicBlogPost(siteCode: string, slug: string) {
    return this.get<{ id: number; title: string; slug: string; content: string; meta_title: string | null; meta_description: string | null; created_at: string }>(`/api/store/${siteCode}/blog/${slug}`)
  }

  // AI
  processImage(formData: FormData) {
    return this.upload<{ url?: string; sessionId?: string; message?: string }>('/api/ai/process-image', formData)
  }

  getAiStatus(sessionId: string) {
    return this.get<{ sessionId: string; images: number; ready: string[] }>(`/api/ai/status/${sessionId}`)
  }

  generateProductDescription(data: { name: string; brand?: string; category?: string; price?: number; keywords?: string; field?: 'description' | 'title' }) {
    return this.post<{ description?: string; title?: string }>('/api/ai/generate-description', data)
  }

  editProductImage(data: { image_urls: string[]; prompt: string; category?: string }) {
    return this.post<{ sessionId: string; message?: string }>('/api/ai/edit-image', data)
  }

  getAiOutputUrl(sessionId: string, file: string) {
    return `${API_BASE}/api/ai/output/${encodeURIComponent(sessionId)}/${encodeURIComponent(file)}`
  }

  aiChat(message: string, history?: { role: string; content: string }[], storeInfo?: Record<string, string>) {
    return this.post<{ reply: string }>('/api/ai/chat', { message, history, storeInfo })
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

  aiSearch(query: string, products: any[]) {
    return this.post<{ query: string; results: any[]; count: number }>('/api/ai/search', { query, products })
  }

  aiRecommend(product: any, allProducts: any[], type?: string) {
    return this.post<{ type: string; results: any[]; count: number }>('/api/ai/recommend', { product, allProducts, type })
  }

  // Shipping
  getShippingSettings() {
    return this.get<{ id: number; store_id: number; method: string; flat_rate: number; free_shipping_threshold: number | null; zones: any[] | null; is_active: boolean }>('/api/admin/shipping')
  }

  updateShippingSettings(data: Record<string, any>) {
    return this.put<{ id: number; store_id: number; method: string; flat_rate: number; free_shipping_threshold: number | null; zones: any[] | null; is_active: boolean }>('/api/admin/shipping', data)
  }

  // Pages
  getAdminPages() {
    return this.get<import('./types').Page[]>('/api/admin/pages')
  }

  getAdminPage(id: number) {
    return this.get<import('./types').Page>(`/api/admin/pages/${id}`)
  }

  createAdminPage(data: Partial<import('./types').Page>) {
    return this.post<import('./types').Page>('/api/admin/pages', data)
  }

  updateAdminPage(id: number, data: Partial<import('./types').Page>) {
    return this.put<import('./types').Page>(`/api/admin/pages/${id}`, data)
  }

  deleteAdminPage(id: number) {
    return this.delete<void>(`/api/admin/pages/${id}`)
  }

  // Credits
  getCreditLogs() {
    return this.get<{ id: number; action: string; module: string | null; amount: number; balance_before: number; balance_after: number; note: string | null; created_at: string }[]>('/api/admin/credits')
  }

  getCreditStats() {
    return this.get<{ current_credits: number; total_consumed: number; total_granted: number }>('/api/admin/credits/stats')
  }

  buyCredits(credits: number) {
    return this.post<{ url: string }>('/api/admin/subscription/purchase-credits', { credits })
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

  // Subscription
  getSubscription() {
    return this.get<{ subscription: import('./types').Subscription | null; plan: import('./types').Plan | null }>('/api/admin/subscription')
  }

  createCheckoutSession(planId: number, successUrl?: string, cancelUrl?: string) {
    return this.post<{ url: string }>('/api/admin/subscription/checkout', { plan_id: planId, success_url: successUrl, cancel_url: cancelUrl })
  }

  createPortalSession(returnUrl?: string) {
    return this.post<{ url: string }>('/api/admin/subscription/portal', { return_url: returnUrl })
  }

  cancelSubscription() {
    return this.post<{ message: string }>('/api/admin/subscription/cancel')
  }

  // Categories
  getCategories() {
    return this.get<{ data: import('./types').Category[] }>('/api/admin/categories')
  }

  getCategoryTree() {
    return this.get<{ data: import('./types').Category[] }>('/api/admin/categories/tree')
  }

  getCategoryFlat() {
    return this.get<{ data: import('./types').Category[] }>('/api/admin/categories/flat')
  }

  getCategory(id: number) {
    return this.get<import('./types').Category>(`/api/admin/categories/${id}`)
  }

  createCategory(data: { slug: string; name: string; parent_id?: number | null; translations?: Record<string, string> | null; icon?: string; sort_order?: number; is_active?: boolean }) {
    return this.post<import('./types').Category>('/api/admin/categories', data)
  }

  updateCategory(id: number, data: Partial<import('./types').Category>) {
    return this.put<import('./types').Category>(`/api/admin/categories/${id}`, data)
  }

  deleteCategory(id: number) {
    return this.delete<void>(`/api/admin/categories/${id}`)
  }

  getCategoriesFlat() {
    return this.get<{ data: import('./types').Category[] }>('/api/admin/categories/flat')
  }

  getCategoryMappings(id: number) {
    return this.get<{ data: import('./types').MarketplaceMapping[] }>(`/api/admin/categories/${id}/mappings`)
  }

  updateCategoryMapping(id: number, data: { marketplace: string; marketplace_category_id: string; marketplace_category_name: string; marketplace_parent_id?: string }) {
    return this.post<import('./types').MarketplaceMapping>(`/api/admin/categories/${id}/mappings`, data)
  }

  deleteCategoryMapping(id: number, marketplace: string) {
    return this.delete<void>(`/api/admin/categories/${id}/mappings/${marketplace}`)
  }

  // External Feeds
  getFeeds() {
    return this.get<{ data: import('./types').ExternalFeed[] }>('/api/admin/feeds')
  }

  getFeed(id: number) {
    return this.get<import('./types').ExternalFeed>(`/api/admin/feeds/${id}`)
  }

  createFeed(data: Partial<import('./types').ExternalFeed>) {
    return this.post<import('./types').ExternalFeed>('/api/admin/feeds', data)
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
    return this.get<{ data: import('./types').FeedSyncLog[] }>(`/api/admin/feeds/${id}/logs`)
  }

  // Store Locations
  getLocations() {
    return this.get<{ data: import('./types').StoreLocation[] }>('/api/admin/locations')
  }

  createLocation(data: Partial<import('./types').StoreLocation>) {
    return this.post<import('./types').StoreLocation>('/api/admin/locations', data)
  }

  updateLocation(id: number, data: Partial<import('./types').StoreLocation>) {
    return this.put<import('./types').StoreLocation>(`/api/admin/locations/${id}`, data)
  }

  deleteLocation(id: number) {
    return this.delete(`/api/admin/locations/${id}`)
  }

  getStoreLocations(siteCode: string) {
    return this.get<{ data: import('./types').StoreLocation[] }>(`/api/store/${siteCode}/locations`)
  }

  // Checkout / Store Endpoints
  getAddresses(siteCode: string) {
    return this.get<{ data: import('./types').CustomerAddress[] }>(`/api/store/${siteCode}/addresses`)
  }

  storeAddress(siteCode: string, data: Partial<import('./types').CustomerAddress> & { full_name: string; phone: string; city: string; address_line: string }) {
    return this.post<import('./types').CustomerAddress>(`/api/store/${siteCode}/addresses`, data)
  }

  deleteAddress(siteCode: string, id: number) {
    return this.delete(`/api/store/${siteCode}/addresses/${id}`)
  }

  checkout(siteCode: string, data: import('./types').CheckoutPayload) {
    return this.post<{ success: boolean; order_id: string; total: number }>(`/api/store/${siteCode}/checkout`, data)
  }

  getCheckoutPaymentMethods(siteCode: string) {
    return this.get<{ data: { method: string; label: string }[] }>(`/api/store/${siteCode}/checkout/payment-methods`)
  }

  // Marketplace Integrations
  getIntegrations() {
    return this.get<{ data: import('./types').MarketplaceIntegration[] }>('/api/admin/integrations')
  }

  updateIntegration(marketplace: string, data: { is_active: boolean; config?: Record<string, string> }) {
    return this.put<import('./types').MarketplaceIntegration>(`/api/admin/integrations/${marketplace}`, data)
  }

  importIntegrationProducts(marketplace: string, maxPages = 5) {
    return this.post<{
      id: number
      marketplace: string
      status: 'pending' | 'processing' | 'done' | 'failed'
    }>(`/api/admin/integrations/${marketplace}/import`, { max_pages: maxPages })
  }

  importMarketplaceCategories(marketplace: string) {
    return this.post<{ marketplace: string; status: 'processing' }>(`/api/admin/integrations/${marketplace}/categories`, {})
  }

  getMarketplaceCategoryImportStatus(marketplace: string) {
    return this.get<{ status: 'idle' | 'processing' | 'done' | 'failed'; imported?: number; error?: string; message?: string }>(`/api/admin/integrations/${marketplace}/categories/status`)
  }

  getMarketplaceCategories(marketplace: string) {
    return this.get<{ data: import('./types').MarketplaceCategory[] }>(`/api/admin/integrations/${marketplace}/categories`)
  }

  getMarketplaceTrees() {
    return this.get<{ trees: Record<string, import('./types').MarketplaceCategory[]> }>('/api/admin/integrations/marketplace-trees')
  }

  getMarketplaceImportStatus(marketplace: string, id: number) {
    return this.get<{
      id: number
      marketplace: string
      status: 'pending' | 'processing' | 'done' | 'failed'
      summary?: { total: number; imported: number; updated: number; failed: number; errors: string[]; fetched?: number; message?: string }
      error?: string
      fetched?: number
    }>(`/api/admin/integrations/${marketplace}/import/${id}`)
  }

  // Variations
  // Payment Methods
  getPaymentMethods() {
    return this.get<{ data: import('./types').StorePaymentMethod[] }>('/api/admin/payment-methods')
  }

  getPaymentMethod(method: string) {
    return this.get<import('./types').StorePaymentMethod>(`/api/admin/payment-methods/${method}`)
  }

  updatePaymentMethod(method: string, data: { is_active: boolean; config?: Record<string, string> }) {
    return this.put<import('./types').StorePaymentMethod>(`/api/admin/payment-methods/${method}`, data)
  }

  getStorePaymentMethods(siteCode: string) {
    return this.get<{ data: { method: string; label: string; public: Record<string, string> }[] }>(`/api/store/${siteCode}/payment-methods`)
  }

  // Variations
  getVariations() {
    return this.get<{ data: import('./types').Variation[] }>('/api/admin/variations')
  }

  createVariation(data: { name: string; type: string; options?: { value: string; sort_order?: number }[] }) {
    return this.post<import('./types').Variation>('/api/admin/variations', data)
  }

  updateVariation(id: number, data: { name?: string; type?: string; options?: { value: string; sort_order?: number }[] }) {
    return this.put<import('./types').Variation>(`/api/admin/variations/${id}`, data)
  }

  deleteVariation(id: number) {
    return this.delete<void>(`/api/admin/variations/${id}`)
  }

  getProductVariants(productId: string) {
    return this.get<{ data: import('./types').ProductVariant[] }>(`/api/admin/products/${productId}/variants`)
  }

  createProductVariant(data: { product_id: string; sku: string; price?: number; stock?: number; attributes?: Record<string, string>; image?: string }) {
    return this.post<import('./types').ProductVariant>(`/api/admin/products/${data.product_id}/variants`, data)
  }

  updateProductVariant(productId: string, variantId: number, data: { sku?: string; price?: number; stock?: number; attributes?: Record<string, string>; image?: string; is_active?: boolean }) {
    return this.put<import('./types').ProductVariant>(`/api/admin/products/${productId}/variants/${variantId}`, data)
  }

  deleteProductVariant(productId: string, variantId: number) {
    return this.delete<void>(`/api/admin/products/${productId}/variants/${variantId}`)
  }

  // B2B
  getB2bDiscover(page = 1, search?: string) {
    const params: Record<string, string> = { page: String(page) }
    if (search) params.search = search
    return this.get<{ data: import('./types').B2bProductItem[]; total: number; current_page: number; last_page: number; per_page: number }>('/api/b2b/discover', { params })
  }

  getB2bSettings(productId?: string) {
    const path = productId ? `/api/b2b/settings/${productId}` : '/api/b2b/settings'
    return this.get<import('./types').B2bSetting | { data: import('./types').B2bSetting[] }>(path)
  }

  updateB2bSettings(data: { product_id: string; is_b2b_enabled: boolean; b2b_discount?: number | null; b2b_price?: number | null }) {
    return this.put<import('./types').B2bSetting>('/api/b2b/settings', data)
  }

  getB2bRequests(type: 'incoming' | 'outgoing', status?: string) {
    const params: Record<string, string> = { type }
    if (status) params.status = status
    return this.get<{ data: import('./types').B2bRequestItem[]; total: number; current_page: number; last_page: number; per_page: number }>('/api/b2b/requests', { params })
  }

  createB2bRequest(data: { product_id: string; to_store_id: number; note?: string }) {
    return this.post<import('./types').B2bRequestItem>('/api/b2b/requests', data)
  }

  updateB2bRequest(id: number, status: 'approved' | 'rejected') {
    return this.put<import('./types').B2bRequestItem>(`/api/b2b/requests/${id}`, { status })
  }

  cloneB2bProduct(requestId: number) {
    return this.post<{ message: string; product_id: string; code: string }>(`/api/b2b/requests/${requestId}/clone`)
  }

  getB2bListed() {
    return this.get<{ data: { id: number; product: import('./types').B2bProductItem['product'] | null; original_product: import('./types').B2bProductItem['product'] | null; original_store: import('./types').B2bStoreInfo | null; created_at: string }[] }>('/api/b2b/listed')
  }
}

export const api = new ApiClient()
