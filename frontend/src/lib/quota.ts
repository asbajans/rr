'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from './api-client'
import type { QuotaStatus } from './types'

export function useQuotaStatus(opts: { poll?: boolean; intervalMs?: number } = {}) {
  const { poll = false, intervalMs = 60000 } = opts
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const q = await api.getQuotaStatus()
      setQuota(q)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'quota fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    if (!poll) return
    const t = setInterval(refresh, intervalMs)
    return () => clearInterval(t)
  }, [refresh, poll, intervalMs])

  return { quota, loading, error, refresh }
}
