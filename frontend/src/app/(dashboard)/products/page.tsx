'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import { Product, MarketplaceEntry, MarketplaceCategory } from '@/lib/types'

interface Filters {
  marketplaces: string[]
  status: '' | '1' | '0'
  priceMin: string
  priceMax: string
}

interface ProductModalData {
  id: string
  code: string
  label: string
  price: number
  stock: number
  status: number
  category: string
  category_id: string
  brand: string
  mediaUrl: string
  marketplaces: string[]
  marketplace_data: Record<string, MarketplaceEntry>
  description: string
}

function firstMd(p?: Product): MarketplaceEntry | undefined {
  if (!p?.marketplace_data) return undefined
  return Object.values(p.marketplace_data)[0]
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [perPage, setPerPage] = useState<number | 'all'>(25)
  const [reloadKey, setReloadKey] = useState(0)

  const [filters, setFilters] = useState<Filters>({ marketplaces: [], status: '', priceMin: '', priceMax: '' })
  const [marketplaceTrees, setMarketplaceTrees] = useState<Record<string, MarketplaceCategory[]>>({})

  const [selected, setSelected] = useState<string[]>([])

  // product edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [product, setProduct] = useState<ProductModalData | null>(null)

  // bulk AI modal
  const [bulkAiOpen, setBulkAiOpen] = useState(false)
  const [bulkAiField, setBulkAiField] = useState<'title' | 'description'>('description')
  const [bulkAiRunning, setBulkAiRunning] = useState(false)
  const [bulkAiDone, setBulkAiDone] = useState(0)
  const [bulkAiTotal, setBulkAiTotal] = useState(0)
  const [bulkAiError, setBulkAiError] = useState('')

  const marketplaceOptions = ['Kendi Sitem', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'Pazaryeri Yok']
  const statusOptions: { value: '' | '1' | '0'; label: string }[] = [
    { value: '', label: 'Tümü' },
    { value: '1', label: 'Satışta' },
    { value: '0', label: 'Satışta Değil' },
  ]

  // brands from loaded products (legacy)
  const brandOptions = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.brand) set.add(p.brand)
      const md = firstMd(p)
      if (md?.brand) set.add(md.brand)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [products])

  // category options from marketplace trees
  const categoryOptions = useMemo(() => {
    const opts: { id: string; name: string }[] = []
    Object.values(marketplaceTrees).forEach((tree) => {
      const walk = (nodes: MarketplaceCategory[], prefix: string) => {
        nodes.forEach((n) => {
          const name = prefix ? `${prefix} / ${n.name}` : n.name
          opts.push({ id: String(n.marketplace_category_id), name })
          if (n.children?.length) walk(n.children, name)
        })
      }
      walk(tree, '')
    })
    // unique by id
    const seen = new Set<string>()
    return opts.filter((o) => {
      if (seen.has(o.id)) return false
      seen.add(o.id)
      return true
    })
  }, [marketplaceTrees])

  // load marketplace trees once
  useEffect(() => {
    const token = api.getToken()
    if (!token) return
    ;(async () => {
      try {
        const res = await api.getMarketplaceTrees()
        setMarketplaceTrees(res.trees ?? {})
      } catch {
        // ignore
      }
    })()
  }, [])

  // main data load (re-runs on filter/page/perPage/reloadKey change)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getAdminProducts({ ...filters, page, perPage })
      .then((res) => {
        if (cancelled) return
        setProducts(res.data)
        setTotal(res.total)
        setLastPage(res.last_page)
        setSelected([])
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filters, page, perPage, reloadKey])

  const activeCount = useMemo(
    () => products.filter((p) => (p.marketplace_data ? Object.values(p.marketplace_data).some((mp) => mp.status === 1) : false)).length,
    [products]
  )

  function toggleMarketplace(m: string) {
    setPage(1)
    setFilters((f) => ({
      ...f,
      marketplaces: f.marketplaces.includes(m) ? f.marketplaces.filter((x) => x !== m) : [...f.marketplaces, m],
    }))
  }

  function openModal(p: Product) {
    const md = firstMd(p)
    setProduct({
      id: p.id,
      code: p.code,
      label: p.label,
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      status: p.status ?? (md?.on_sale ? 1 : 0),
      category: md?.category ?? '',
      category_id: md?.category_id ?? '',
      brand: p.brand ?? md?.brand ?? '',
      mediaUrl: p.media_url ?? '',
      marketplaces: p.marketplaces ?? [],
      marketplace_data: p.marketplace_data ?? {},
      description: p.description ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!product) return
    const marketplace_data: Record<string, MarketplaceEntry> = { ...product.marketplace_data }
    product.marketplaces.forEach((m) => {
      const existing = marketplace_data[m] ?? { on_sale: false }
      marketplace_data[m] = {
        ...existing,
        category: product.category || existing.category || '',
        category_id: product.category_id || existing.category_id || '',
        brand: product.brand || existing.brand || '',
        on_sale: m === 'Kendi Sitem' ? product.status === 1 : existing.on_sale,
      }
    })

    const payload: Record<string, unknown> = {
      label: product.label,
      price: Number(product.price),
      stock: Number(product.stock),
      status: product.status,
      marketplaces: product.marketplaces,
      marketplace_data,
    }
    if (product.mediaUrl.trim()) payload.media_urls = [product.mediaUrl.trim()]
    if (product.description.trim()) payload.description = product.description.trim()

    try {
      await api.updateAdminProduct(product.id, payload)
      setModalOpen(false)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`${product.label} silinecek. Emin misiniz?`)) return
    try {
      await api.deleteAdminProduct(product.id)
      setModalOpen(false)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleGenerateDescription() {
    if (!product) return
    try {
      const res = await api.generateProductDescription({
        name: product.label,
        brand: product.brand,
        category: product.category,
        price: product.price,
      })
      if (res.description) setProduct({ ...product, description: res.description })
    } catch (e: any) {
      setError(e.message)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === products.length && products.length > 0 ? [] : products.map((p) => p.id)))
  }

  async function handleBulkDelete() {
    if (selected.length === 0) return
    if (!confirm(`${selected.length} ürün silinecek. Emin misiniz?`)) return
    try {
      await api.deleteAdminProductsBulk(selected)
      setSelected([])
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleBulkAi() {
    if (selected.length === 0) return
    setBulkAiRunning(true)
    setBulkAiDone(0)
    setBulkAiTotal(selected.length)
    setBulkAiError('')
    const ids = [...selected]
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const p = products.find((x) => x.id === id)
      try {
        const md = firstMd(p)
        const res = await api.generateProductDescription({
          name: p?.label || '',
          brand: p?.brand || md?.brand || '',
          category: md?.category || '',
          price: p?.price,
          field: bulkAiField,
        })
        const patch: { label?: string; description?: string } =
          bulkAiField === 'title' ? { label: res.title ?? p?.label ?? '' } : { description: res.description ?? '' }
        await api.updateAdminProduct(id, patch)
      } catch (e: any) {
        setBulkAiError((err) => `${err}Ürün ${p?.label ?? id}: ${e.message}\n`)
      }
      setBulkAiDone(i + 1)
    }
    setBulkAiRunning(false)
    setReloadKey((k) => k + 1)
    setSelected([])
  }

  function closeBulkAi() {
    setBulkAiOpen(false)
    setBulkAiDone(0)
    setBulkAiTotal(0)
    setBulkAiError('')
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Ürünler</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} ürün bulundu · {activeCount} satışta · Sayfa {page} / {lastPage}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Min fiyat"
          value={filters.priceMin}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, priceMin: e.target.value }))
          }}
          className="w-28 border rounded px-2 py-1.5 text-sm"
          type="number"
        />
        <input
          placeholder="Max fiyat"
          value={filters.priceMax}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, priceMax: e.target.value }))
          }}
          className="w-28 border rounded px-2 py-1.5 text-sm"
          type="number"
        />
        <select
          value={filters.status}
          onChange={(e) => {
            setPage(1)
            setFilters((f) => ({ ...f, status: e.target.value as Filters['status'] }))
          }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {marketplaceOptions.map((m) => (
            <button
              key={m}
              onClick={() => toggleMarketplace(m)}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                filters.marketplaces.includes(m) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sayfa başına:</span>
          <select
            value={perPage}
            onChange={(e) => {
              setPage(1)
              setPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }}
            className="border rounded px-2 py-1 text-sm"
          >
            {[25, 50, 100, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="all">Tümü</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Önceki
          </button>
          <span className="text-sm text-gray-600">
            {page} / {lastPage}
          </span>
          <button
            disabled={page >= lastPage}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-gray-700">{selected.length} seçili</span>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
            >
              Toplu Sil
            </button>
            <button
              onClick={() => setBulkAiOpen(true)}
              className="px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded text-sm hover:bg-indigo-50"
            >
              Toplu Yapay Zeka
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      {loading && <div className="text-gray-500 text-sm">Yükleniyor…</div>}

      {!loading && (
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={selected.length === products.length && products.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 font-medium text-gray-600">Kod</th>
                <th className="px-3 py-2 font-medium text-gray-600">Ürün Adı</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Fiyat</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Stok</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Marka</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Pazaryerleri</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Durum</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-400">
                    Ürün bulunamadı.
                  </td>
                </tr>
              )}
              {products.map((p) => {
                const md = firstMd(p)
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="block max-w-[150px] truncate text-gray-500" title={p.code}>
                        {p.code}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block max-w-[360px] truncate font-medium" title={p.label}>
                        {p.label}
                      </span>
                      {p.media_url && (
                        <img src={p.media_url} alt="" className="mt-1 h-10 w-10 object-cover rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.price != null ? `${p.price} ₺` : '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.stock ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.brand ?? md?.brand ?? '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {(p.marketplaces ?? []).map((m) => (
                          <span
                            key={m}
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              m === 'Kendi Sitem' ? 'bg-gray-200 text-gray-700' : 'bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {m}
                          </span>
                        ))}
                        {(!p.marketplaces || p.marketplaces.length === 0) && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {md ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${md.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {md.status === 1 ? 'Satışta' : 'Satışta Değil'}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => openModal(p)} className="text-indigo-600 hover:underline">
                        Düzenle
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && product && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-lg p-6 w-[560px] max-w-full my-8 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Ürün Düzenle</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kod</label>
                <input
                  value={product.code}
                  onChange={(e) => setProduct({ ...product, code: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Ürün Adı</label>
                <input
                  value={product.label}
                  onChange={(e) => setProduct({ ...product, label: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fiyat (₺)</label>
                  <input
                    type="number"
                    value={product.price}
                    onChange={(e) => setProduct({ ...product, price: Number(e.target.value) })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stok</label>
                  <input
                    type="number"
                    value={product.stock}
                    onChange={(e) => setProduct({ ...product, stock: Number(e.target.value) })}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Marka</label>
                <input
                  list="brand-options"
                  value={product.brand}
                  onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Marka girin"
                />
                <datalist id="brand-options">
                  {brandOptions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                <input
                  list="category-options"
                  value={product.category}
                  onChange={(e) => {
                    const match = categoryOptions.find((o) => o.name === e.target.value)
                    setProduct({ ...product, category: e.target.value, category_id: match?.id ?? product.category_id })
                  }}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Kategori adı yazın veya seçin"
                />
                <datalist id="category-options">
                  {categoryOptions.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.id}
                    </option>
                  ))}
                </datalist>
                {product.category_id && <p className="text-xs text-gray-400 mt-1">Kategori ID: {product.category_id}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Görsel URL</label>
                <input
                  value={product.mediaUrl}
                  onChange={(e) => setProduct({ ...product, mediaUrl: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="https://..."
                />
                {product.mediaUrl && (
                  <img src={product.mediaUrl} alt="" className="mt-2 h-20 w-20 object-cover rounded border" />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">Açıklama</label>
                  <button
                    onClick={handleGenerateDescription}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Yapay Zeka ile Üret
                  </button>
                </div>
                <textarea
                  value={product.description}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  rows={3}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Ürün açıklaması"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Pazaryerleri</label>
                <div className="flex flex-wrap gap-1">
                  {marketplaceOptions
                    .filter((m) => m !== 'Pazaryeri Yok')
                    .map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setProduct((prev) => {
                            if (!prev) return prev
                            const has = prev.marketplaces.includes(m)
                            return {
                              ...prev,
                              marketplaces: has ? prev.marketplaces.filter((x) => x !== m) : [...prev.marketplaces, m],
                            }
                          })
                        }
                        className={`px-2.5 py-1 rounded-full text-xs border ${
                          product.marketplaces.includes(m)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={product.status === 1}
                    onChange={(e) => setProduct({ ...product, status: e.target.checked ? 1 : 0 })}
                  />
                  Satışta (Kendi Sitem)
                </label>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button onClick={handleDelete} className="px-3 py-1.5 text-red-600 hover:underline text-sm">
                Sil
              </button>
              <div className="flex gap-2">
                <button onClick={() => setModalOpen(false)} className="px-4 py-1.5 border rounded text-sm">
                  İptal
                </button>
                <button onClick={handleSubmit} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm">
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkAiOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-[440px] max-w-full shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Toplu Yapay Zeka Üretimi</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selected.length} ürün için seçilen alan üretilecek ve mevcut içeriğin üzerine yazılacak. İşlem tek tek
              sırayla yapılır, sayfayı kapatmayın.
            </p>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={bulkAiField === 'description'}
                  onChange={() => setBulkAiField('description')}
                  disabled={bulkAiRunning}
                />{' '}
                Açıklama
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={bulkAiField === 'title'}
                  onChange={() => setBulkAiField('title')}
                  disabled={bulkAiRunning}
                />{' '}
                Başlık
              </label>
            </div>

            {bulkAiRunning && (
              <div className="mb-3 text-sm text-gray-700">
                İşleniyor: {bulkAiDone} / {bulkAiTotal}
              </div>
            )}
            {!bulkAiRunning && bulkAiTotal > 0 && bulkAiDone === bulkAiTotal && (
              <div className="mb-3 text-sm text-green-600">
                Tamamlandı. {bulkAiError ? 'Bazı ürünlerde hata oluştu.' : 'Tümü başarıyla güncellendi.'}
              </div>
            )}
            {bulkAiError && (
              <pre className="text-xs text-red-600 whitespace-pre-wrap max-h-32 overflow-auto mb-3 border rounded p-2 bg-red-50">
                {bulkAiError}
              </pre>
            )}

            <div className="flex justify-end gap-2">
              {!bulkAiRunning && (
                <button onClick={closeBulkAi} className="px-3 py-1.5 border rounded text-sm">
                  Kapat
                </button>
              )}
              {!bulkAiRunning && (
                <button
                  onClick={handleBulkAi}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm"
                >
                  Başlat
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
