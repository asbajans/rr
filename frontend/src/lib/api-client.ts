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

  delete<T>(path: string, options?: FetchOptions) {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }

  // Auth
  login(email: string, password: string) {
    return this.post<import('./types').AuthResponse>('/api/auth/login', { email, password })
  }

  register(name: string, email: string, password: string) {
    return this.post<import('./types').AuthResponse>('/api/auth/register', { name, email, password })
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
  getAdminProducts() {
    return this.get<{ data: import('./types').Product[]; total: number }>('/api/admin/products')
  }

  getAdminProduct(id: string) {
    return this.get<import('./types').Product>(`/api/admin/products/${id}`)
  }

  createAdminProduct(data: { code: string; label: string; price?: number; stock?: number }) {
    return this.post<import('./types').Product>('/api/admin/products', data)
  }

  updateAdminProduct(id: string, data: { label?: string; price?: number; stock?: number; status?: number }) {
    return this.put<import('./types').Product>(`/api/admin/products/${id}`, data)
  }

  deleteAdminProduct(id: string) {
    return this.delete<void>(`/api/admin/products/${id}`)
  }

  // Admin Orders
  getAdminOrders() {
    return this.get<{ data: import('./types').Order[]; total: number }>('/api/admin/orders')
  }

  getAdminOrder(id: string) {
    return this.get<import('./types').Order>(`/api/admin/orders/${id}`)
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
    return this.upload<{ path: string; url: string }>('/api/admin/upload', formData)
  }

  // Store Frontend (public)
  getStoreFront(siteCode: string) {
    return this.get<import('./types').StoreFrontData>(`/api/store/${siteCode}`)
  }

  getStoreProduct(siteCode: string, id: string) {
    return this.get<import('./types').StoreProduct>(`/api/store/${siteCode}/products/${id}`)
  }

  // AI
  processImage(formData: FormData) {
    return this.upload<{ url: string }>('/api/ai/process-image', formData)
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
