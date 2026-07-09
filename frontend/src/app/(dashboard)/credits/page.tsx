'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { Coins, TrendingDown, TrendingUp, ArrowDown, ArrowUp, ShoppingCart } from 'lucide-react'

const PURCHASE_PACKS = [
  { credits: 50, price: 50 },
  { credits: 200, price: 150, popular: true },
  { credits: 500, price: 300 },
]

const MODULE_LABELS: Record<string, string> = {
  ai_product_create: 'AI Ürün Oluşturma',
  ai_image_generate: 'AI Görsel İşleme',
}

export default function CreditsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([api.getCreditLogs(), api.getCreditStats()])
      .then(([l, s]) => { setLogs(l); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function buyCredits(credits: number) {
    setBuying(true)
    setMessage('')
    try {
      const res = await api.buyCredits(credits)
      if (res.url) {
        window.open(res.url, '_blank')
      }
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setBuying(false)
    }
  }

  if (loading) return <div className="text-sm text-zinc-500">Yükleniyor...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">AI Kredileri</h1>
      <p className="mt-1 text-sm text-zinc-400">Kredi bakiyeni görüntüle ve yeni kredi satın al.</p>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-green-400">{message}</div>}

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Mevcut Bakiye</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.current_credits}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Toplam Kullanım</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.total_consumed}</p>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Toplam Yüklenen</p>
            <p className="mt-1 text-2xl font-bold text-indigo-400">{stats.total_granted}</p>
          </div>
        </div>
      )}

      {/* Purchase Section */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-white">Kredi Satın Al</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PURCHASE_PACKS.map(pack => (
            <div key={pack.credits} className={`relative rounded-xl border p-5 ${pack.popular ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-zinc-700 bg-zinc-900'}`}>
              {pack.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Popüler</span>}
              <p className="text-lg font-bold text-white">{pack.credits} Kredi</p>
              <p className="mt-1 text-2xl font-bold text-indigo-400">₺{pack.price}</p>
              <button onClick={() => buyCredits(pack.credits)} disabled={buying}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                <ShoppingCart className="h-4 w-4" /> {buying ? 'Yönlendiriliyor...' : 'Satın Al'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-white">Kredi Geçmişi</h2>
        <div className="mt-3 space-y-2">
          {logs.length === 0 && <p className="text-sm text-zinc-500">Henüz kredi hareketi yok.</p>}
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <div className="flex items-center gap-3">
                {log.action === 'consume' ? (
                  <ArrowUp className="h-4 w-4 text-red-400" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-green-400" />
                )}
                <div>
                  <p className="text-sm text-white">
                    {log.action === 'consume' ? 'Kullanım' : 'Yükleme'}
                    {log.module && ` — ${MODULE_LABELS[log.module] || log.module}`}
                  </p>
                  <p className="text-xs text-zinc-500">{log.note || ''} · {new Date(log.created_at).toLocaleString('tr-TR')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-medium ${log.action === 'consume' ? 'text-red-400' : 'text-green-400'}`}>
                  {log.action === 'consume' ? '-' : '+'}{log.amount}
                </p>
                <p className="text-xs text-zinc-500">{log.balance_before} → {log.balance_after}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}