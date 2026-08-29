type FetchOptions = RequestInit & {
  params?: Record<string, string | number | undefined>
  customerAuth?: boolean
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

function mapProduct(p: any): any {
  if (!p) return p
  const hasTRY = p.priceTRY !== null && p.priceTRY !== undefined
  const hasUSD = p.priceUSD !== null && p.priceUSD !== undefined
  const marketplaceConfig = p.marketplaceConfig ?? p.marketplace_config ?? p.marketplace_data ?? {}
  const marketplaceEntry = typeof marketplaceConfig === 'object' && marketplaceConfig !== null
    ? Object.values(marketplaceConfig as Record<string, any>)[0] as any
    : undefined

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
    brand: p.brand ?? marketplaceEntry?.brand ?? null,
    marketplace_data: marketplaceConfig,
    marketplaceConfig,
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
    category: typeof p.category?.name === 'object' ? (p.category.name.tr || p.category.name.en || '') : (p.category?.name ?? null),
    category_id: p.categoryId ?? p.category_id ?? null,
    seo_title: p.seoTitle ?? p.seo_title ?? p.metaTitle ?? p.meta_title ?? null,
    seo_description: p.seoDescription ?? p.seo_description ?? p.metaDescription ?? p.meta_description ?? null,
    created_at: p.createdAt ?? p.created_at,
    updated_at: p.updatedAt ?? p.updated_at,
  }
}

function toStoreProduct(p: any): any {
  const m = mapProduct(p)
  const allImages: string[] = Array.isArray(m.images)
    ? m.images.map((img: any) => typeof img === 'string' ? img : img?.url ?? null).filter(Boolean)
    : []
  const firstImage = allImages.length > 0 ? allImages[0] : null
  return {
    'product.id': String(m.id ?? ''),
    'product.code': m.code ?? '',
    'product.label': m.label ?? '',
    'product.status': m.status ?? 0,
    price: m.price ?? null,
    currency: m.price_currency ?? null,
    image: firstImage,
    images: allImages,
    description: m.description ?? null,
    tags: m.tags ?? null,
    attributes: m.attributes ?? null,
    seo_title: m.seo_title ?? null,
    seo_description: m.seo_description ?? null,
  }
}

