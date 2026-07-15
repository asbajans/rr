'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import { Product, MarketplaceEntry, MarketplaceCategory, Category } from '@/lib/types'

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
  images: string[]
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
  const [categoriesFlat, setCategoriesFlat] = useState<Category[]>([])

  // category options per marketplace (marketplace trees, or universal categories for Kendi Sitem)
  function catOptionsFor(mp: string): { id: string; name: string }[] {
    if (mp === 'Kendi Sitem') {
      return (categoriesFlat ?? []).map((c) => ({ id: String(c.id), name: c.path || c.name }))
    }
    const tree = marketplaceTrees[mp] ?? []
    const opts: { id: string; name: string }[] = []
    const walk = (nodes: MarketplaceCategory[], prefix: string) => {
      nodes.forEach((n) => {
        const name = prefix ? `${prefix} / ${n.name}` : n.name
        opts.push({ id: String(n.marketplace_category_id), name })
        if (n.children?.length) walk(n.children, name)
      })
    }
    walk(tree, '')
    const seen = new Set<string>()
    return opts.filter((o) => {
      if (seen.has(o.id)) return false
      seen.add(o.id)
      return true
    })
  }

  // brand options collected from products for a given marketplace
  function brandsFor(mp: string): string[] {
    const set = new Set<string>()
    products.forEach((p) => {
      const md = p.marketplace_data?.[mp]
      if (md?.brand) set.add(md.brand)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }

  const [selected, setSelected] = useState<string[]>([])

  // product edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [product, setProduct] = useState<ProductModalData | null>(null)

  // bulk AI modal
  const [bulkAiOpen, setBulkAiOpen] = useState(false)
  const [bulkAiField, setBulkAiField] = useState<'title' | 'description' | 'all'>('description')
  const [uploading, setUploading] = useState(false)

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        const res = await api.uploadImage(f)
        if (res.url) urls.push(res.url)
      }
      if (urls.length) {
        setProduct((prev) => (prev ? { ...prev, images: [...prev.images, ...urls] } : prev))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }
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

  // load marketplace trees + universal categories once
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
      try {
        const res = await api.getCategoriesFlat()
        setCategoriesFlat(res.data ?? [])
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
    () => products.filter((p) => p.status === 1).length,
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
      images: p.images && p.images.length ? p.images.map((u) => u) : (p.media_url ? [p.media_url] : []),
      marketplaces: p.marketplaces ?? [],
      marketplace_data: p.marketplace_data ?? {},
      description: p.description ?? '',
    })
    setCreating(false)
    setModalOpen(true)
  }

  function openCreateModal() {
    setProduct({
      id: '',
      code: '',
      label: '',
      price: 0,
      stock: 0,
      status: 1,
      category: '',
      category_id: '',
      brand: '',
      images: [],
      marketplaces: [],
      marketplace_data: {},
      description: '',
    })
    setCreating(true)
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!product) return
    const marketplace_data: Record<string, MarketplaceEntry> = {}
    product.marketplaces.forEach((m) => {
      const md = product.marketplace_data[m] ?? {}
      marketplace_data[m] = {
        category: md.category ?? '',
        category_id: md.category_id ?? '',
        brand: md.brand ?? '',
        on_sale: m === 'Kendi Sitem' ? product.status === 1 : !!md.on_sale,
        status: m === 'Kendi Sitem' ? product.status : (md.on_sale ? 1 : 0),
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
    const code = product.code.trim()
    if (code) payload.code = code
    const imgs = product.images.map((s) => s.trim()).filter(Boolean)
    if (imgs.length) payload.media_urls = imgs
    if (product.description.trim()) payload.description = product.description.trim()

    try {
      if (creating) {
        const finalCode = code || `PRD-${Date.now()}`
        await api.createAdminProduct({ ...(payload as any), code: finalCode })
      } else {
        await api.updateAdminProduct(product.id, payload)
      }
      setModalOpen(false)
      setCreating(false)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    }
  }

  function updateMd(mp: string, patch: Partial<MarketplaceEntry>) {
    setProduct((prev) => {
      if (!prev) return prev
      const cur = prev.marketplace_data[mp] ?? {}
      return {
        ...prev,
        marketplace_data: {
          ...prev.marketplace_data,
          [mp]: { ...cur, ...patch },
        },
      }
    })
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

  function aiContext() {
    const md = product?.marketplace_data ? Object.values(product.marketplace_data)[0] : undefined
    return {
      name: product?.label ?? '',
      brand: md?.brand ?? product?.brand ?? '',
      category: md?.category ?? '',
      price: product?.price,
    }
  }

  async function handleAiDescription() {
    if (!product) return
    try {
      const res = await api.generateProductDescription({ ...aiContext(), field: 'description' })
      if (res.description) setProduct({ ...product, description: res.description })
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleAiTitle() {
    if (!product) return
    try {
      const res = await api.generateProductDescription({ ...aiContext(), field: 'title' })
      if (res.title) setProduct({ ...product, label: res.title })
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleAiAll() {
    if (!product) return
    const ctx = aiContext()
    try {
      const [d, t] = await Promise.all([
        api.generateProductDescription({ ...ctx, field: 'description' }),
        api.generateProductDescription({ ...ctx, field: 'title' }),
      ])
      setProduct((prev) =>
        prev
          ? { ...prev, description: d.description ?? prev.description, label: t.title ?? prev.label }
          : prev
      )
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleImageAiEdit(index: number) {
    if (!product) return
    const url = product.images[index]?.trim()
    if (!url) {
      setError('Önce bir görsel URL girin')
      return
    }
    const prompt = window.prompt(
      'Görsel için AI düzenleme talimatı (örn: beyaz arka plan, profesyonel ürün fotoğrafı):',
      'beyaz arka plan, daha parlak, profesyonel ürün fotoğrafı'
    )
    if (prompt === null) return
    try {
      const md = product.marketplace_data ? Object.values(product.marketplace_data)[0] : undefined
      const res = await api.editProductImage({
        image_urls: [url],
        prompt,
        category: md?.category || product.category || undefined,
      })
      const sid = res.sessionId
      if (!sid) throw new Error('AI oturumu başlatılamadı')
      let files: string[] = []
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await api.getAiStatus(sid)
        if (st.ready && st.ready.length > 0) {
          files = st.ready
          break
        }
      }
      if (files.length === 0) throw new Error('Görsel üretilemedi')
      for (const file of files) {
        const outUrl = api.getAiOutputUrl(sid, file)
        const blob = await fetch(outUrl).then((r) => r.blob())
        const uploaded = await api.uploadImage(new File([blob], file, { type: blob.type }))
        if (uploaded.url) {
          setProduct((prev) => {
            if (!prev) return prev
            const imgs = [...prev.images]
            imgs[index] = uploaded.url as string
            return { ...prev, images: imgs }
          })
        }
      }
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
          field: bulkAiField === 'all' ? 'description' : bulkAiField,
        })
        const patch: { label?: string; description?: string } =
          bulkAiField === 'title'
            ? { label: res.title ?? p?.label ?? '' }
            : bulkAiField === 'description'
              ? { description: res.description ?? '' }
              : { label: res.title ?? p?.label ?? '', description: res.description ?? '' }
        if (bulkAiField === 'all') {
          const t = await api.generateProductDescription({
            name: p?.label || '',
            brand: p?.brand || md?.brand || '',
            category: md?.category || '',
            price: p?.price,
            field: 'title',
          })
          patch.label = t.title ?? p?.label ?? ''
        }
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
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 whitespace-nowrap"
        >
          + Ürün Ekle
        </button>
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
                      <span className={`px-2 py-0.5 rounded text-xs ${p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.status === 1 ? 'Satışta' : 'Satışta Değil'}
                      </span>
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
              <h3 className="font-semibold text-lg">{creating ? 'Ürün Ekle' : 'Ürün Düzenle'}</h3>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">Görseller ({product.images.filter(Boolean).length})</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setProduct((prev) => (prev ? { ...prev, images: [...prev.images, ''] } : prev))
                      }
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      + Görsel ekle
                    </button>
                    <label className="text-xs text-green-600 hover:underline cursor-pointer">
                      {uploading ? 'Yükleniyor...' : 'Bilgisayardan yükle'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleUploadFiles(e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: Math.max(product.images.length, 6) }).map((_, idx) => {
                    const img = product.images[idx] ?? ''
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={img}
                          onChange={(e) => {
                            const next = [...product.images]
                            next[idx] = e.target.value
                            setProduct({ ...product, images: next })
                          }}
                          className="flex-1 border rounded px-2 py-1.5 text-sm"
                          placeholder="https://..."
                        />
                        {img.trim() && (
                          <img src={img} alt="" className="h-10 w-10 object-cover rounded border flex-shrink-0" />
                        )}
                        {img.trim() && (
                          <button
                            type="button"
                            onClick={() => handleImageAiEdit(idx)}
                            className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                            title="Yapay zeka ile düzenle"
                          >
                            AI Düzenle
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setProduct((prev) => (prev ? { ...prev, images: prev.images.filter((_, i) => i !== idx) } : prev))}
                          className="text-xs text-red-600 hover:underline whitespace-nowrap"
                        >
                          Sil
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">Açıklama</label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={handleAiDescription} className="text-xs text-indigo-600 hover:underline">
                      Yapay Zeka ile açıklama oluştur
                    </button>
                    <button onClick={handleAiTitle} className="text-xs text-indigo-600 hover:underline">
                      Yapay Zeka ile başlık oluştur
                    </button>
                    <button onClick={handleAiAll} className="text-xs text-indigo-600 hover:underline">
                      Yapay Zeka ile tüm içeriği düzenle
                    </button>
                  </div>
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

              {product.marketplaces.length > 0 && (
                <div className="border rounded p-3 space-y-3">
                  <p className="text-xs font-medium text-gray-500">Pazaryeri Detayları</p>
                  {product.marketplaces.map((mp) => {
                    const md = product.marketplace_data[mp] ?? {}
                    const catOpts = catOptionsFor(mp)
                    const brOpts = brandsFor(mp)
                    return (
                      <div key={mp} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{mp}</span>
                          {mp !== 'Kendi Sitem' && (
                            <label className="flex items-center gap-1.5 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={!!md.on_sale}
                                onChange={(e) => updateMd(mp, { on_sale: e.target.checked })}
                              />
                              Bu pazaryerinde satışta
                            </label>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                            <input
                              list={`cat-${mp}`}
                              value={md.category ?? ''}
                              onChange={(e) => {
                                const match = catOpts.find((o) => o.name === e.target.value)
                                updateMd(mp, { category: e.target.value, category_id: match?.id ?? md.category_id ?? '' })
                              }}
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder={mp === 'Kendi Sitem' ? 'Kategori seçin' : 'Kategori seçin'}
                            />
                            <datalist id={`cat-${mp}`}>
                              {catOpts.map((o) => (
                                <option key={o.id} value={o.name}>
                                  {o.id}
                                </option>
                              ))}
                            </datalist>
                            {md.category_id && <p className="text-xs text-gray-400 mt-1">ID: {md.category_id}</p>}
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Marka</label>
                            <input
                              list={`brand-${mp}`}
                              value={md.brand ?? ''}
                              onChange={(e) => updateMd(mp, { brand: e.target.value })}
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Marka"
                            />
                            <datalist id={`brand-${mp}`}>
                              {brOpts.map((b) => (
                                <option key={b} value={b} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
              {!creating && (
                <button onClick={handleDelete} className="px-3 py-1.5 text-red-600 hover:underline text-sm">
                  Sil
                </button>
              )}
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={bulkAiField === 'all'}
                  onChange={() => setBulkAiField('all')}
                  disabled={bulkAiRunning}
                />{' '}
                Tüm içeriği oluştur
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
