'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Product } from '@/lib/types'

interface DuplicateGroup {
  sku: string
  count: number
  products: Product[]
}

export default function MergePage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [keepByGroup, setKeepByGroup] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    setError(null)
    api
      .getDuplicateProducts()
      .then((r) => {
        setGroups(r.groups ?? [])
        const next: Record<string, string> = {}
        r.groups?.forEach((g) => {
          const sorted = [...g.products].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
          next[g.sku] = String(sorted[0]?.id ?? g.products[0]?.id)
        })
        setKeepByGroup(next)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const doMerge = async (sku: string, keepId: string, removeIds: string[]) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const r = await api.mergeProducts(Number(keepId), removeIds.map(Number))
      setMessage(`"${r.sku}" için ${r.removed} ürün birleştirildi. Toplam stok: ${r.totalQuantity ?? ''}`)
      setKeepByGroup((prev) => {
        const next = { ...prev }
        delete next[sku]
        return next
      })
      setGroups((prev) => prev.filter((g) => g.sku !== sku))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">SKU Birleştirme</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aynı koda (SKU) sahip ürünleri tek bir üründe birleştirir. Varyant, pazaryeri kayıtları, B2B ayarları ve
            stoklar korunan ürüne taşınır.
          </p>
        </div>
        <button onClick={load} disabled={loading || busy} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-40">
          Yenile
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{message}</div>}

      {loading && <div className="text-gray-500 text-sm">Yükleniyor…</div>}

      {!loading && groups.length === 0 && (
        <div className="p-12 text-center text-gray-400 text-sm">Tekrarlayan SKU bulunamadı.</div>
      )}

      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((g) => {
            const keepId = keepByGroup[g.sku] ?? ''
            const keep = g.products.find((p) => p.id === keepId)
            const removes = g.products.filter((p) => p.id !== keepId)
            return (
              <div key={g.sku} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                  <span className="font-medium text-sm">
                    SKU: <code className="bg-white border rounded px-1.5 py-0.5 text-xs">{g.sku || '(boş)'}</code>
                    <span className="ml-2 text-gray-500">· {g.count} ürün</span>
                  </span>
                  <button
                    onClick={() => doMerge(g.sku, keepId, removes.map((p) => p.id))}
                    disabled={busy || !keepId || removes.length === 0}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Birleştir ({removes.length} ürünü {keep?.label || keepId} içine)
                  </button>
                </div>

                <div className="divide-y">
                  {g.products.map((p) => {
                    const isKeep = String(p.id) === keepId
                    return (
                      <div key={p.id} className={`px-4 py-2.5 flex items-center gap-3 ${isKeep ? 'bg-emerald-50' : ''}`}>
                        <input
                          type="radio"
                          name={`keep-${g.sku}`}
                          checked={isKeep}
                          onChange={() => setKeepByGroup((prev) => ({ ...prev, [g.sku]: String(p.id) }))}
                          title="Korunacak ürünü seç"
                        />
                        {p.media_url ? (
                          <img src={p.media_url} alt="" className="h-10 w-10 object-cover rounded border" />
                        ) : (
                          <div className="h-10 w-10 rounded border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">?</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {p.label || '(isimsiz)'}
                            {isKeep && <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5">KORUNACAK</span>}
                            {p.is_b2b_clone && <span className="ml-1 text-[10px] text-violet-700 bg-violet-100 rounded px-1.5 py-0.5">B2B Klon</span>}
                          </p>
                          <p className="text-xs text-gray-400 truncate">#{p.id} · Stok: {p.stock ?? 0}</p>
                        </div>
                        <div className="text-sm whitespace-nowrap">
                          {p.price_try != null ? `${p.price_try.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
