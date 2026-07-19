'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { ExternalFeed } from '@/lib/types'
import { Rss, Plus, Play, Trash2, ExternalLink, Clock, CheckCircle, XCircle } from 'lucide-react'

export default function FeedsPage() {
  const { user } = useAuth()
  const [feeds, setFeeds] = useState<ExternalFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.getFeeds()
      .then((res) => setFeeds(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSync(feed: ExternalFeed) {
    setSyncing(feed.id)
    setError('')
    try {
      const result = await api.syncFeed(feed.id)
      if (result.status === 'failed') {
        setError(`Sync failed: ${result.summary?.error || 'Unknown error'}`)
      }
      load()
    } catch (err: any) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Bu feed kaydını silmek istediğinize emin misiniz?')) return
    try {
      await api.deleteFeed(id)
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const formatConfig = (format: string) => {
    const colors: Record<string, string> = { xml: 'text-blue-600 bg-blue-50', csv: 'text-green-600 bg-green-50', xlsx: 'text-emerald-600 bg-emerald-50', json: 'text-purple-600 bg-purple-50' }
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[format] || 'text-zinc-600 bg-zinc-100'}`}>{format.toUpperCase()}</span>
  }

  const intervalLabel = (interval: string) => {
    const labels: Record<string, string> = { manual: 'Manuel', hourly: 'Saatlik', daily: 'Günlük', weekly: 'Haftalık' }
    return labels[interval] || interval
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">XML Feed Yönetimi</h1>
          <p className="mt-1 text-sm text-zinc-600">Dış kaynaklardan (XML/CSV/XLSX/JSON) ürünleri içe aktar.</p>
        </div>
        <Link href="/feeds/new" className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> Feed Ekle
        </Link>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && feeds.length === 0 && (
        <div className="mt-16 text-center text-sm text-zinc-500">
          <Rss className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-4">Henüz feed eklenmemiş.</p>
          <Link href="/feeds/new" className="mt-2 inline-block text-indigo-600 hover:underline">İlk feed'i ekle</Link>
        </div>
      )}

      {!loading && feeds.length > 0 && (
        <div className="mt-6 space-y-4">
          {feeds.map((feed) => (
            <div key={feed.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                    <Rss className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/feeds/${feed.id}`} className="text-sm font-semibold text-zinc-900 hover:text-indigo-600">{feed.name}</Link>
                      {formatConfig(feed.file_format)}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${feed.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {feed.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 truncate max-w-lg">{feed.feed_url}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400">
                      <span>Auth: {feed.auth_type}</span>
                      <span>{feed.auto_sync ? `Otomatik: ${intervalLabel(feed.update_interval)}` : 'Manuel senkron'}</span>
                      <span>Fiyat: {feed.pricing_mode === 'gold-formula' ? 'Altın Formülü' : 'Sabit'} ({feed.currency})</span>
                      {feed.last_sync_at && <span>Son: {new Date(feed.last_sync_at).toLocaleDateString('tr-TR')}</span>}
                      {feed.last_sync_result && (
                        <span className={`${feed.last_sync_result.error ? 'text-red-500' : 'text-green-600'}`}>
                          {feed.last_sync_result.imported ?? 0}/{feed.last_sync_result.total ?? 0} ürün
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleSync(feed)}
                    disabled={syncing === feed.id}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600 disabled:opacity-50"
                    title="Senkronize Et">
                    {syncing === feed.id ? <Clock className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  </button>
                  <Link href={`/feeds/${feed.id}`}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-indigo-600"
                    title="Detay">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button onClick={() => handleDelete(feed.id)}
                    className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                    title="Sil">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
