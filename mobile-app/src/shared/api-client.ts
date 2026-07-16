import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { AuthResponse, User, DashboardData, PaginatedResponse, Store, Product, Order, ApiKey, CreatedApiKey, Plan, StoreFrontData, StoreProduct, Subscription, ProductDetail, DropshippingOrder, MarketplaceData } from './types'

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
  getAdminProducts() {
    return this.get<{ data: Product[]; total: number }>('/api/admin/products')
  }

  getAdminProduct(id: string) {
    return this.get<ProductDetail>(`/api/admin/products/${id}`)
  }

  createAdminProduct(data: { code: string; label: string; price?: number; stock?: number; status?: number }) {
    return this.post<Product>('/api/admin/products', data)
  }

  updateAdminProduct(id: string, data: {
    label?: string
    price?: number
    stock?: number
    status?: number
    description?: string
    marketplaces?: string[]
    marketplace_data?: Record<string, MarketplaceData>
    images?: string[]
  }) {
    return this.put<Product>(`/api/admin/products/${id}`, data)
  }

  deleteAdminProduct(id: string) {
    return this.delete<void>(`/api/admin/products/${id}`)
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
