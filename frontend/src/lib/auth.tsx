'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from './api-client'
import type { User } from './types'

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string, store_name?: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = api.getToken()
    if (token) {
      api.me()
        .then((user) => setUser(user))
        .catch(() => api.setToken(null))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    api.setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (name: string, email: string, password: string, store_name?: string) => {
    const res = await api.register(name, email, password, store_name)
    api.setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
