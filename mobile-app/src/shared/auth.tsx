import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api-client'
import { getFcmToken } from './push'
import type { User, StoreWithPlan } from './types'

type AuthContextType = {
  user: User | null
  store: StoreWithPlan | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, store_name?: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  can: (moduleKey: string) => boolean
  productLimit: number
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<StoreWithPlan | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshMe = useCallback(async (): Promise<void> => {
    const res = await api.me()
    setUser(res.user)
    setStore(res.store ?? null)
  }, [])

  const registerPushToken = useCallback(async (): Promise<void> => {
    const t = api.getToken()
    if (!t) return
    try {
      const fcmToken = await getFcmToken()
      if (!fcmToken) return
      await api.registerFcmToken(fcmToken)
    } catch {}
  }, [])

  useEffect(() => {
    api.init().then(() => {
      const t = api.getToken()
      if (t) {
        setToken(t)
        refreshMe()
          .catch(() => {
            api.setToken(null)
            setToken(null)
          })
          .finally(() => setLoading(false))
        registerPushToken()
      } else {
        setLoading(false)
      }
    })
  }, [refreshMe, registerPushToken])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    await api.setToken(res.token)
    setToken(res.token)
    setUser(res.user)
    try { await refreshMe() } catch {}
    registerPushToken()
  }, [registerPushToken, refreshMe])

  const register = useCallback(async (name: string, email: string, password: string, store_name?: string) => {
    const res = await api.register(name, email, password, store_name)
    await api.setToken(res.token)
    setToken(res.token)
    setUser(res.user)
    try { await refreshMe() } catch {}
    registerPushToken()
  }, [registerPushToken, refreshMe])

  const logout = useCallback(async () => {
    try { await api.logout() } catch {}
    await api.setToken(null)
    setToken(null)
    setUser(null)
    setStore(null)
  }, [])

  const can = useCallback((moduleKey: string): boolean => {
    const modules = store?.plan?.modules as Record<string, unknown> | null | undefined
    // If plan has no modules config at all, treat as open (legacy / default-enabled)
    if (!modules || Object.keys(modules).length === 0) return true
    const mod = (modules as Record<string, unknown>)[moduleKey]
    if (mod === undefined || mod === null) return false
    if (typeof mod === 'boolean') return mod
    return (mod as { enabled?: boolean }).enabled === true
  }, [store])

  const productLimit = store?.plan?.product_limit ?? -1

  return (
    <AuthContext.Provider value={{ user, store, token, loading, login, register, logout, refreshMe, can, productLimit }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
