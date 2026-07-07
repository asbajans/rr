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

  // Products
  getProducts() {
    return this.get<import('./types').Product[]>('/api/products')
  }

  getProduct(id: string) {
    return this.get<import('./types').Product>(`/api/products/${id}`)
  }

  // AI
  processImage(formData: FormData) {
    return this.upload<{ url: string }>('/api/ai/process-image', formData)
  }
}

export const api = new ApiClient()
