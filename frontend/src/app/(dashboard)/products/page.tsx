'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Product, B2bSetting, MarketplaceIntegration } from '@/lib/types'

const MAX_IMAGES = 12

type ImageItem = { kind: 'file' | 'url'; file?: File; url?: string; preview: string }

type MarketplaceEntry = { category: string; brand: string; on_sale: boolean }

type ProductForm = {
  code: string
  label: string
  price: string
  stock: string
  status: number
  description: string
  marketplaces: string[]
  marketplaceData: Record<string, MarketplaceEntry>
  images: ImageItem[]
  b2b_enabled: boolean
  b2b_discount: string
  b2b_price: string
}

type VariantForm = { sku: string; price: string; stock: string; attributes: string }

const emptyForm: ProductForm = {
  code: '',
  label: '',
  price: '',
  stock: '',
  status: 1,
  description: '',
  images: [],
  marketplaces: [],
  marketplaceData: {},
  b2b_enabled: false,
  b2b_discount: '',
  b2b_price: '',
}

const MARKETPLACE_LABELS: Record<string, string> = {
  own: 'Kendi Sitem',
  trendyol: 'Trendyol',
  hepsiburada: 'Hepsiburada',
  pazarama: 'Pazarama',
  n11: 'N11',
  amazon: 'Amazon TR',
  __none__: 'Pazaryeri Yok',
}

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [integrations, setIntegrations] = useState<MarketplaceIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterMarketplaces, setFilterMarketplaces] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriceMin, setFilterPriceMin] = useState('')
  const [filterPriceMax, setFilterPriceMax] = useState('')
  const [marketplaceImages, setMarketplaceImages] = useState<string[]>([])
  const [taxonomies, setTaxonomies] = useState<{ categories: Record<string, string[]>; brands: Record<string, string[]> }>({ categories: {}, brands: {} })
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [showAiImagePanel, setShowAiImagePanel] = useState(false)
  const [aiEditSelected, setAiEditSelected] = useState<string[]>([])
  const [aiEditPrompt, setAiEditPrompt] = useState('')
  const [aiEditLoading, setAiEditLoading] = useState(false)
  const [aiEditError, setAiEditError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)

  const [variants, setVariants] = useState<import('@/lib/types').ProductVariant[]>([])
  const [variantForm, setVariantForm] = useState<VariantForm>({ sku: '', price: '', stock: '', attributes: '' })
  const [variantLoading, setVariantLoading] = useState(false)

  function defaultMarketplaces(): string[] {
    return ['own', ...integrations.map((i) => i.marketplace)]
  }

  function initMarketplaceData(keys: string[]): Record<string, MarketplaceEntry> {
    const data: Record<string, MarketplaceEntry> = {}
    keys.forEach((k) => {
      data[k] = { category: '', brand: '', on_sale: true }
    })
    return data
  }

  function categoryOptions(mp: string): string[] {
    return taxonomies.categories[mp] ?? []
  }

  function brandOptions(mp: string): string[] {
    return taxonomies.brands[mp] ?? []
  }

  function loadTaxonomies() {
    api.getProductTaxonomies().then((res) => setTaxonomies(res)).catch(() => {})
  }

  function toggleAiEditImage(u: string) {
    setAiEditSelected((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]))
  }

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const marketplaceOptions = ['own', ...integrations.map((i) => i.marketplace)]
  const NONE_SENTINEL = '__none__'
  const marketplaceFilterOptions = [...marketplaceOptions, NONE_SENTINEL]

  const loadProducts = useCallback(() => {
    setLoading(true)
    api.getAdminProducts({
      marketplaces: filterMarketplaces,
      status: filterStatus as '' | '1' | '0',
      priceMin: filterPriceMin,
      priceMax: filterPriceMax,
    })
      .then((res) => setProducts(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [filterMarketplaces, filterStatus, filterPriceMin, filterPriceMax])

  function toggleFilterMarketplace(key: string) {
    setFilterMarketplaces((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]
    )
  }

  function clearFilters() {
    setFilterMarketplaces([])
    setFilterStatus('')
    setFilterPriceMin('')
    setFilterPriceMax('')
  }

  useEffect(() => {
    api.getIntegrations()
      .then((res) => setIntegrations(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  function openCreate() {
    setEditingId(null)
    const mps = defaultMarketplaces()
    setForm({ ...emptyForm, marketplaces: mps, marketplaceData: initMarketplaceData(mps) })
    setMarketplaceImages([])
    setVariants([])
    setVariantForm({ sku: '', price: '', stock: '', attributes: '' })
    setShowAiImagePanel(false)
    setAiEditSelected([])
    setAiEditPrompt('')
    setAiEditError('')
    loadTaxonomies()
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setMarketplaceImages(p.images ?? [])
    loadTaxonomies()

    const mps = p.marketplaces && p.marketplaces.length ? p.marketplaces : ['own']
    const md = p.marketplace_data ?? {}
    const data: Record<string, MarketplaceEntry> = {}
    mps.forEach((mp) => {
      const entry = md[mp]
      data[mp] = entry
        ? { category: entry.category ?? '', brand: entry.brand ?? '', on_sale: !!entry.on_sale }
        : { category: p.category ?? '', brand: p.brand ?? '', on_sale: p.status === 1 }
    })

    setForm({
      code: p.code,
      label: p.label,
      price: p.price?.toString() ?? '',
      stock: p.stock?.toString() ?? '',
      status: p.status,
      description: p.description ?? '',
      images: (p.images ?? []).map((u) => ({ kind: 'url' as const, url: u, preview: u })),
      marketplaces: mps,
      marketplaceData: data,
      b2b_enabled: false,
      b2b_discount: '',
      b2b_price: '',
    })
    setShowAiImagePanel(false)
    setAiEditSelected([])
    setAiEditPrompt('')
    setAiEditError('')
    setShowModal(true)

    api.getB2bSettings(p.id).then((res) => {
      const s = res as B2bSetting
      if (s.is_b2b_enabled) {
        setForm((prev) => ({ ...prev, b2b_enabled: true, b2b_discount: s.b2b_discount?.toString() ?? '', b2b_price: s.b2b_price?.toString() ?? '' }))
      }
    }).catch(() => {})

    api.getProductVariants(p.id).then((res) => {
      setVariants(res.data ?? [])
    }).catch(() => { setVariants([]) })
  }

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - form.images.length)
    if (!files.length) return
    const added = files.map((f) => ({ kind: 'file' as const, file: f, preview: URL.createObjectURL(f) }))
    setForm({ ...form, images: [...form.images, ...added].slice(0, MAX_IMAGES) })
  }

  function removeImage(idx: number) {
    setForm((prev) => {
      const item = prev.images[idx]
      if (item?.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview)
      return { ...prev, images: prev.images.filter((_, i) => i !== idx) }
    })
  }

  async function generateDescription() {
    if (!form.label.trim()) {
      setError('Önce ürün adını girin')
      return
    }
    const ref = form.marketplaces[0] ? form.marketplaceData[form.marketplaces[0]] : undefined
    setAiDescLoading(true)
    try {
      const res = await api.generateProductDescription({
        name: form.label,
        brand: ref?.brand || undefined,
        category: ref?.category || undefined,
        price: form.price ? parseFloat(form.price) : undefined,
      })
      setForm((prev) => ({ ...prev, description: res.description }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Açıklama üretilemedi')
    } finally {
      setAiDescLoading(false)
    }
  }

  async function runAiEdit() {
    if (aiEditSelected.length === 0 || !aiEditPrompt.trim()) return
    setAiEditLoading(true)
    setAiEditError('')
    try {
      const ref = form.marketplaces[0] ? form.marketplaceData[form.marketplaces[0]] : undefined
      const res = await api.editProductImage({
        image_urls: aiEditSelected,
        prompt: aiEditPrompt,
        category: ref?.category || undefined,
      })
      const sessionId = res.sessionId
      if (!sessionId) throw new Error('AI oturumu başlatılamadı')

      let ready: string[] = []
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000))
        const st = await api.getAiStatus(sessionId)
        if (st.ready && st.ready.length > 0) {
          ready = st.ready
          break
        }
      }
      if (ready.length === 0) throw new Error('Görsel üretilemedi')

      for (const file of ready) {
        const url = api.getAiOutputUrl(sessionId, file)
        const blob = await fetch(url).then((r) => r.blob())
        const uploaded = await api.uploadImage(new File([blob], file, { type: blob.type }))
        const newImg: ImageItem = { kind: 'url', url: uploaded.url, preview: uploaded.url }
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, newImg].slice(0, MAX_IMAGES),
        }))
      }

      setShowAiImagePanel(false)
      setAiEditSelected([])
      setAiEditPrompt('')
    } catch (err) {
      setAiEditError(err instanceof Error ? err.message : 'AI görsel hatası')
    } finally {
      setAiEditLoading(false)
    }
  }

  function toggleMarketplace(key: string) {
    setForm((prev) => {
      const has = prev.marketplaces.includes(key)
      const marketplaces = has
        ? prev.marketplaces.filter((m) => m !== key)
        : [...prev.marketplaces, key]
      const marketplaceData = { ...prev.marketplaceData }
      if (has) {
        delete marketplaceData[key]
      } else {
        marketplaceData[key] = { category: '', brand: '', on_sale: true }
      }
      return { ...prev, marketplaces, marketplaceData }
    })
  }

  function setEntry(key: string, patch: Partial<MarketplaceEntry>) {
    setForm((prev) => ({
      ...prev,
      marketplaceData: { ...prev.marketplaceData, [key]: { ...(prev.marketplaceData[key] ?? { category: '', brand: '', on_sale: true }), ...patch } },
    }))
  }

  async function handleSave() {
    if (!form.code.trim() || !form.label.trim()) return
    setSaving(true)

    try {
      let mediaUrls: string[] = []
      let productId: string | null = editingId

      const fileItems = form.images.filter((i) => i.kind === 'file')
      if (fileItems.length) {
        const uploads = await Promise.all(fileItems.map((i) => api.uploadImage(i.file!)))
        mediaUrls = uploads.map((u) => u.url)
      }
      mediaUrls.push(...form.images.filter((i) => i.kind === 'url').map((i) => i.url!))

      const marketplaceData: Record<string, MarketplaceEntry> = {}
      form.marketplaces.forEach((mp) => {
        marketplaceData[mp] = form.marketplaceData[mp] ?? { category: '', brand: '', on_sale: true }
      })

      const payload: Record<string, unknown> = {
        code: form.code,
        label: form.label,
        price: form.price ? parseFloat(form.price) : null,
        stock: form.stock ? parseInt(form.stock) : null,
        status: form.status,
        description: form.description || null,
        marketplaces: form.marketplaces,
        marketplace_data: marketplaceData,
        media_urls: mediaUrls.slice(0, MAX_IMAGES),
      }

      if (editingId) {
        delete payload.code
        await api.updateAdminProduct(editingId, payload as Parameters<typeof api.updateAdminProduct>[1])
      } else {
        const created = await api.createAdminProduct(payload as unknown as Parameters<typeof api.createAdminProduct>[0])
        productId = (created as unknown as Record<string, string>).id
      }

      if (productId) {
        await api.updateB2bSettings({
          product_id: productId,
          is_b2b_enabled: form.b2b_enabled,
          b2b_discount: form.b2b_discount ? parseFloat(form.b2b_discount) : null,
          b2b_price: form.b2b_price ? parseFloat(form.b2b_price) : null,
        })
      }

      setShowModal(false)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
    setDeleting(id)
    try {
      await api.deleteAdminProduct(id)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setDeleting(null)
    }
  }

  async function handleAddVariant() {
    if (!editingId || !variantForm.sku.trim()) return
    setVariantLoading(true)
    try {
      let attrs: Record<string, string> | undefined
      if (variantForm.attributes.trim()) {
        try {
          attrs = JSON.parse(variantForm.attributes)
        } catch {
          attrs = undefined
        }
      }
      await api.createProductVariant({
        product_id: editingId,
        sku: variantForm.sku.trim(),
        price: variantForm.price ? parseFloat(variantForm.price) : undefined,
        stock: variantForm.stock ? parseInt(variantForm.stock) : undefined,
        attributes: attrs,
      })
      setVariantForm({ sku: '', price: '', stock: '', attributes: '' })
      const res = await api.getProductVariants(editingId)
      setVariants(res.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Varyasyon eklenemedi')
    } finally {
      setVariantLoading(false)
    }
  }

  async function handleDeleteVariant(variantId: number) {
    if (!editingId) return
    try {
      await api.deleteProductVariant(editingId, variantId)
      setVariants((prev) => prev.filter((v) => v.id !== variantId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Varyasyon silinemedi')
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Ürünler</h1>
          <p className="mt-1 text-sm text-zinc-600">Ürünlerini yönet, AI ile görsel düzenle.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ürün Ekle
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {marketplaceFilterOptions.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilterMarketplace(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                filterMarketplaces.includes(key)
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {MARKETPLACE_LABELS[key] ?? key}
            </button>
          ))}
        </div>

          <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Tüm Durumlar</option>
          <option value="1">Aktif</option>
          <option value="0">Aktif Değil</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={filterPriceMin}
            onChange={(e) => setFilterPriceMin(e.target.value)}
            placeholder="Min ₺"
            className="w-24 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
          />
          <span className="text-zinc-400">-</span>
          <input
            type="number"
            min="0"
            value={filterPriceMax}
            onChange={(e) => setFilterPriceMax(e.target.value)}
            placeholder="Max ₺"
            className="w-24 rounded-lg border border-zinc-300 px-2 py-2 text-sm"
          />
        </div>

        {(filterMarketplaces.length > 0 || filterStatus !== '' || filterPriceMin !== '' || filterPriceMax !== '') && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Temizle
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && !error && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Görsel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Ürün</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fiyat</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pazaryerleri</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {products.map((p) => {
                const image = (p as unknown as Record<string, string>).image
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-100">
                        {image ? (
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-300">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 0 002-2V6a2 0 00-2-2H6a2 0 00-2 2v12a2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{p.code}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{p.label}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                      {p.price !== null && p.price !== undefined
                        ? `${p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      <div className="flex flex-wrap gap-1">
                        {(p.marketplaces ?? []).map((m) => (
                          <span key={m} className="inline-flex rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            {MARKETPLACE_LABELS[m] ?? m}
                          </span>
                        ))}
                        {(!p.marketplaces || p.marketplaces.length === 0) && '-'}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {(() => {
                        const active = p.status === 1
                        return (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {active ? 'Aktif' : 'Aktif Değil'}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => openEdit(p)}
                        className="mr-2 text-zinc-500 hover:text-zinc-900"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === p.id ? 'Siliniyor...' : 'Sil'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz ürün eklenmemiş.</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">
              {editingId ? 'Ürünü Düzenle' : 'Yeni Ürün'}
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Kod</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingId}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                  placeholder="URUN-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Ürün Adı</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Ürün adı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Ürün açıklaması"
                />
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={aiDescLoading}
                  className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {aiDescLoading ? 'Üretiliyor…' : '✨ AI ile açıklama yaz (1 kredi)'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              {form.marketplaces.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-700">Pazaryeri Bazında Kategori / Marka / Satış Durumu</p>
                  {form.marketplaces.map((mp) => {
                    const entry = form.marketplaceData[mp] ?? { category: '', brand: '', on_sale: true }
                    const cats = categoryOptions(mp)
                    const brands = brandOptions(mp)
                    return (
                      <div key={mp} className="rounded-lg border border-zinc-200 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-800">{MARKETPLACE_LABELS[mp] ?? mp}</span>
                          <label className="flex items-center gap-2 text-xs text-zinc-600">
                            Satışta
                            <input
                              type="checkbox"
                              checked={entry.on_sale}
                              onChange={(e) => setEntry(mp, { on_sale: e.target.checked })}
                              className="h-4 w-4 rounded border-zinc-300"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-600">Kategori</label>
                            <input
                              list={`cat-${mp}`}
                              value={entry.category}
                              onChange={(e) => setEntry(mp, { category: e.target.value })}
                              placeholder="Kategori yazın veya seçin"
                              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                            />
                            <datalist id={`cat-${mp}`}>
                              {cats.map((c: string) => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
                            {cats.length === 0 && (
                              <p className="mt-1 text-xs text-zinc-400">Henüz kategori yok — yazabilir veya ürünleri pazaryerinden aktarabilirsiniz.</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-600">Marka</label>
                            <input
                              list={`brand-${mp}`}
                              value={entry.brand}
                              onChange={(e) => setEntry(mp, { brand: e.target.value })}
                              placeholder="Marka yazın veya seçin"
                              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                            />
                            <datalist id={`brand-${mp}`}>
                              {brands.map((b: string) => (
                                <option key={b} value={b} />
                              ))}
                            </datalist>
                            {brands.length === 0 && (
                              <p className="mt-1 text-xs text-zinc-400">Henüz marka yok — yazabilir veya ürünleri pazaryerinden aktarabilirsiniz.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Görseller ({form.images.length}/{MAX_IMAGES})
                </label>

                {marketplaceImages.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-400">Pazaryeri görselleri (AI düzenleme kaynağı)</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {marketplaceImages.map((u, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleAiEditImage(u)}
                          className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 ${
                            aiEditSelected.includes(u) ? 'border-zinc-900' : 'border-transparent'
                          }`}
                        >
                          <img src={u} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-2">
                  {form.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {form.images.map((img, idx) => (
                        <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg bg-zinc-100">
                          <img src={img.preview} alt="Preview" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.images.length < MAX_IMAGES && (
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImagesChange}
                      className="block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                    />
                  )}
                  {marketplaceImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAiImagePanel(true)}
                      disabled={aiEditSelected.length === 0}
                      className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      ✨ AI ile görsel düzenle{aiEditSelected.length > 0 ? ` (${aiEditSelected.length} seçili)` : ''}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Pazaryerleri / Kanal</label>
                <p className="mt-1 text-xs text-zinc-400">Ürünün yayınlanacağı kanalları seçin.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {marketplaceOptions.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMarketplace(key)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        form.marketplaces.includes(key)
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      {MARKETPLACE_LABELS[key] ?? key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700">Aktif</label>
                <input
                  type="checkbox"
                  checked={form.status === 1}
                  onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </div>

              {editingId && (
                <div className="border-t border-zinc-200 pt-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Varyasyonlar</h3>
                  {variants.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {variants.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-800">{v.sku}</p>
                            <p className="text-zinc-500">
                              {v.price !== null ? `${v.price} ₺` : '-'} · Stok: {v.stock} · {v.is_active ? 'Aktif' : 'Pasif'}
                            </p>
                            {v.attributes && Object.keys(v.attributes).length > 0 && (
                              <p className="text-zinc-400">{Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(v.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Sil
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <input
                      value={variantForm.sku}
                      onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
                      placeholder="SKU"
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={variantForm.price}
                      onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                      placeholder="Fiyat"
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      type="number"
                      value={variantForm.stock}
                      onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                      placeholder="Stok"
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      value={variantForm.attributes}
                      onChange={(e) => setVariantForm({ ...variantForm, attributes: e.target.value })}
                      placeholder='{"renk":"kırmızı"}'
                      className="rounded-lg border border-zinc-300 px-2 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    disabled={variantLoading || !variantForm.sku.trim()}
                    className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {variantLoading ? 'Ekleniyor…' : 'Varyasyon Ekle'}
                  </button>
                </div>
              )}

              <div className="border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-semibold text-zinc-900">B2B Ayarları</h3>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.b2b_enabled}
                    onChange={(e) => setForm({ ...form, b2b_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label className="text-sm font-medium text-zinc-700">B2B'ye Aç</label>
                </div>
                {form.b2b_enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">B2B İndirim (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={form.b2b_discount}
                        onChange={(e) => setForm({ ...form, b2b_discount: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">B2B Fiyat (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.b2b_price}
                        onChange={(e) => setForm({ ...form, b2b_price: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code.trim() || !form.label.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>

          {showAiImagePanel && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
              <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-zinc-900">AI ile Görsel Düzenle</h3>
                <p className="mt-1 text-xs text-zinc-400">Pazaryerinden görselleri seçin ve bir prompt girin.</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {marketplaceImages.map((u, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleAiEditImage(u)}
                      className={`h-20 w-20 overflow-hidden rounded-lg border-2 ${
                        aiEditSelected.includes(u) ? 'border-zinc-900' : 'border-transparent'
                      }`}
                    >
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>

                <textarea
                  value={aiEditPrompt}
                  onChange={(e) => setAiEditPrompt(e.target.value)}
                  rows={3}
                  placeholder="Örn: ürünü doğayla bağla, pastel tonlar, 4K"
                  className="mt-3 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />

                {aiEditError && <div className="mt-2 text-sm text-red-600">{aiEditError}</div>}

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAiImagePanel(false)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={runAiEdit}
                    disabled={aiEditLoading || aiEditSelected.length === 0 || !aiEditPrompt.trim()}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {aiEditLoading ? 'Üretiliyor...' : 'Oluştur'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