function normalizeStore(s: any): any {
  if (!s) return s
  return {
    ...s,
    site_code: s.siteCode ?? s.site_code,
    site_url: s.siteUrl ?? s.site_url ?? null,
    is_active: s.isActive ?? s.is_active,
    homepage: s.homepage ?? null,
    tax_settings: s.taxSettings ?? s.tax_settings,
    shipping_settings: s.shippingSettings ?? s.shipping_settings,
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
  facebook: 'Facebook',
  instagram: 'Instagram',
}

const MARKETPLACE_FIELDS: Record<string, Record<string, string>> = {
  trendyol: { apiKey: 'API Anahtarı', apiSecret: 'API Secret', supplierId: 'Tedarikçi ID' },
  hepsiburada: { username: 'Kullanıcı Adı', password: 'Şifre', merchantId: 'Mağaza ID' },
  pazarama: { clientId: 'Client ID', clientSecret: 'Client Secret', apiKey: 'API Anahtar' },
  n11: { appKey: 'App Key', appSecret: 'App Secret' },
  amazon: { refreshToken: 'Refresh Token', sellerId: 'Satıcı ID', awsAccessKey: 'AWS Access Key', awsSecretKey: 'AWS Secret Key' },
  etsy: { clientId: 'Client ID', clientSecret: 'Client Secret' },
  facebook: {},
  instagram: {},
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

function mapBlog(p: any): any {
  if (!p) return p
  return {
    ...p,
    id: Number(p.id),
    store_id: p.storeId ?? p.store_id,
    cover_image: p.coverImage ?? p.cover_image,
    product_id: p.productId ?? p.product_id,
    is_active: p.isActive ?? p.is_active,
    published_at: p.publishedAt ?? p.published_at,
    created_at: p.createdAt ?? p.created_at,
    updated_at: p.updatedAt ?? p.updated_at,
  }
}

function mapOrder(o: any): any {
  if (!o) return o
  const address = o.shippingAddress || o.shipping_address
  const addressStr = typeof address === 'object'
    ? [address.fullAddress || address.addressLine1, address.addressLine2, address.district, address.city, address.state, address.country].filter(Boolean).join(', ')
    : (address || '')
  const attribution = o.attribution || o.attributionJson || null
  const src = (attribution as any)?.utm_source || (attribution as any)?.rh_src || null
  return {
    ...o,
    id: Number(o.id),
    created_at: o.createdAt ?? o.created_at,
    order_date: o.orderDate ?? o.order_date ?? o.createdAt ?? o.created_at,
    grand_total: o.totalAmount ?? o.grand_total,
    subtotal: o.subtotal ?? (o.totalAmount ? Number(o.totalAmount) * 0.9 : 0),
    shipping: o.shippingAmount ?? o.shipping ?? 0,
    tax: o.taxAmount ?? o.tax ?? 0,
    items: o.items ?? [],
    shipping_address: addressStr,
    customer_name: o.customerName || (typeof address === 'object' ? (address.name || address.fullName || address.firstName + ' ' + address.lastName || '') : ''),
    customer_email: o.customerEmail || (typeof address === 'object' ? (address.email || '') : ''),
    customer_phone: o.customerPhone || (typeof address === 'object' ? (address.phone || address.phoneNumber || '') : ''),
    external_id: o.marketplaceOrderNumber || o.marketplaceOrderId || o.orderNumber || o.external_id,
    tracking_number: o.trackingNumber ?? o.tracking_number,
    tracking_company: o.carrier ?? o.tracking_company,
    payment_method: o.paymentMethod ?? o.payment_method,
    payment_status: o.paymentStatus ?? o.payment_status,
    parent_order_id: o.parentOrderId ?? o.parent_order_id,
    parent_order: o.parentOrder ?? o.parent_order,
    sub_orders: (o.subOrders || []).map((s: any) => ({ ...s, id: Number(s.id) })),
    invoice_url: o.invoiceUrl ?? o.invoice_url,
    label_url: o.labelUrl ?? o.label_url,
    label_zpl: o.labelZpl ?? o.label_zpl,
    cargo_company: o.cargoCompany ?? o.cargo_company,
    attribution,
    attribution_source: src,
  }
}

class ApiClient {
  private token: string | null = null
  private customerToken: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
      this.customerToken = localStorage.getItem('customer_auth_token')
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

  setCustomerToken(token: string | null) {
    this.customerToken = token
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('customer_auth_token', token)
      else localStorage.removeItem('customer_auth_token')
    }
  }

  private async request<T>(path: string, options: FetchOptions & { isFormData?: boolean } = {}): Promise<T> {
    const { params, isFormData, customerAuth, ...fetchOptions } = options
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

    const authToken = customerAuth ? this.customerToken : this.token
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const res = await fetch(url.toString(), { ...fetchOptions, headers })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }))
      let msg = error.error || error.message || `HTTP ${res.status}`
      if (Array.isArray(error.errors) && error.errors.length) {
        msg = error.errors
          .map((e: any) => `${e.msg}${e.path ? ` (${e.path})` : ''}`)
          .filter(Boolean)
          .join(', ')
      }
      const err = new Error(msg) as Error & { code?: string; data?: any; status?: number }
      err.code = error.error
      err.data = error
      err.status = res.status
      throw err
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

  deleteMyAccount(password: string, confirmation: string) {
    return this.post<{ success: boolean; message: string; storeDeactivated: boolean }>('/api/auth/delete-my-account', { password, confirmation })
  }

  refreshToken(refreshToken: string) {
    return this.post<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', { refreshToken })
  }

  changePassword(currentPassword: string | undefined, newPassword: string) {
    const body: Record<string, string> = { newPassword }
    if (currentPassword !== undefined && currentPassword !== '') body.currentPassword = currentPassword
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
    return this.post<import('./types').AuthResponse>('/api/auth/google', payload)
  }

  resetUserPassword(userId: number, newPassword: string) {
    return this.put<{ success: boolean; message: string }>(`/api/admin/users/${userId}/password`, { newPassword })
  }

  resetStoreUserPassword(userId: number | string, newPassword: string) {
    return this.put<{ success: boolean; message: string }>(`/api/admin/users/${userId}/password`, { newPassword })
  }

  // Dashboard
  getDashboard() {
    return this.get<any>('/api/admin/dashboard').then(r => ({
      user: r.user || null,
      store: r.store || null,
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
      plan: r.plan || null,
      subscription: r.subscription || null,
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

  getCategoryTree(source?: string) {
    const params: Record<string, string | undefined> = {}
    if (source) params.source = source
    return this.get<{ categories: import('./types').Category[] }>(`/api/admin/categories/tree`, { params }).then(r => r.categories)
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

  // Brands
  getBrands(filters?: { marketplace?: string; search?: string }) {
    const params: Record<string, string> = {}
    if (filters?.marketplace) params.marketplace = filters.marketplace
    if (filters?.search) params.search = filters.search
    return this.get<{ brands: import('./types').Brand[] }>('/api/admin/brands', { params }).then(r => r.brands)
  }

  getBrand(id: number) {
    return this.get<{ brand: import('./types').Brand }>(`/api/admin/brands/${id}`).then(r => r.brand)
  }

  createBrand(data: { name: string; marketplace?: string; marketplaceBrandId?: string }) {
    return this.post<{ brand: import('./types').Brand }>('/api/admin/brands', data).then(r => r.brand)
  }

  updateBrand(id: number, data: Partial<import('./types').Brand>) {
    return this.put<{ brand: import('./types').Brand }>(`/api/admin/brands/${id}`, data).then(r => r.brand)
  }

  deleteBrand(id: number) {
    return this.delete<void>(`/api/admin/brands/${id}`)
  }

  syncBrands(marketplace: string) {
    return this.post<{ brands: any[]; imported: number; total: number }>('/api/admin/brands/sync', { marketplace })
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

  importIntegrationProducts(marketplace: string, maxPages = 100) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/integrations/${marketplace}/import`, { maxPages })
  }

  getImportJobStatus(marketplace: string, jobId: string) {
    return this.get<{ jobId: string; state: string; progress: number; data: any; result: any; failedReason: string }>(`/api/admin/integrations/${marketplace}/import/${jobId}`)
  }

  syncAllIntegrationProducts(marketplace: string) {
    return this.post<{ success: boolean; enqueued: number; message: string }>(`/api/admin/integrations/${marketplace}/sync-all`)
  }

  syncProduct(productId: number | string, marketplaces?: string[]) {
    return this.post<{ jobId: string; message: string }>(`/api/admin/products/${productId}/sync`, { marketplaces })
  }

  getMarketplaceCategories(marketplace: string) {
    return this.get<{ categories: any[] }>(`/api/admin/integrations/${marketplace}/categories`)
  }

  getMarketplaceCategoryAttributes(marketplace: string, categoryId: number | string) {
    return this.get<{ attributes: any[] }>(`/api/admin/integrations/${marketplace}/categories/${categoryId}/attributes`)
  }

  getMarketplaceShipmentTemplates(marketplace: string) {
    return this.get<{ templates: { templateName: string }[] }>(`/api/admin/integrations/${marketplace}/shipment-templates`)
  }

  // Meta / Facebook / Instagram (TechProvider)
  getMetaConnectUrl() {
    return this.get<{ url: string; fbeEnabled?: boolean }>('/api/admin/integrations/facebook/oauth/connect')
  }
  getMetaAssets() {
    return this.get<{ pages: any[]; catalogs: any[]; instagram: any[]; selected: { pageId: string | null; catalogId: string | null; igUserId: string | null } }>('/api/admin/integrations/facebook/assets')
  }
  selectMetaAssets(data: { pageId: string; catalogId: string; igUserId?: string | null }) {
    return this.post<{ ok: boolean; facebook: any; instagram: any | null }>('/api/admin/integrations/facebook/assets', data)
  }
  fbeCallback(data: { pageId?: string; catalogId?: string; igUserId?: string; businessId?: string; pixelId?: string }) {
    return this.post<{ ok: boolean; pageId?: string; catalogId?: string; pixelId?: string; domainToken?: string | null; businessId?: string | null }>('/api/admin/integrations/facebook/fbe/callback', data)
  }
  getMetaPixels() {
    return this.get<{ pixels: any[]; selected: string | null; businessId: string | null }>('/api/admin/integrations/facebook/pixels')
  }
  selectMetaPixel(pixelId: string) {
    return this.post<{ ok: boolean; pixelId: string }>('/api/admin/integrations/facebook/pixels', { pixelId })
  }
  getMetaDomain() {
    return this.get<{ domain: string; verificationToken: string | null; businessId: string | null }>('/api/admin/integrations/facebook/domain')
  }
  getInstagramShoppingStatus() {
    return this.get<{ connected: boolean; eligible: boolean | null; raw?: any; error?: string; reason?: string; igUserId?: string; igUsername?: string; catalogId?: string }>('/api/admin/integrations/facebook/instagram-shopping-status')
  }
  metaPublish(data: { productId?: number; productIds?: number[]; channel?: string; channels?: string[]; caption?: string }) {
    return this.post<{ ok: boolean; results: any[] }>('/api/admin/integrations/meta/publish', data)
  }
  metaSyncBrands() {
    return this.post<{ imported: number; total: number; brands: any[] }>('/api/admin/integrations/meta/sync-brands')
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
        supplier: p.supplier ? {
          name: p.supplier.name || '',
          ratingAvg: Number(p.supplier.ratingAvg ?? 0),
          ratingCount: Number(p.supplier.ratingCount ?? 0),
          ratingEnabled: p.supplier.ratingEnabled !== false,
          maxShipmentDays: Number(p.supplier.maxShipmentDays ?? 3),
        } : null,
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
        supplier: lp.supplier ? {
          name: lp.supplier.name || '',
          ratingAvg: Number(lp.supplier.ratingAvg ?? 0),
          ratingCount: Number(lp.supplier.ratingCount ?? 0),
          ratingEnabled: lp.supplier.ratingEnabled !== false,
          maxShipmentDays: Number(lp.supplier.maxShipmentDays ?? 3),
        } : null,
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

  getOrderCapabilities(id: number) {
    return this.get<{ marketplace: string; integrationConnected: boolean; actions: Array<{ action: string; available: boolean; reason?: string | null }>; unsupported: string[] }>(`/api/admin/orders/${id}/capabilities`)
  }

  updateOrderStatus(id: number, status: string, note?: string) {
    return this.put<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}/status`, { status, note })
  }

  refundOrder(id: number, amount?: number, reason?: string) {
    return this.post<{ success: boolean; refId: string; paymentStatus: string }>(`/api/admin/orders/${id}/refund`, { amount, reason })
  }

  updateOrderTracking(id: number, trackingNumber: string, carrier?: string) {
    return this.put<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}/tracking`, { trackingNumber, carrier })
  }

  async getNotifications(limit = 30, offset = 0) {
    return this.get<{ notifications: import('./types').StoreNotification[]; total: number; unreadCount: number }>(`/api/admin/notifications`, { params: { limit, offset } })
  }

  async getUnreadCount() {
    return this.get<{ unreadCount: number }>(`/api/admin/notifications/unread-count`)
  }

  async markAllNotificationsRead() {
    return this.post<{ success: boolean }>(`/api/admin/notifications/read-all`)
  }

  async markNotificationRead(id: number) {
    return this.post<{ notification: import('./types').StoreNotification }>(`/api/admin/notifications/${id}/read`)
  }

  async approveTrendyolOrder(id: number) {
    return this.put<{ order: import('./types').DropshippingOrderDetail }>(`/api/admin/orders/${id}/status`, { status: 'processing', note: 'Trendyol order approved' })
  }

  async getOrderLabel(id: number) {
    return this.get<{ labelUrl: string | null; labelZpl: string | null; cargoCompany: string | null; reason?: string | null }>(`/api/admin/orders/${id}/label`)
  }

  updateMarketplaceInvoice(id: number, invoiceLink: string) {
    return this.post<{ success: boolean; invoiceUrl: string }>(`/api/admin/orders/${id}/marketplace/invoice`, { invoiceLink })
  }

  updateMarketplaceReturn(id: number, refundId: string, decision: 'approve' | 'reject') {
    return this.post<{ success: boolean; decision: string }>(`/api/admin/orders/${id}/marketplace/return`, { refundId, decision })
  }

  getOrderHistory(id: number) {
    return this.get<{ history: import('./types').OrderStatusHistory[] }>(`/api/admin/orders/${id}/history`)
  }

  bulkUpdateOrderStatus(ids: number[], status: string, note?: string) {
    return this.post<{ updated: number }>(`/api/admin/orders/bulk-status`, { ids, status, note })
  }

  async importOrders(marketplace: string, options?: { startDate?: string; endDate?: string; status?: string; maxPages?: number }) {
    return this.post<{ imported: number; orders: any[] }>(`/api/admin/integration/${marketplace}/import-orders`, options || {})
  }

  async importAllOrders(options?: { maxPages?: number }) {
    return this.post<{ imported: number; results: { marketplace: string; imported: number }[] }>(`/api/admin/integration/import-all`, options || {})
  }

  // Supplier (dropshipping / B2B)
  getSupplierProfile() {
    return this.get<{ supplier: any }>('/api/admin/supplier/profile')
  }

  updateSupplierProfile(data: Record<string, unknown>) {
    return this.put<{ supplier: any }>('/api/admin/supplier/profile', data)
  }

  getSuppliers() {
    return this.get<{ suppliers: any[]; supplierStoreIds: number[] }>('/api/admin/suppliers')
  }

  getSupplierOrders(filters?: { page?: number; limit?: number; status?: string }) {
    return this.get<{ orders: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/supplier/orders', { params: filters })
  }

  supplierAcceptOrder(id: number, note?: string) {
    return this.post<{ order: any; supplierStatus: string }>(`/api/admin/supplier/orders/${id}/accept`, { note })
  }

  supplierRejectOrder(id: number, note?: string) {
    return this.post<{ order: any; supplierStatus: string }>(`/api/admin/supplier/orders/${id}/reject`, { note })
  }

  supplierShipOrder(id: number, trackingNumber: string, carrier?: string, note?: string) {
    return this.post<{ order: any; supplierStatus: string }>(`/api/admin/supplier/orders/${id}/ship`, { trackingNumber, carrier, note })
  }

  supplierReturnOrder(id: number, note?: string) {
    return this.post<{ order: any; supplierStatus: string; status: string }>(`/api/admin/supplier/orders/${id}/return`, { note })
  }

  getSupplierSettlements(filters?: { page?: number; limit?: number; status?: string }) {
    return this.get<{ settlements: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/supplier/settlements', { params: filters })
  }

  getSupplierSettlementPeriod(period: string) {
    return this.get<{ computation: any; lines: any[]; settlement: any | null }>('/api/admin/supplier/settlements/period', { params: { period } })
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

  // Supplier ratings (buyer)
  rateSupplier(data: { orderId: number; supplierId: number; rating: number; comment?: string }) {
    return this.post<any>(`/api/admin/supplier/ratings`, data).then((r) => r.rating || r.data || r)
  }

  getMySupplierRatings(params?: { orderId?: number; supplierId?: number }) {
    return this.get<any>(`/api/admin/supplier/ratings`, { params }).then((r) => r.ratings || r.data || [])
  }

  deleteMySupplierRating(id: number) {
    return this.delete<any>(`/api/admin/supplier/ratings/${id}`).then((r) => r.data || r)
  }

  // Supplier ratings (superadmin)
  getSupplierRatingsAdmin(params?: { storeId?: number; supplierId?: number; rating?: number }) {
    return this.get<any>(`/api/admin/supplier/ratings-admin`, { params }).then((r) => r.ratings || r.data || [])
  }

  updateSupplierRatingAdmin(id: number, data: { rating?: number; comment?: string | null }) {
    return this.put<any>(`/api/admin/supplier/ratings-admin/${id}`, data).then((r) => r.rating || r.data || r)
  }

  deleteSupplierRatingAdmin(id: number) {
    return this.delete<any>(`/api/admin/supplier/ratings-admin/${id}`).then((r) => r.data || r)
  }

  getRatingSettingsAdmin() {
    return this.get<any>(`/api/admin/supplier/ratings-admin/settings`).then((r) => r.settings || r.data || { enabled: true })
  }

  updateRatingSettingsAdmin(enabled: boolean) {
    return this.put<any>(`/api/admin/supplier/ratings-admin/settings`, { enabled }).then((r) => r.settings || r.data || { enabled })
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

  getGlobalSettings() {
    return this.get<{ settings: Record<string, any> }>('/api/admin/settings')
  }

  updateGlobalSetting(key: string, value: any) {
    return this.put<{ key: string; value: any }>(`/api/admin/settings/${key}`, { value })
  }

  getIntegrationLogs(params?: Record<string, string | number | undefined>) {
    return this.get<{ logs: any[]; total: number }>(`/api/admin/integration/logs`, { params })
  }

  deleteIntegration(marketplace: string) {
    return this.delete<{ success: boolean }>(`/api/admin/integrations/${marketplace}`)
  }

  deleteMarketplaceListing(marketplace: string, productId: number) {
    return this.delete<{ success: boolean }>(`/api/admin/integrations/${marketplace}/listings/${productId}`)
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
    return this.get<{ sessionId: string; images: number; ready: string[]; error?: string }>(`/api/ai/status/${sessionId}`)
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

  async agenticListing(data: {
    imageUrl: string
    category?: string
    category_attributes?: { name: string; description?: string }[]
    short_description?: string
    keywords?: string
    notes?: string
    suggest_price?: boolean
    target_marketplaces?: string[]
  }) {
    return this.post<{
      specs: { material: string; color: string; type: string; style: string; pattern?: string; brand?: string; category: string }
      title: string
      description: string
      short_description: string
      meta_title: string
      meta_description: string
      keywords: string[]
      slug: string
      category: string
      attributes: Record<string, string>
      bullet_points: string[]
      price_suggestion: { min: number; max: number; currency: string; rationale: string } | null
    }>(`/api/ai/agentic-listing`, data)
  }

  generateDescription(data: { title: string; category: string; attributes?: Record<string, any>; keywords?: string[] }) {    return this.post<{ description: string; title: string; keywords: string[]; slug: string }>(`/api/ai/generate-description`, data)
  }

  // AI Product Studio (session → draft → publish flow)
  async createAiProductSession(data: {
    sourceImageUrl: string
    sourceImageUrls?: string[]
    category?: string
    category_id?: number
    condition?: 'new' | 'refurbished' | 'used' | 'salvage'
    short_description?: string
    keywords?: string[]
    notes?: string
    suggest_price?: boolean
    target_marketplaces?: string[]
  }) {
    const r = await this.post<{ session: any; draft: any | null }>(`/api/ai/product-sessions`, data)
    return { session: r.session, draft: r.draft }
  }

  // AI Categories (user-defined categories + auto-generated attribute schemas)
  async listAiCategories() {
    const r = await this.get<{ categories: any[]; defaultCategoryId: number | null }>(`/api/admin/ai/categories`)
    return { categories: r.categories || [], defaultCategoryId: r.defaultCategoryId }
  }

  async createAiCategory(data: { name: string; slug?: string; attributes?: any[]; autoGenerate?: boolean }) {
    const r = await this.post<{ category: any }>(`/api/admin/ai/categories`, data)
    return r.category
  }

  async generateAiCategoryAttributes(data: { name: string; keywords?: string; notes?: string }) {
    const r = await this.post<{ attributes: any[] }>(`/api/admin/ai/categories/generate`, data)
    return r.attributes || []
  }

  async regenerateAiCategoryAttributes(id: number) {
    const r = await this.post<{ category: any }>(`/api/admin/ai/categories/${id}/generate-attributes`)
    return r.category
  }

  async updateAiCategory(id: number, data: { name?: string; attributes?: any[] }) {
    const r = await this.put<{ category: any }>(`/api/admin/ai/categories/${id}`, data)
    return r.category
  }

  async deleteAiCategory(id: number) {
    return this.delete<{ ok: boolean }>(`/api/admin/ai/categories/${id}`)
  }

  async setDefaultAiCategory(categoryId: number | null) {
    return this.post<{ ok: boolean; defaultCategoryId: number | null }>(`/api/admin/ai/categories/default`, { categoryId })
  }

  async getAiProductSession(id: string) {
    const r = await this.get<{ session: any; draft: any | null }>(`/api/ai/product-sessions/${id}`)
    return { session: r.session, draft: r.draft }
  }

  async getAiProductSessionStatus(id: string) {
    return this.get<{ id: string; status: string; errorMessage?: string; creditsUsed: number; draftId?: number }>(`/api/ai/product-sessions/${id}/status`)
  }

  async listAiProductDrafts() {
    const r = await this.get<{ drafts: any[] }>(`/api/ai/product-drafts`)
    return r.drafts || []
  }

  getAiProductDraft(id: number) {
    return this.get<any>(`/api/ai/product-drafts/${id}`).then(r => r.draft ?? r)
  }

  updateAiProductDraft(id: number, patch: Record<string, any>) {
    return this.put<any>(`/api/ai/product-drafts/${id}`, patch).then(r => r.draft ?? r)
  }

  approveAiProductDraft(id: number) {
    return this.post<any>(`/api/ai/product-drafts/${id}/approve`).then(r => r.draft ?? r)
  }

  validateAiProductChannels(id: number, channels: string[], selections?: Record<string, { categoryId?: string | number | null; brandId?: string | null; brand?: string | null; attributes?: any[] }>) {
    return this.post<{ results: Array<{ channel: string; status: string; missingFields: string[]; message?: string; suggestion?: string }> }>(`/api/ai/product-drafts/${id}/validate-channels`, { channels, ...(selections ? { selections } : {}) }).then(r => r.results || [])
  }

  publishAiProductDraft(id: number, channels: string[], selections?: Record<string, { categoryId?: string | number | null; brandId?: string | null; brand?: string | null; attributes?: any[] }>) {
    return this.post<{ ok: boolean; productId?: number; results: any[] }>(`/api/ai/product-drafts/${id}/publish`, { channels, ...(selections ? { selections } : {}) })
  }

  retryAiProductPublish(id: number, channels?: string[]) {
    return this.post<{ ok: boolean; retried: number; results: any[] }>(
      `/api/ai/product-drafts/${id}/publish/retry`,
      channels && channels.length ? { channels } : undefined
    )
  }

  getAiProductPublishState(id: number) {
    return this.get<{ productId: number | null; draftStatus: string; listings: any[] }>(`/api/ai/product-drafts/${id}/publish`)
  }

  deleteAiProductDraft(id: number) {
    return this.delete<{ ok: boolean }>(`/api/ai/product-drafts/${id}`)
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
    const raw = await this.get<{ store: any }>(`/api/admin/me`)
    return normalizeStore(raw.store)
  }

  async updateSettings(data: Partial<import('./types').Store>) {
    const raw = await this.put<any>(`/api/admin/me`, data)
    return normalizeStore(raw.store ?? raw)
  }

  async checkSiteCode(code: string) {
    return this.get<{ available: boolean }>(`/api/admin/me/check-site-code`, { params: { code } })
  }

  // Site deployment (Faz 8) — publish/unpublish/rollback
  async getSiteDeployments() {
    const r = await this.get<{ deployments: any[]; published: boolean }>(`/api/admin/site/deployments`)
    return { deployments: r.deployments || [], published: r.published }
  }

  getSiteProvider() {
    return this.get<{ provider: 'rahatio' | 'vercel' | 'custom'; configured: boolean; canDeploy: boolean; reason: string | null; supportedProviders: string[] }>('/api/admin/site/provider')
  }

  deployManagedSite(note?: string) {
    return this.post<{ deployment: import('./types').SiteDeployment }>('/api/admin/site/deploy', { note })
  }

  getSiteDeploymentStatus(id: number | string) {
    return this.get<{ deployment: import('./types').SiteDeployment }>(`/api/admin/site/deployments/${id}/status`)
  }

  addSiteDomain(domain: string) {
    return this.post<{ domain: string; verified: boolean; configured?: boolean; verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }>; url?: string | null }>('/api/admin/site/domain', { domain })
  }

  getSiteDomain() {
    return this.get<{ domain: string | null; verified: boolean; configured?: boolean; verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }>; url?: string | null }>('/api/admin/site/domain')
  }

  verifySiteDomain() {
    return this.post<{ domain: string; verified: boolean; configured?: boolean; verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }>; url?: string | null }>('/api/admin/site/domain/verify')
  }

  // Custom domain (direct DNS pointing to the Rahatio edge)
  getCustomDomain() {
    return this.get<{ domain: string | null; verified: boolean; token: string | null; dnsRecords: Array<{ type: string; name: string; value: string; purpose?: string }>; siteUrl: string | null }>('/api/admin/site/custom-domain')
  }

  setCustomDomain(domain: string) {
    return this.post<{ domain: string; verified: boolean; token: string; dnsRecords: Array<{ type: string; name: string; value: string; purpose?: string }>; siteUrl: null }>('/api/admin/site/custom-domain', { domain })
  }

  verifyCustomDomain() {
    return this.post<{ domain: string; verified: boolean; checks: { txt: boolean; cname: boolean; a: boolean }; dnsRecords: Array<{ type: string; name: string; value: string; purpose?: string }> }>('/api/admin/site/custom-domain/verify')
  }

  removeCustomDomain() {
    return this.delete<{ domain: null; verified: boolean }>('/api/admin/site/custom-domain')
  }

  async resolveStoreByDomain(domain: string) {
    return this.get<{ store: { id: number; name: string; siteCode: string; domain: string; siteUrl: string | null; published: boolean } }>('/api/store/resolve', { params: { domain } })
  }

  async publishSite(note?: string) {
    return this.post<any>(`/api/admin/site/publish`, { note })
  }

  async unpublishSite(note?: string) {
    return this.post<any>(`/api/admin/site/unpublish`, { note })
  }

  async rollbackSiteDeployment(id: number | string) {
    return this.post<any>(`/api/admin/site/deployments/${id}/rollback`)
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

  seedLegalPages() {
    return this.post<{ success: boolean; pagesCreated: number; menusCreated: number }>(`/api/admin/pages/seed-legal`)
  }

  // Blog
  async getBlogs(filters?: { page?: number; limit?: number; search?: string }) {
    const r = await this.get<{ posts: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/admin/blogs`, { params: filters })
    return { data: (r.posts || []).map(mapBlog), total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }
  }

  getBlog(id: number) {
    return this.get<any>(`/api/admin/blogs/${id}`).then(r => mapBlog(r.post ?? r))
  }

  createBlog(data: Record<string, any>) {
    const body = { ...data, isActive: data.is_active, is_active: undefined, publishedAt: data.published_at, published_at: undefined }
    return this.post<any>(`/api/admin/blogs`, body).then(r => mapBlog(r.post ?? r))
  }

  updateBlog(id: number, data: Record<string, any>) {
    const body = { ...data, isActive: data.is_active, is_active: undefined, publishedAt: data.published_at, published_at: undefined }
    return this.put<any>(`/api/admin/blogs/${id}`, body).then(r => mapBlog(r.post ?? r))
  }

  deleteBlog(id: number) {
    return this.delete<void>(`/api/admin/blogs/${id}`)
  }

  generateBlog(data: {
    topic?: string
    productId?: number | null
    imageUrl?: string
    notes?: string
    keywords?: string[]
  }) {
    return this.post<{
      title: string
      excerpt: string
      content: string
      seo_title: string
      seo_description: string
      slug: string
      keywords: string[]
      tags: string[]
    }>(`/api/admin/blogs/generate`, data)
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

  // Pixels / Tracking Codes
  getPixels() {
    return this.get<{ pixels: Record<string, any> }>('/api/admin/pixels').then(r => r.pixels)
  }

  updatePixels(pixels: Record<string, any>) {
    return this.put<{ pixels: Record<string, any> }>('/api/admin/pixels', { pixels }).then(r => r.pixels)
  }

  getStorePixels(siteCode: string) {
    return this.get<{ pixels: Record<string, any> }>(`/api/store/${siteCode}/pixels`).then(r => r.pixels)
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
  customerRegister(siteCode: string, data: Record<string, any>) { return this.post<any>(`/api/store/${siteCode}/customer/register`, data) }
  customerLogin(siteCode: string, data: Record<string, any>) { return this.post<any>(`/api/store/${siteCode}/customer/login`, data) }
  customerMe(siteCode: string) { return this.get<any>(`/api/store/${siteCode}/customer/me`, { customerAuth: true }) }
  customerOrders(siteCode: string) { return this.get<any>(`/api/store/${siteCode}/customer/orders`, { customerAuth: true }) }
  customerFavorites(siteCode: string) { return this.get<any>(`/api/store/${siteCode}/customer/favorites`, { customerAuth: true }) }
  addCustomerFavorite(siteCode: string, productId: number) { return this.post<any>(`/api/store/${siteCode}/customer/favorites/${productId}`, undefined, { customerAuth: true }) }
  removeCustomerFavorite(siteCode: string, productId: number) { return this.delete<any>(`/api/store/${siteCode}/customer/favorites/${productId}`, { customerAuth: true }) }
  validateCoupon(siteCode: string, code: string, subtotal: number) { return this.post<any>(`/api/store/${siteCode}/customer/coupons/validate`, { code, subtotal }) }
  getPublicBlog(type: string) {
    return this.get<{ id: number; title: string; slug: string; meta_title: string | null; meta_description: string | null; created_at: string }[]>(`/api/store/platform/pages`, { params: { type } })
  }

  async getStoreFront(siteCode: string) {
    const r = await this.get<any>(`/api/store/${siteCode}`)
    if (r && r.store && Array.isArray(r.products)) {
      return r as import('./types').StoreFrontData
    }
    const flat = r ?? {}
    const products = (flat.products ?? []).map(toStoreProduct)
    return {
      store: {
        id: flat.id,
        name: flat.name,
        site_code: flat.siteCode ?? flat.site_code,
        siteCode: flat.siteCode,
        siteUrl: flat.siteUrl,
        domain: flat.domain ?? null,
        email: flat.email ?? null,
        theme: flat.theme ?? null,
        homepage: flat.homepage ?? null,
        shipping_settings: flat.shippingSettings ?? flat.shipping_settings ?? null,
      },
      products,
      total: flat.total ?? products.length,
    } as import('./types').StoreFrontData
  }

  async getAddresses(siteCode: string, ownerToken: string) {
    const r = await this.get<any>(`/api/store/${siteCode}/addresses`, { params: { ownerToken } })
    return { data: Array.isArray(r) ? r : (r as any).data ?? (r as any).addresses ?? [] }
  }

  getCheckoutPaymentMethods(siteCode: string) {
    return this.get<{ paymentMethods: any[] }>(`/api/store/${siteCode}/payment-methods`).then(r => ({
      data: (r.paymentMethods || []).map((m: any) => ({
        method: m.type,
        label: m.label || m.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        config: m.config || {},
      })),
    }))
  }

  async getStoreProducts(siteCode: string, filters?: { page?: number; limit?: number; categoryId?: number; search?: string; priceMin?: number; priceMax?: number }) {
    const r = await this.get<{ products: import('./types').Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/store/${siteCode}/products`, { params: filters })
    return { data: r.products.map(mapProduct), current_page: r.pagination.page, per_page: r.pagination.limit, total: r.pagination.total, last_page: r.pagination.totalPages } as import('./types').PaginatedResponse<import('./types').Product>
  }

   async getStoreProduct(siteCode: string, id: number | string) {
    const r = await this.get<{ product: import('./types').Product }>(`/api/store/${encodeURIComponent(String(siteCode))}/products/${encodeURIComponent(String(id))}`)
    return toStoreProduct(r.product)
  }

  async getStoreCategories(siteCode: string) {
    const r = await this.get<{ categories: import('./types').Category[] }>(`/api/store/${siteCode}/categories`)
    return r.categories
  }

  getStoreLocations(siteCode: string) {
    return this.get<{ locations: import('./types').StoreLocation[] }>(`/api/store/${siteCode}/locations`).then(r => r.locations || [])
  }

  getStoreMenus(siteCode: string) {
    return this.get<{ menus: import('./types').StoreMenu[] }>(`/api/store/${siteCode}/menus`).then(r => r.menus)
  }

  getStorePages(siteCode: string) {
    return this.get<{ pages: any[] }>(`/api/store/${siteCode}/pages`).then(r => (r.pages || []).map(mapPage))
  }

  getStorePage(siteCode: string, slug: string) {
    return this.get<any>(`/api/store/${siteCode}/pages/${slug}`).then(r => mapPage(r.page ?? r))
  }

  async getStoreBlogs(siteCode: string, filters?: { page?: number; limit?: number }) {
    const r = await this.get<{ posts: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/api/store/${siteCode}/blogs`, { params: filters })
    return { data: (r.posts || []).map(mapBlog), total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }
  }

  getStoreBlog(siteCode: string, slug: string) {
    return this.get<any>(`/api/store/${siteCode}/blogs/${slug}`).then(r => mapBlog(r.post ?? r))
  }

  getStorePaymentMethods(siteCode: string) {
    return this.get<import('./types').StorePaymentMethod[]>(`/api/store/${siteCode}/payment-methods`)
  }

  saveAddress(siteCode: string, data: Record<string, any>, ownerToken?: string) {
    return this.post<any>(`/api/store/${siteCode}/addresses`, ownerToken ? { ...data, ownerToken } : data)
  }

  updateAddress(siteCode: string, id: number, data: Record<string, any>, ownerToken: string) {
    return this.put<any>(`/api/store/${siteCode}/addresses/${id}`, { ...data, ownerToken })
  }

  deleteAddress(siteCode: string, id: number, ownerToken: string) {
    return this.delete<any>(`/api/store/${siteCode}/addresses/${id}`, { params: { ownerToken } })
  }

  checkout(siteCode: string, data: Record<string, any>) {
    return this.post<{
      orderId: number
      orderNumber: string
      orderToken: string
      paymentMethod: string
      paymentStatus: string
      requiresPaymentGateway: boolean
      totals: { subtotal: number; shippingAmount: number; taxAmount: number; totalAmount: number }
      message: string
    }>(`/api/store/${siteCode}/checkout`, data)
  }

  getOrderTracking(siteCode: string, id: string | number, token: string) {
    return this.get<{ order: { id: number; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; totalAmount: number; currency: string; trackingNumber?: string; carrier?: string; items: unknown[]; createdAt: string } }>(
      `/api/store/${siteCode}/orders/${id}`,
      { params: { token } }
    )
  }

  initiatePayment(siteCode: string, orderId: number, orderToken: string, returnUrl: string) {
    return this.post<{
      orderId: number
      orderNumber: string
      requiresRedirect: boolean
      clientToken?: string
      paymentUrl?: string
      refId?: string
      expiresAt?: number
      alreadyPaid?: boolean
    }>(`/api/store/${siteCode}/payments/initiate`, { orderId, orderToken, returnUrl })
  }

  // Product Admin (products/page.tsx legacy interface)
  getAdminProducts(filters?: {
    page?: number; perPage?: number | 'all'; status?: '' | '1' | '0';
    marketplaces?: string[]; priceMin?: string; priceMax?: string; search?: string; b2b?: string;
  }) {
    const params: Record<string, string> = {}
    if (filters?.page) params.page = String(filters.page)
    if (filters?.perPage === 'all') params.limit = 'all'
    else if (filters?.perPage) params.limit = String(filters.perPage)
    if (filters?.status === '1') params.status = 'active'
    else if (filters?.status === '0') params.status = 'inactive'
    if (filters?.marketplaces?.length) params.marketplaces = filters.marketplaces.join(',')
    if (filters?.priceMin) params.priceMin = filters.priceMin
    if (filters?.priceMax) params.priceMax = filters.priceMax
    if (filters?.search) params.search = filters.search
    if (filters?.b2b) params.b2b = filters.b2b
    return this.get<{ products: import('./types').Product[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>('/api/admin/products', { params })
      .then(r => ({ data: r.products.map(mapProduct), total: r.pagination.total, current_page: r.pagination.page, last_page: r.pagination.totalPages }))
  }

  bulkSetB2b(ids: number[], data: { isB2BEnabled: boolean; b2bDiscount?: number | null; b2bPrice?: number | null }) {
    return this.post<{ updated: number }>('/api/admin/b2b/bulk', { ids, ...data })
  }

  getDuplicateProducts() {
    return this.get<{ groups: { sku: string; count: number; products: import('./types').Product[] }[]; total: number }>('/api/admin/products/merge/duplicates')
  }

  mergeProducts(keepId: number, removeIds: number[]) {
    return this.post<{ success: boolean; keepId: number; sku: string; removed: number; totalQuantity?: number; marketplaces?: string[] }>('/api/admin/products/merge', { keepId, removeIds })
  }

  createAdminProduct(data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) {
      if (data.price_currency === 'USD') payload.priceUSD = data.price
      else payload.priceTRY = data.price
    }
    if (data.price_try != null) payload.priceTRY = data.price_try
    if (data.price_usd != null) payload.priceUSD = data.price_usd
    if (data.stock != null) payload.quantity = data.stock
    if (data.status != null) payload.isActive = data.status === '1' || data.status === true || data.status === 1
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description) payload.description = data.description
    if (data.gram_weight != null) payload.gramWeight = data.gram_weight
    if (data.milyem != null) payload.milyem = data.milyem
    if (data.profit_margin != null) payload.profitMargin = data.profit_margin
    if (data.price_multiplier != null) payload.priceMultiplier = data.price_multiplier
    if (data.video_url) payload.videoUrl = data.video_url
    if (data.tags) payload.tags = data.tags
    return this.post<{ product: import('./types').Product }>('/api/admin/products', payload).then(r => r.product)
  }

  updateAdminProduct(id: string | number, data: Record<string, any>) {
    const payload: Record<string, any> = {}
    if (data.label || data.title) payload.title = data.label || data.title
    if (data.code || data.sku) payload.sku = data.code || data.sku
    if (data.price !== undefined) {
      if (data.price_currency === 'USD') payload.priceUSD = data.price
      else payload.priceTRY = data.price
    } else {
      if (data.price_try != null) payload.priceTRY = data.price_try
      if (data.price_usd != null) payload.priceUSD = data.price_usd
    }
    if (data.stock != null) payload.quantity = data.stock
    if (data.status != null) payload.isActive = data.status === '1' || data.status === true || data.status === 1
    if (data.marketplaces) payload.marketplaces = data.marketplaces
    if (data.marketplace_data) payload.marketplaceConfig = data.marketplace_data
    if (data.media_urls) payload.images = data.media_urls
    if (data.description != null) payload.description = data.description
    if (data.gram_weight != null) payload.gramWeight = data.gram_weight
    if (data.milyem != null) payload.milyem = data.milyem
    if (data.profit_margin != null) payload.profitMargin = data.profit_margin
    if (data.price_multiplier != null) payload.priceMultiplier = data.price_multiplier
    if (data.video_url) payload.videoUrl = data.video_url
    if (data.tags) payload.tags = data.tags
    return this.put<{ product: import('./types').Product }>(`/api/admin/products/${id}`, payload).then(r => r.product)
  }

  deleteAdminProduct(id: string | number) {
    return this.delete<void>(`/api/admin/products/${id}`)
  }

  deleteAdminProductsBulk(ids: string[]) {
    return this.post<{ success: boolean; deleted: number }>('/api/admin/products/bulk-delete', { ids: ids.map(Number) })
  }

  bulkAddToSite(ids: number[]) {
    return this.post<{ success: boolean; updated: number }>('/api/admin/products/bulk-add-to-site', { ids })
  }

  bulkPriceUpdate(ids: number[], data: { mode: 'percentage' | 'fixed'; amount: number; currency?: string; applyTo?: string }) {
    return this.post<{ success: boolean; updated: number }>('/api/admin/products/bulk-price-update', { ids, ...data })
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
    return this.post<{ sessionId: string }>(`/api/ai/image-edit`, { imageUrl: data.image_urls[0], prompt: data.prompt, category: data.category || 'diger' })
  }

  imageEdit(data: { imageUrl: string; prompt: string; category?: string }) {
    return this.post<{ sessionId: string }>(`/api/ai/image-edit`, { imageUrl: data.imageUrl, prompt: data.prompt, category: data.category || 'diger' })
  }

  imageGenerate(data: { prompt: string; count?: number; category?: string; referenceImageUrl?: string }) {
    return this.post<{ sessionId: string }>(`/api/ai/image-generate`, {
      prompt: data.prompt,
      count: data.count || 1,
      category: data.category || 'diger',
      imageUrl: data.referenceImageUrl || undefined,
    })
  }

  getAiOutputUrl(sessionId: string, filename: string) {
    return `${API_BASE}/api/ai/output/${sessionId}/${filename}`
  }

  /**
   * Polls an AI image session (edit/generate) until its PNGs are ready or it
   * fails. Returns the ready file names, or throws with the session error.
   */
  async pollAiImageSession(sessionId: string, maxTries = 60): Promise<string[]> {
    for (let i = 0; i < maxTries; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const st = await this.getAiStatus(sessionId)
      if (st.error) throw new Error(st.error)
      if (st.ready && st.ready.length > 0) return st.ready
    }
    throw new Error('Görsel üretilemedi (zaman aşımı)')
  }

  /** Fetches a generated AI image and uploads it to the store, returning its public URL. */
  async takeAiResultImage(sessionId: string, filename: string): Promise<{ url: string; path: string }> {
    const outUrl = this.getAiOutputUrl(sessionId, filename)
    const headers: Record<string, string> = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const res = await fetch(outUrl, { headers })
    if (!res.ok) {
      let msg = `Görsel alınamadı (${res.status})`
      try {
        const data = await res.json()
        if (data && data.error) msg = data.error
      } catch {}
      throw new Error(msg)
    }
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      throw new Error('AI çıktısı görsel değil (oturum başarısız olmuş olabilir).')
    }
    const blob = await res.blob()
    return this.uploadImage(new File([blob], filename, { type: contentType }))
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
        site_url: s.siteUrl ?? s.site_url ?? null,
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

  getCustomers(params?: { page?: number; limit?: number; search?: string; source?: string }) {
    return this.get<any>('/api/admin/commercial/customers', { params }).then(r => ({
      customers: (r.customers || []).map((c: any) => ({
        id: c.id, name: c.name, email: c.email, phone: c.phone,
        source: c.source || 'storefront',
        isActive: c.isActive, lastLoginAt: c.lastLoginAt, createdAt: c.createdAt,
        orderCount: c.orderCount || 0, totalSpent: c.totalSpent || 0,
      })),
      total: r.total || 0, page: r.page || 1, limit: r.limit || 20,
    }))
  }

  getCustomer(id: number) {
    return this.get<any>(`/api/admin/commercial/customers/${id}`).then(r => ({
      customer: r.customer, orders: r.orders || [],
    }))
  }

  getTemplates() {
    return this.get<any>('/api/admin/commercial/templates').then(r => r.templates || [])
  }

  updateTemplate(data: { channel: string; type: string; subject?: string; body?: string; isActive?: boolean }) {
    return this.put<any>('/api/admin/commercial/templates', data)
  }

  getSmtpSettings() {
    return this.get<any>('/api/admin/commercial/smtp').then(r => r.smtp)
  }

  updateSmtpSettings(data: { host: string; port: number; secure: boolean; user: string; pass: string; from: string }) {
    return this.put<any>('/api/admin/commercial/smtp', data)
  }

  getSmsSettings() {
    return this.get<any>('/api/admin/commercial/sms').then(r => r.sms)
  }

  updateSmsSettings(data: { accountSid: string; authToken: string; phoneNumber: string }) {
    return this.put<any>('/api/admin/commercial/sms', data)
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
    return this.download('/api/slave/download-php')
  }

  downloadSlaveVercel() {
    return this.download('/api/slave/download-vercel')
  }

  // Super Admin - AI Providers
  getAiProviders() {
    return this.get<{ providers: any[] }>('/api/admin/ai/providers')
  }

  createAiProvider(data: { code: string; name: string; type: string; baseUrl?: string; authConfig?: any; isActive?: boolean }) {
    return this.post<{ provider: any }>('/api/admin/ai/providers', data)
  }

  updateAiProvider(id: number, data: any) {
    return this.put<{ provider: any }>(`/api/admin/ai/providers/${id}`, data)
  }

  deleteAiProvider(id: number) {
    return this.delete<{ success: boolean }>(`/api/admin/ai/providers/${id}`)
  }

  // Super Admin - AI Models
  getAiModels() {
    return this.get<{ models: any[] }>('/api/admin/ai/models')
  }

  createAiModel(data: { providerId: number; modelId: string; displayName: string; modality?: string; tier?: string; maxTokens?: number; pricing?: any; isActive?: boolean }) {
    return this.post<{ model: any }>('/api/admin/ai/models', data)
  }

  updateAiModel(id: number, data: any) {
    return this.put<{ model: any }>(`/api/admin/ai/models/${id}`, data)
  }

  deleteAiModel(id: number) {
    return this.delete<{ success: boolean }>(`/api/admin/ai/models/${id}`)
  }

  // Super Admin - AI Scenarios
  getAiScenarios() {
    return this.get<{ scenarios: any[] }>('/api/admin/ai/scenarios')
  }

  createAiScenario(data: { code: string; name: string; description?: string; modelId?: number; parameters?: any; costCredits?: number; isActive?: boolean }) {
    return this.post<{ scenario: any }>('/api/admin/ai/scenarios', data)
  }

  updateAiScenario(id: number, data: any) {
    return this.put<{ scenario: any }>(`/api/admin/ai/scenarios/${id}`, data)
  }

  deleteAiScenario(id: number) {
    return this.delete<{ success: boolean }>(`/api/admin/ai/scenarios/${id}`)
  }

  // Super Admin - AI Rate Limits
  getAiRateLimits() {
    return this.get<{ limits: any[] }>('/api/admin/ai/rate-limits')
  }

  getAiSettings() {
    return this.get<{ defaultProviderId: number | null; defaultModelId: number | null; keys: Record<string, boolean> }>('/api/admin/ai/settings')
  }

  updateAiSettings(data: { defaultProviderId?: number | null; defaultModelId?: number | null; keys?: Record<string, string> }) {
    return this.put<{ defaultProviderId: number | null; defaultModelId: number | null; keys: Record<string, boolean> }>('/api/admin/ai/settings', data)
  }

  createAiRateLimit(data: { providerId: number; scope: string; maxRequests: number; isActive?: boolean }) {
    return this.post<{ limit: any }>('/api/admin/ai/rate-limits', data)
  }

  updateAiRateLimit(id: number, data: any) {
    return this.put<{ limit: any }>(`/api/admin/ai/rate-limits/${id}`, data)
  }

  deleteAiRateLimit(id: number) {
    return this.delete<{ success: boolean }>(`/api/admin/ai/rate-limits/${id}`)
  }

  // Super Admin - AI Usage Logs
  getAiUsageLogs(params?: { userId?: number; storeId?: number; providerId?: number; scenarioId?: number; limit?: number; offset?: number }) {
    return this.get<{ logs: any[]; total: number }>('/api/admin/ai/usage-logs', { params })
  }

  // Stock review/warning system
  getStockWarnings() {
    return this.get<{ threshold: number; count: number; products: { id: number; title: string; sku: string; quantity: number; image: string | null }[] }>('/api/admin/stocks/warnings')
  }

  setStockThreshold(threshold: number) {
    return this.put<{ success: boolean; threshold: number }>('/api/admin/stocks/threshold', { threshold })
  }

  runStockCheck() {
    return this.post<{ success: boolean; created: number }>('/api/admin/stocks/check')
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
