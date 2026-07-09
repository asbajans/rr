'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { Coins, TrendingDown, TrendingUp, ArrowDown, ArrowUp } from 'lucide-react'

const MODULE_LABELS: Record<string, string> = {
  ai_product_create: 'AI Ürün Oluşturma',
  ai_image_generate: 'AI Görsel İşleme',
}

export default function CreditsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getCreditLogs(), api.getCreditStats()])
      .then(([l, s]) => { setLogs(l); setStats(s) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-sm text-zinc-500">Yükleniyor...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">AI Kredileri</h1>
      <p className="mt-1 text-sm text-zinc-400">Kredi bakiyeni ve kullanım geçmişini görüntüle.</p>

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