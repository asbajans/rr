'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from './api-client'
import type { User, Store, Plan } from './types'

type StoreWithPlan = Store & {
  plan?: Plan | null
  subscription?: { status: string; currentPeriodEnd?: string; canceledAt?: string } | null
}

type AuthContextType = {
  user: User | null
  store: StoreWithPlan | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, store_name?: string) => Promise<User>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  can: (moduleKey: string) => boolean
  productLimit: number
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<StoreWithPlan | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async () => {
    const res = await api.me()
    setUser(res.user)
    setStore((res as any).store ?? null)
  }, [])

  useEffect(() => {
    const token = api.getToken()
    if (token) {
      refreshMe()
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [refreshMe])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    api.setToken(res.token)
    setUser(res.user)
    setStore((res as any).store ?? null)
    return res.user
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, store_name?: string) => {
    const res = await api.register(name, email, password, store_name)
    api.setToken(res.token)
    setUser(res.user)
    setStore((res as any).store ?? null)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.setToken(null)
    setUser(null)
    setStore(null)
  }, [])

  const can = useCallback((moduleKey: string): boolean => {
    const modules = store?.plan?.modules as Record<string, unknown> | null | undefined
    if (!modules || Object.keys(modules).length === 0) return true
    const mod = (modules as Record<string, unknown>)[moduleKey]
    if (mod === undefined || mod === null) return false
    if (typeof mod === 'boolean') return mod
    return (mod as { enabled?: boolean }).enabled === true
  }, [store])

  const productLimit = store?.plan?.product_limit ?? -1

  return (
    <AuthContext.Provider value={{ user, store, loading, login, register, logout, refreshMe, can, productLimit }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
