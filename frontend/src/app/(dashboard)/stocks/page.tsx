'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { AlertTriangle, RefreshCw, PackageSearch } from 'lucide-react'

type StockWarning = {
  id: number
  title: string
  sku: string
  quantity: number
  image: string | null
}

export default function StocksPage() {
  const { t } = useI18n()
  const [threshold, setThreshold] = useState<number>(5)
  const [products, setProducts] = useState<StockWarning[]>([])
  const [count, setCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getStockWarnings()
      setThreshold(res.threshold)
      setProducts(res.products)
      setCount(res.count)
    } catch (e: any) {
      setError(e.message || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveThreshold = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await api.setStockThreshold(threshold)
      setThreshold(res.threshold)
      setNotice('Eşik değer kaydedildi')
      await load()
    } catch (e: any) {
      setError(e.message || 'Kaydedilemedi')
    } finally {
      setSaving(false)
    }
  }

  const runCheck = async () => {
    setChecking(true)
    setError(null)
    setNotice(null)
    try {
      const res = await api.runStockCheck()
      setNotice(res.created > 0 ? `${res.created} düşük stok bildirimi oluşturuldu` : 'Yeni düşük stok uyarısı yok')
      await load()
    } catch (e: any) {
      setError(e.message || 'Kontrol başarısız')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Stok İnceleme</h1>
          <p className="text-sm text-zinc-500">Eşik değerin altına düşen ürünleri gör ve bildirim al.</p>
        </div>
        <button
          onClick={runCheck}
          disabled={checking}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Kontrol ediliyor…' : 'Şimdi Kontrol Et'}
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="block text-sm font-medium text-zinc-700">Düşük stok eşiği</label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
          />
          <button
            onClick={saveThreshold}
            disabled={saving}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <span className="text-sm text-zinc-500">adet altındaki aktif ürünler uyarı listesine girer.</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-zinc-800">Düşük Stoklu Ürünler ({count})</h2>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('loading')}</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <PackageSearch className="h-8 w-8 text-zinc-300" />
            <p className="text-sm text-zinc-500">Eşiğin altında ürün yok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wider text-zinc-400">
                  <th className="px-3 py-2">Ürün</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Stok</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {p.image ? (
                          <img src={p.image} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-zinc-100" />
                        )}
                        <span className="truncate text-zinc-800">{p.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{p.sku}</td>
                    <td className="px-3 py-2">
                      <span className="rounded px-2 py-0.5 text-xs font-semibold text-red-700 bg-red-100">{p.quantity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}