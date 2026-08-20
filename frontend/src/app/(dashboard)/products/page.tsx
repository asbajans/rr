'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { Product, MarketplaceEntry, MarketplaceCategory, Category, Brand } from '@/lib/types'
import { Sparkles, Camera, Coins, ArrowUpRight, Package } from 'lucide-react'
import { TableSkeleton, EmptyState } from '@/components/ui/skeleton'

interface Filters {
  marketplaces: string[]
  status: '' | '1' | '0'
  search: string
}

interface ProductModalData {
  id: string
  code: string
  label: string
  price: number
  price_currency: 'TRY' | 'USD'
  price_try: number | null
  price_usd: number | null
  stock: number
  status: number
  category: string
  category_id: string
  brand: string
  images: string[]
  marketplaces: string[]
  marketplace_data: Record<string, MarketplaceEntry>
  marketplace_sync: Record<string, import('@/lib/types').MarketplaceSyncEntry>
  description: string
  is_b2b_clone?: boolean
  b2b_enabled?: boolean
  b2b_discount?: number | null
  b2b_price?: number | null
}

function firstMd(p?: Product): MarketplaceEntry | undefined {
  if (!p?.marketplace_data) return undefined
  return Object.values(p.marketplace_data)[0]
}

export default function ProductsPage() {
  const router = useRouter()
  const { productLimit, can, refreshMe } = useAuth()
  const [planGate, setPlanGate] = useState<null | { type: 'product' | 'credits'; current?: number; limit?: number; required?: number }>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [perPage, setPerPage] = useState<number | 'all'>(25)
  const [reloadKey, setReloadKey] = useState(0)

  const [filters, setFilters] = useState<Filters>({ marketplaces: [], status: '', search: '' })
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }))
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])
  const [marketplaceTrees, setMarketplaceTrees] = useState<Record<string, MarketplaceCategory[]>>({})
  const [categoriesFlat, setCategoriesFlat] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  // category options per marketplace (marketplace trees, or universal categories for Kendi Sitem)
  function catOptionsFor(mp: string): { id: string; name: string }[] {
    if (mp === 'Kendi Sitem') {
      return (categoriesFlat ?? []).map((c) => {
        const catName = typeof c.name === 'object' ? ((c.name as Record<string, string>).tr || (c.name as Record<string, string>).en || '') : c.name
        return { id: String(c.id), name: c.path || catName }
      })
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

  // brand options from API
  function brandsFor(mp: string): { id: string; name: string }[] {
    return brands
      .filter((b) => {
        if (!b.isActive) return false
        if (mp === 'Kendi Sitem') return !b.marketplace || b.marketplace === 'Kendi Sitem'
        return b.marketplace === mp && !!b.marketplaceBrandId
      })
      .map((b) => ({ id: b.marketplaceBrandId!, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
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
  const [aiBusy, setAiBusy] = useState(false)

  // AI image edit (per-image prompt)
  const [aiEditIndex, setAiEditIndex] = useState<number | null>(null)
  const [aiEditPrompt, setAiEditPrompt] = useState('')
  const [aiEditing, setAiEditing] = useState(false)

  // bulk B2B modal
  const [bulkB2bOpen, setBulkB2bOpen] = useState(false)
  const [bulkB2bDiscount, setBulkB2bDiscount] = useState<string>('')
  const [bulkB2bPrice, setBulkB2bPrice] = useState<string>('')
  const [bulkB2bRunning, setBulkB2bRunning] = useState(false)

  // bulk price update modal
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  const [bulkPriceMode, setBulkPriceMode] = useState<'percentage' | 'fixed'>('percentage')
  const [bulkPriceAmount, setBulkPriceAmount] = useState<string>('')
  const [bulkPriceCurrency, setBulkPriceCurrency] = useState<'TRY' | 'USD'>('TRY')
  const [bulkPriceApplyTo, setBulkPriceApplyTo] = useState<'sale' | 'list' | 'both'>('sale')
  const [bulkPriceRunning, setBulkPriceRunning] = useState(false)
  const [bulkSiteRunning, setBulkSiteRunning] = useState(false)

  // per-marketplace verify
  const [verifyingMp, setVerifyingMp] = useState<string | null>(null)
  const [syncingMp, setSyncingMp] = useState<string | null>(null)
  const [syncingPid, setSyncingPid] = useState<string | null>(null)

  // marketplace category attributes
  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, any[]>>({})
  const [loadingAttrs, setLoadingAttrs] = useState<Record<string, boolean>>({})

  // marketplace shipment templates (N11 kargo şablonları)
  const [shipmentTemplates, setShipmentTemplates] = useState<Record<string, { templateName: string }[]>>({})

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
  const [b2bTab, setB2bTab] = useState<'0' | '1' | ''>('')

  const marketplaceOptions = ['Kendi Sitem', 'trendyol', 'hepsiburada', 'pazarama', 'n11', 'amazon', 'etsy', 'Pazaryeri Yok']
  const statusOptions: { value: '' | '1' | '0'; label: string }[] = [
    { value: '', label: 'Tümü' },
    { value: '1', label: 'Satışta' },
    { value: '0', label: 'Satışta Değil' },
  ]

  // load marketplace trees + universal categories + brands once
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
      try {
        const res = await api.getBrands()
        setBrands(res ?? [])
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
      .getAdminProducts({ ...filters, page, perPage, b2b: b2bTab || undefined })
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
  }, [filters, page, perPage, reloadKey, b2bTab])

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
      price: p.price_try ?? p.price_usd ?? p.price ?? 0,
      price_currency: p.price_currency ?? (p.price_try != null ? 'TRY' : p.price_usd != null ? 'USD' : 'TRY'),
      price_try: p.price_try ?? null,
      price_usd: p.price_usd ?? null,
      stock: p.stock ?? 0,
      status: p.status ?? (md?.on_sale ? 1 : 0),
      category: md?.category ?? '',
      category_id: md?.category_id ?? '',
      brand: p.brand ?? md?.brand ?? '',
      images: p.images && p.images.length ? p.images.map((u) => u) : (p.media_url ? [p.media_url] : []),
      marketplaces: p.marketplaces ?? [],
      marketplace_data: p.marketplace_data ?? {},
      marketplace_sync: p.marketplace_sync ?? {},
      description: p.description ?? '',
      is_b2b_clone: p.is_b2b_clone ?? false,
      b2b_enabled: p.b2b_enabled ?? false,
      b2b_discount: p.b2b_discount ?? null,
      b2b_price: p.b2b_price ?? null,
    })
    setCreating(false)
    setModalOpen(true)
    if (p.marketplaces && p.marketplace_data) {
      Object.entries(p.marketplace_data).forEach(([mp, md]: [string, any]) => {
        if (md?.category_id && mp !== 'Kendi Sitem') {
          loadCategoryAttrs(mp, md.category_id)
        }
      })
    }
    if (p.marketplaces?.includes('n11')) loadShipmentTemplates('n11')
    if (product?.id) {
      api.getB2bSettings(product.id).then((b) => {
        const setting = (b && 'is_b2b_enabled' in b ? b : null) as { is_b2b_enabled?: boolean; b2b_discount?: number | null; b2b_price?: number | null } | null
        setProduct((prev) => prev ? {
          ...prev,
          b2b_enabled: !!setting?.is_b2b_enabled,
          b2b_discount: setting?.b2b_discount ?? null,
          b2b_price: setting?.b2b_price ?? null,
        } : prev)
      }).catch(() => {})
    }
  }

  function openCreateModal() {
    if (productLimit >= 0 && total >= productLimit) {
      setPlanGate({ type: 'product', current: total, limit: productLimit })
      return
    }
    setProduct({
      id: '',
      code: '',
      label: '',
      price: 0,
      price_currency: 'TRY',
      price_try: null,
      price_usd: null,
      stock: 0,
      status: 1,
      category: '',
      category_id: '',
      brand: '',
      images: [],
      marketplaces: [],
      marketplace_data: {},
      marketplace_sync: {},
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
      let brand_id = md.brand_id ?? ''
      const isNumericId = brand_id && !isNaN(Number(brand_id)) && Number(brand_id) > 0
      if (!isNumericId && md.brand) {
        const match = brands.find((b) => b.name === md.brand && b.marketplace === m && b.marketplaceBrandId)
        if (match) brand_id = match.marketplaceBrandId!
      }
      marketplace_data[m] = {
        category: md.category ?? '',
        category_id: md.category_id ?? '',
        brand: md.brand ?? '',
        brand_id,
on_sale: !!md.on_sale,
                status: md.on_sale ? 1 : 0,
        attributes: md.attributes ?? [],
        shipmentTemplate: m === 'n11' ? (md.shipmentTemplate ?? '') : undefined,
      }
    })

    const payload: Record<string, unknown> = {
      label: product.label,
      price: Number(product.price),
      price_currency: product.price_currency,
      price_try: product.price_try,
      price_usd: product.price_usd,
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
        await api.updateB2bSettings({
          product_id: product.id,
          is_b2b_enabled: !!product.b2b_enabled,
          b2b_discount: product.b2b_discount ?? null,
          b2b_price: product.b2b_price ?? null,
        })
      }
      setModalOpen(false)
      setCreating(false)
      setReloadKey((k) => k + 1)
      if (!creating && product && (product.marketplaces ?? []).length > 0) {
        setTimeout(() => setReloadKey((k) => k + 1), 8000)
      }
    } catch (e: any) {
      if (e?.code === 'PLAN_PRODUCT_LIMIT') { setPlanGate({ type: 'product', current: e.data?.current, limit: e.data?.limit }); return }
      if (e?.code === 'INSUFFICIENT_CREDITS') { setPlanGate({ type: 'credits', required: e.data?.required }); return }
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

  async function handleVerify(mp: string) {
    if (!product || !product.id) return
    setVerifyingMp(mp)
    try {
      const res = await api.verifyProduct(product.id, mp)
      const entry: import('@/lib/types').MarketplaceSyncEntry = {
        status: res.verified ? 'synced' : 'error',
        marketplace_product_id: res.externalId ?? null,
        error_message: res.verified ? null : (res as any).message || 'Pazaryerinde bulunamadı',
        checked_at: new Date().toISOString(),
      }
      setProduct((prev) =>
        prev
          ? { ...prev, marketplace_sync: { ...(prev.marketplace_sync ?? {}), [mp]: entry } }
          : prev
      )
      if (!res.verified) setError((res as any).message || 'Pazaryerinde bulunamadı')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setVerifyingMp(null)
    }
  }

  async function handleSync(mp: string) {
    if (!product || !product.id) return
    setSyncingMp(mp)
    try {
      const res = await api.syncProduct(product.id, [mp])
      const entry: import('@/lib/types').MarketplaceSyncEntry = {
        status: 'pending',
        marketplace_product_id: null,
        error_message: null,
        checked_at: new Date().toISOString(),
      }
      setProduct((prev) =>
        prev
          ? { ...prev, marketplace_sync: { ...(prev.marketplace_sync ?? {}), [mp]: entry } }
          : prev
      )
      // Poll for result after 3 seconds
      setTimeout(async () => {
        try {
          const status = await api.getImportJobStatus(mp, res.jobId)
          const jobResult = status.result
          if (jobResult?.results?.[mp]?.success) {
            setProduct((prev) =>
              prev
                ? {
                    ...prev,
                    marketplace_sync: {
                      ...(prev.marketplace_sync ?? {}),
                      [mp]: { status: 'synced', marketplace_product_id: jobResult.results[mp].externalId ?? null, error_message: null, checked_at: new Date().toISOString() },
                    },
                  }
                : prev
            )
          } else if (status.failedReason || jobResult?.results?.[mp]?.error) {
            setProduct((prev) =>
              prev
                ? {
                    ...prev,
                    marketplace_sync: {
                      ...(prev.marketplace_sync ?? {}),
                      [mp]: { status: 'error', marketplace_product_id: null, error_message: jobResult?.results?.[mp]?.error || status.failedReason || 'Sync failed', checked_at: new Date().toISOString() },
                    },
                  }
                : prev
            )
          }
        } catch {}
      }, 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSyncingMp(null)
    }
  }

  async function loadCategoryAttrs(mp: string, categoryId: string) {
    if (!categoryId) return
    const key = `${mp}-${categoryId}`
    if (categoryAttrs[key]) return
    setLoadingAttrs((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await api.getMarketplaceCategoryAttributes(mp, categoryId)
      setCategoryAttrs((prev) => ({ ...prev, [key]: res.attributes ?? [] }))
    } catch {
      setCategoryAttrs((prev) => ({ ...prev, [key]: [] }))
    } finally {
      setLoadingAttrs((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function loadShipmentTemplates(mp: string) {
    if (!mp || shipmentTemplates[mp]) return
    try {
      const res = await api.getMarketplaceShipmentTemplates(mp)
      setShipmentTemplates((prev) => ({ ...prev, [mp]: res.templates ?? [] }))
    } catch {
      setShipmentTemplates((prev) => ({ ...prev, [mp]: [] }))
    }
  }

  function setAttrValue(mp: string, attributeId: number, value: number | string) {
    const md = product?.marketplace_data[mp] ?? {}
    const current = (md.attributes ?? []) as any[]
    const idx = current.findIndex((a: any) => a.attributeId === attributeId)
    const entry: any = { attributeId }
    if (typeof value === 'string') {
      entry.customValue = value
    } else {
      entry.attributeValueId = value
    }
    let next: any[]
    if (idx >= 0) {
      next = [...current]
      next[idx] = entry
    } else {
      next = [...current, entry]
    }
    updateMd(mp, { attributes: next })
  }

  async function handleDelete() {
    if (!product || !product.id) return
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
    setAiBusy(true)
    try {
      const res = await api.generateProductDescription({ ...aiContext(), field: 'description' })
      if (res.description) setProduct({ ...product, description: res.description })
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setPlanGate({ type: 'credits', required: e.data?.required }); refreshMe(); }
      else setError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleAiTitle() {
    if (!product) return
    setAiBusy(true)
    try {
      const res = await api.generateProductDescription({ ...aiContext(), field: 'title' })
      if (res.title) setProduct({ ...product, label: res.title })
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setPlanGate({ type: 'credits', required: e.data?.required }); refreshMe(); }
      else setError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  async function handleAiAll() {
    if (!product) return
    const ctx = aiContext()
    setAiBusy(true)
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
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setPlanGate({ type: 'credits', required: e.data?.required }); refreshMe(); }
      else setError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  function startAiEdit(index: number) {
    if (!product) return
    if (!product.images[index]?.trim()) {
      setError('Önce görsel URL girin veya "Bilgisayardan yükle" ile görsel ekleyin')
      setAiEditIndex(index)
      return
    }
    setAiEditIndex(index)
    setAiEditPrompt('beyaz arka plan, daha parlak, profesyonel ürün fotoğrafı')
    setError('')
  }

  async function handleImageAiEdit(index: number) {
    if (!product) return
    const url = product.images[index]?.trim()
    if (!url) {
      setError('Önce görsel URL girin')
      setAiEditIndex(index)
      return
    }
    const prompt = aiEditPrompt.trim()
    if (prompt.length < 3) {
      setError('AI düzenleme talimatı girin (en az 3 karakter)')
      return
    }
    setAiEditing(true)
    setError('')
    try {
      const md = product.marketplace_data ? Object.values(product.marketplace_data)[0] : undefined
      const res = await api.imageEdit({
        imageUrl: url,
        prompt,
        category: md?.category || product.category || undefined,
      })
      const sid = res.sessionId
      if (!sid) throw new Error('AI oturumu başlatılamadı')
      const files = await api.pollAiImageSession(sid)
      for (const file of files) {
        const uploaded = await api.takeAiResultImage(sid, file)
        if (uploaded.url) {
          setProduct((prev) => {
            if (!prev) return prev
            const imgs = [...prev.images]
            imgs[index] = uploaded.url as string
            return { ...prev, images: imgs }
          })
        }
      }
      setAiEditIndex(null)
      setAiEditPrompt('')
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setPlanGate({ type: 'credits', required: e.data?.required }); refreshMe(); }
      else if (e?.code === 'PLAN_MODULE_DISABLED') setError(e.message)
      else setError(e.message)
    } finally {
      setAiEditing(false)
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

  async function handleBulkAddToSite() {
    if (selected.length === 0) return
    setBulkSiteRunning(true)
    try {
      const res = await api.bulkAddToSite(selected.map(Number))
      setSelected([])
      setReloadKey((k) => k + 1)
      setNotice(`${res.updated} ürün kendi sitenize eklendi.`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBulkSiteRunning(false)
    }
  }

  async function handleBulkB2b() {
    if (selected.length === 0) return
    setBulkB2bRunning(true)
    try {
      const discount = bulkB2bDiscount.trim() === '' ? null : Number(bulkB2bDiscount)
      const price = bulkB2bPrice.trim() === '' ? null : Number(bulkB2bPrice)
      await api.bulkSetB2b(selected.map(Number), { isB2BEnabled: true, b2bDiscount: discount, b2bPrice: price })
      setBulkB2bOpen(false)
      setSelected([])
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBulkB2bRunning(false)
    }
  }

  async function handleBulkPriceUpdate() {
    if (selected.length === 0 || bulkPriceAmount.trim() === '') return
    setBulkPriceRunning(true)
    try {
      await api.bulkPriceUpdate(selected.map(Number), {
        mode: bulkPriceMode,
        amount: Number(bulkPriceAmount),
        currency: bulkPriceCurrency,
        applyTo: bulkPriceApplyTo,
      })
      setBulkPriceOpen(false)
      setBulkPriceAmount('')
      setSelected([])
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBulkPriceRunning(false)
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
        if (e?.code === 'INSUFFICIENT_CREDITS') {
          setPlanGate({ type: 'credits', required: e.data?.required })
          refreshMe()
          setBulkAiError((err) => `${err}Kredi yetersiz, işlem durduruldu.\n`)
          break
        }
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Ürünler</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} ürün bulundu · {activeCount} satışta · Sayfa {page} / {lastPage}
          </p>
          {productLimit >= 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 w-48 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${total >= productLimit ? 'bg-red-500' : total / productLimit > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (total / Math.max(1, productLimit)) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{total} / {productLimit} ürün</span>
              {total >= productLimit && (
                <button onClick={() => setPlanGate({ type: 'product', current: total, limit: productLimit })}
                  className="text-xs font-medium text-indigo-600 hover:underline">
                  Planını Yükselt
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
<button
  onClick={() => router.push('/ai/studio')}
  className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 whitespace-nowrap flex items-center gap-2"
>
  <Sparkles className="h-4 w-4" />
  <Camera className="h-4 w-4" />
  AI ile Ürün Ekle
</button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 whitespace-nowrap"
          >
            + Ürün Ekle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          placeholder="Ürün adı, kod (SKU) ara..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm min-w-[220px]"
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

      <div className="flex gap-2 mb-3 border-b border-gray-200">
        {[
          { v: '', label: 'Tüm Ürünler' },
          ...(can('b2b') ? [{ v: '1', label: 'B2B Ürünleri' }] : []),
          { v: '0', label: 'Kendi Ürünlerim' },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => {
              setB2bTab(t.v as '0' | '1' | '')
              setPage(1)
            }}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              b2bTab === t.v
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
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
              onClick={handleBulkAddToSite}
              disabled={bulkSiteRunning}
              className="px-3 py-1.5 border border-sky-300 text-sky-700 rounded text-sm hover:bg-sky-50 disabled:opacity-40"
            >
              {bulkSiteRunning ? 'Ekleniyor…' : 'Kendi Siteme Ekle'}
            </button>
            <button
              onClick={() => setBulkAiOpen(true)}
              className="px-3 py-1.5 border border-indigo-300 text-indigo-600 rounded text-sm hover:bg-indigo-50"
            >
              Toplu Yapay Zeka
            </button>
            {can('b2b') && (
              <button
                onClick={() => setBulkB2bOpen(true)}
                className="px-3 py-1.5 border border-emerald-300 text-emerald-700 rounded text-sm hover:bg-emerald-50"
              >
                Toplu B2B Aç
              </button>
            )}
            <button
              onClick={() => setBulkPriceOpen(true)}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded text-sm hover:bg-amber-50"
            >
              Toplu Fiyat Güncelle
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      {notice && <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded text-sm">{notice}</div>}
      {loading && <TableSkeleton rows={6} cols={5} />}

      {!loading && (
        <div className="table-scroll rounded-xl border border-zinc-200">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-8" />
              <col className="w-24" />
              <col />
              <col className="w-[20%]" />
              <col className="w-20" />
              <col className="w-12" />
              <col className="w-[14%]" />
              <col className="w-[15%]" />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={selected.length === products.length && products.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 font-medium text-gray-600 truncate">Kod</th>
                <th className="px-3 py-2 font-medium text-gray-600 truncate">Ürün Adı</th>
                <th className="px-3 py-2 font-medium text-gray-600 truncate">Kategori</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Fiyat</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Stok</th>
                <th className="px-3 py-2 font-medium text-gray-600 truncate">Marka</th>
                <th className="px-3 py-2 font-medium text-gray-600 truncate">Pazaryerleri</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Durum</th>
                <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-6">
                    <EmptyState
                      icon={<Package className="h-10 w-10" />}
                      title="Ürün bulunamadı"
                      description="Filtreleri değiştirmeyi deneyin veya yeni ürün oluşturun."
                    />
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
                      <span className="block truncate text-gray-500" title={p.code}>
                        {p.code}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block truncate font-medium" title={p.label}>
                        {p.label}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.is_b2b_clone && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-violet-100 text-violet-700" title="B2B klonlanmış ürün">
                            B2B Klon
                          </span>
                        )}
                        {p.b2b_enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700" title="Bu ürün B2B satışa açık">
                            B2B Açık
                            {p.b2b_discount ? ` %${p.b2b_discount}` : ''}
                          </span>
                        )}
                      </div>
                      {p.media_url && (
                        <img src={p.media_url} alt="" className="mt-1 h-10 w-10 object-cover rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="block truncate text-gray-500" title={p.category ?? md?.category ?? ''}>
                        {p.category ?? md?.category ?? '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.price != null ? (
                        <span>
                          {p.price_try != null ? <span className="block">{p.price_try.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span> : null}
                          {p.price_usd != null ? <span className="block text-xs text-gray-400">{p.price_usd.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} $</span> : null}
                          {p.price_try == null && p.price_usd == null ? <span>{p.price} {p.price_currency === 'USD' ? '$' : '₺'}</span> : null}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.stock ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className="block truncate" title={p.brand ?? md?.brand ?? '-'}>
                        {p.brand ?? md?.brand ?? '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(p.marketplaces ?? []).map((m) => {
                          const sync = p.marketplace_sync?.[m]
                          const dot =
                            sync?.status === 'synced'
                              ? 'bg-green-500'
                              : sync?.status === 'error'
                                ? 'bg-red-500'
                                : sync?.status === 'pending'
                                  ? 'bg-amber-500'
                                  : 'bg-gray-300'
                          return (
                            <span
                              key={m}
                              className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                                m === 'Kendi Sitem' ? 'bg-gray-200 text-gray-700' : 'bg-indigo-100 text-indigo-700'
                              }`}
                              title={
                                sync
                                  ? `Durum: ${sync.status}${sync.error_message ? ` - ${sync.error_message}` : ''}`
                                  : 'Henüz gönderilmedi'
                              }
                            >
                              <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                              {m}
                            </span>
                          )
                        })}
                        {(!p.marketplaces || p.marketplaces.length === 0) && <span className="text-gray-400">-</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs ${p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.status === 1 ? 'Satışta' : 'Satışta Değil'}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openModal(p)} className="text-indigo-600 hover:underline">
                          Düzenle
                        </button>
                        <button
                          onClick={async () => {
                            setSyncingPid(p.id)
                            try {
                              await api.syncProduct(p.id, p.marketplaces)
                            } catch (e: any) {
                              setError(e.message)
                            } finally {
                              setSyncingPid(null)
                              setReloadKey(k => k + 1)
                            }
                          }}
                          disabled={syncingPid === p.id}
                          className="text-green-600 hover:underline disabled:opacity-40"
                        >
                          {syncingPid === p.id ? 'Senkronize…' : 'Sync'}
                        </button>
                      </div>
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
              {product.is_b2b_clone && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  Bu ürün B2B ile klonlanmıştır. Kod, ad ve stok stok sahibi tarafından yönetilir ve değiştirilemez.
                  Fotoğrafı AI ile düzenleyip kendi fiyatınızı/pazaryerlerinizi ayarlayabilirsiniz.
                </div>
              )}
              {can('b2b') && !creating && !product.is_b2b_clone && (
                <div className="flex items-center justify-between border rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">B2B Satışa Aç</p>
                    <p className="text-xs text-zinc-500">Bu ürünü diğer mağazalar B2B üzerinden klonlayabilir.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProduct({ ...product, b2b_enabled: !product.b2b_enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      product.b2b_enabled ? 'bg-green-600' : 'bg-zinc-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        product.b2b_enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
              {can('b2b') && !creating && !product.is_b2b_clone && product.b2b_enabled && (
                <div className="grid grid-cols-2 gap-3 border rounded px-3 py-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">B2B İndirim (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={product.b2b_discount ?? ''}
                      onChange={(e) => setProduct({ ...product, b2b_discount: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">B2B Özel Fiyat (₺)</label>
                    <input
                      type="number"
                      min={0}
                      value={product.b2b_price ?? ''}
                      onChange={(e) => setProduct({ ...product, b2b_price: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="Boş = kendi fiyatı"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Kod</label>
                <input
                  value={product.code}
                  disabled={product.is_b2b_clone}
                  onChange={(e) => setProduct({ ...product, code: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Ürün Adı</label>
                <input
                  value={product.label}
                  disabled={product.is_b2b_clone}
                  onChange={(e) => setProduct({ ...product, label: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleAiTitle}
                    disabled={product.is_b2b_clone || aiBusy}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Yapay Zeka ile başlık oluştur
                  </button>
                  <button
                    type="button"
                    onClick={handleAiAll}
                    disabled={product.is_b2b_clone || aiBusy}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Yapay Zeka ile tüm içeriği düzenle
                  </button>
                </div>
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
                    disabled={product.is_b2b_clone}
                    onChange={(e) => setProduct({ ...product, stock: Number(e.target.value) })}
                    className="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400"
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
                        <button
                          type="button"
                          onClick={() => startAiEdit(idx)}
                          disabled={aiEditing}
                          className="text-xs text-indigo-600 hover:underline whitespace-nowrap disabled:opacity-40"
                          title="Yapay zeka ile düzenle"
                        >
                          {aiEditing && aiEditIndex === idx ? 'Yükleniyor...' : 'AI Düzenle'}
                        </button>
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
                  {aiEditIndex !== null && (
                    <div className="pt-1">
                      <label className="block text-[11px] text-gray-500">
                        AI düzenleme talimatı (görsel #{aiEditIndex + 1})
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          value={aiEditPrompt}
                          onChange={(e) => setAiEditPrompt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !aiEditing) handleImageAiEdit(aiEditIndex) }}
                          disabled={aiEditing}
                          placeholder="örn: beyaz arka plan, profesyonel ürün fotoğrafı"
                          className="flex-1 border rounded px-2 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleImageAiEdit(aiEditIndex)}
                          disabled={aiEditing}
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40"
                        >
                          {aiEditing ? 'İşleniyor...' : 'Uygula'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAiEditIndex(null); setAiEditPrompt('') }}
                          disabled={aiEditing}
                          className="px-2 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          Vazgeç
                        </button>
                      </div>
                      {aiEditing && <p className="mt-1 text-[11px] text-indigo-600">Görsel AI ile düzenleniyor (~1-2 dk), kredi düşülür...</p>}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-gray-500">Açıklama</label>
                  <button
                    type="button"
                    onClick={handleAiDescription}
                    disabled={aiBusy}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Yapay Zeka ile açıklama oluştur
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
                        onClick={() => {
                          if (!product.marketplaces.includes(m) && m === 'n11') loadShipmentTemplates('n11')
                          setProduct((prev) => {
                            if (!prev) return prev
                            const has = prev.marketplaces.includes(m)
                            return {
                              ...prev,
                              marketplaces: has ? prev.marketplaces.filter((x) => x !== m) : [...prev.marketplaces, m],
                            }
                          })
                        }}
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
                    const sync = product.marketplace_sync[mp]
                    const catOpts = catOptionsFor(mp)
                    const brOpts = brandsFor(mp)
                    const syncLabel =
                      sync?.status === 'synced'
                        ? 'Pazaryerinde var'
                        : sync?.status === 'error'
                          ? 'Hata'
                          : sync?.status === 'pending'
                            ? 'Gönderildi, kontrol ediliyor…'
                            : 'Henüz gönderilmedi'
                    const syncColor =
                      sync?.status === 'synced'
                        ? 'bg-green-100 text-green-700'
                        : sync?.status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : sync?.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                    return (
                      <div key={mp} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{mp}</span>
                          <div className="flex items-center gap-2">
                            {mp !== 'Kendi Sitem' && (
                              <span className={`px-2 py-0.5 rounded text-[10px] ${syncColor}`}>{syncLabel}</span>
                            )}
                            {mp !== 'Kendi Sitem' && (
                              <button
                                type="button"
                                onClick={() => handleVerify(mp)}
                                disabled={verifyingMp === mp || creating}
                                className="text-xs px-2 py-1 rounded border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40"
                              >
                                {verifyingMp === mp ? 'Doğrulanıyor…' : 'Doğrula'}
                              </button>
                            )}
                            {mp !== 'Kendi Sitem' && (
                              <button
                                type="button"
                                onClick={() => handleSync(mp)}
                                disabled={syncingMp === mp || creating}
                                className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-40"
                              >
                                {syncingMp === mp ? 'Senkronize…' : 'Sync'}
                              </button>
                            )}
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
                        </div>
                        {mp !== 'Kendi Sitem' && sync?.error_message && (
                          <p className="text-xs text-red-600 mb-2">{sync.error_message}</p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Kategori</label>
                            <input
                              list={`cat-${mp}`}
                              value={md.category ?? ''}
                              onChange={(e) => {
                                const match = catOpts.find((o) => o.name === e.target.value)
                                const cid = match?.id ?? md.category_id ?? ''
                                updateMd(mp, { category: e.target.value, category_id: cid })
                                if (cid && mp !== 'Kendi Sitem') loadCategoryAttrs(mp, cid)
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
                              onChange={(e) => {
                                const match = brOpts.find((o) => o.name === e.target.value)
                                updateMd(mp, { brand: e.target.value, brand_id: match?.id ?? md.brand_id ?? '' })
                              }}
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="Marka"
                            />
                            <datalist id={`brand-${mp}`}>
                              {brOpts.map((o) => (
                                <option key={o.id} value={o.name}>
                                  {o.id}
                                </option>
                              ))}
                            </datalist>
                            {md.brand_id && <p className="text-xs text-gray-400 mt-1">ID: {md.brand_id}</p>}
                          </div>
                        </div>
                        {mp === 'n11' && (
                          <div className="mt-2">
                            <label className="block text-xs text-gray-500 mb-1">
                              Kargo Şablonu <span className="text-red-500">*</span>
                            </label>
                            <input
                              list={`shipment-${mp}`}
                              value={md.shipmentTemplate ?? ''}
                              onChange={(e) => updateMd(mp, { shipmentTemplate: e.target.value })}
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              placeholder="N11 Teslimat Bilgilerindeki şablon adı"
                            />
                            <datalist id={`shipment-${mp}`}>
                              {(shipmentTemplates[mp] ?? []).map((t) => (
                                <option key={t.templateName} value={t.templateName} />
                              ))}
                            </datalist>
                            {(shipmentTemplates[mp] && shipmentTemplates[mp].length === 0) && (
                              <p className="text-xs text-amber-600 mt-1">
                                Kargo şablonları alınamadı — Hesabım &gt; Teslimat Bilgilerindeki şablonu adını yazın.
                              </p>
                            )}
                          </div>
                        )}
                        {mp !== 'Kendi Sitem' && md.category_id && (() => {
                          const key = `${mp}-${md.category_id}`
                          const rawAttrs = Array.isArray(categoryAttrs[key]) ? categoryAttrs[key] : []
                          const attrs = rawAttrs.filter((a: any) => {
                            const aid = a.attribute?.id ?? a.attributeId
                            return aid != null
                          })
                          const loading = loadingAttrs[key]
                          if (loading) return <p className="text-xs text-gray-400 mt-2">Özellikler yükleniyor…</p>
                          if (!attrs || attrs.length === 0) return null
                          return (
                            <div className="mt-2 pt-2 border-t space-y-2">
                              <p className="text-xs font-medium text-gray-500">Kategori Özellikleri</p>
                              <div className="grid grid-cols-2 gap-2">
                                {attrs.map((attr: any) => {
                                  const aid = attr.attribute?.id ?? attr.attributeId
                                  const aname = attr.attribute?.name ?? attr.name ?? `Attribute #${aid}`
                                  const current = (md.attributes ?? []).find((a: any) => a.attributeId === aid)
                                  const hasValues = Array.isArray(attr.attributeValues) && attr.attributeValues.length > 0
                                  return (
                                    <div key={aid}>
                                      <label className="block text-xs text-gray-500 mb-1">
                                        {aname}
                                        {attr.required && <span className="text-red-500 ml-0.5">*</span>}
                                      </label>
                                      {hasValues ? (
                                        <select
                                          value={current?.attributeValueId ?? ''}
                                          onChange={(e) => setAttrValue(mp, aid, Number(e.target.value))}
                                          className="w-full border rounded px-2 py-1.5 text-sm"
                                        >
                                          <option value="">Seçin</option>
                                          {attr.attributeValues.map((v: any) => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                          ))}
                                        </select>
                                      ) : attr.allowCustom ? (
                                        <input
                                          type="text"
                                          value={current?.customValue ?? (current?.attributeValueId ? String(current.attributeValueId) : '')}
                                          onChange={(e) => setAttrValue(mp, aid, e.target.value)}
                                          className="w-full border rounded px-2 py-1.5 text-sm"
                                          placeholder={`${aname} değeri girin`}
                                        />
                                      ) : null}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}

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

      {bulkB2bOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-[440px] max-w-full shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Toplu B2B'ye Aç</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selected.length} ürün B2B satışa açılacak. İndirim ve/veya özel B2B fiyatı boş bırakılabilir.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">B2B İndirim (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bulkB2bDiscount}
                  onChange={(e) => setBulkB2bDiscount(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="0"
                  disabled={bulkB2bRunning}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">B2B Özel Fiyat (₺)</label>
                <input
                  type="number"
                  min={0}
                  value={bulkB2bPrice}
                  onChange={(e) => setBulkB2bPrice(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Boş = kendi fiyatı"
                  disabled={bulkB2bRunning}
                />
              </div>
            </div>
            {bulkB2bRunning && <div className="mb-3 text-sm text-gray-700">Güncelleniyor…</div>}
            <div className="flex justify-end gap-2">
              {!bulkB2bRunning && (
                <button onClick={() => setBulkB2bOpen(false)} className="px-3 py-1.5 border rounded text-sm">
                  Kapat
                </button>
              )}
              {!bulkB2bRunning && (
                <button
                  onClick={handleBulkB2b}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm"
                >
                  B2B'ye Aç
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {bulkPriceOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-[480px] max-w-full shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Toplu Fiyat Güncelleme</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selected.length} ürün için fiyat güncellenecek.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">İşlem Türü</label>
                <select
                  value={bulkPriceMode}
                  onChange={(e) => setBulkPriceMode(e.target.value as 'percentage' | 'fixed')}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  disabled={bulkPriceRunning}
                >
                  <option value="percentage">Yüzde (%)</option>
                  <option value="fixed">Sabit Tutar (₺/$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {bulkPriceMode === 'percentage' ? 'Oran (%)' : 'Tutar'}
                </label>
                <input
                  type="number"
                  value={bulkPriceAmount}
                  onChange={(e) => setBulkPriceAmount(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder={bulkPriceMode === 'percentage' ? 'Örn: 20 (%%20 zam)' : 'Örn: 50'}
                  disabled={bulkPriceRunning}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {bulkPriceMode === 'percentage'
                    ? 'Pozitif = zam, Negatif = indirim (Örn: -10 = %%10 indirim)'
                    : 'Pozitif = zam, Negatif = indirim (Örn: -25 = 25₺ indirim)'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Para Birimi</label>
                <select
                  value={bulkPriceCurrency}
                  onChange={(e) => setBulkPriceCurrency(e.target.value as 'TRY' | 'USD')}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  disabled={bulkPriceRunning}
                >
                  <option value="TRY">₺ TRY</option>
                  <option value="USD">$ USD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nereye Uygulanacak</label>
                <select
                  value={bulkPriceApplyTo}
                  onChange={(e) => setBulkPriceApplyTo(e.target.value as 'sale' | 'list' | 'both')}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  disabled={bulkPriceRunning}
                >
                  <option value="sale">Satış Fiyatı</option>
                  <option value="list">Liste Fiyatı</option>
                  <option value="both">Her İkisi</option>
                </select>
              </div>
            </div>

            {bulkPriceRunning && <div className="mb-3 text-sm text-gray-700">Güncelleniyor…</div>}
            <div className="flex justify-end gap-2">
              {!bulkPriceRunning && (
                <button onClick={() => setBulkPriceOpen(false)} className="px-3 py-1.5 border rounded text-sm">
                  Kapat
                </button>
              )}
              {!bulkPriceRunning && (
                <button
                  onClick={handleBulkPriceUpdate}
                  disabled={bulkPriceAmount.trim() === ''}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm disabled:opacity-40"
                >
                  Fiyat Güncelle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {planGate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-[440px] max-w-full shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              {planGate.type === 'credits' ? (
                <Coins className="h-6 w-6 text-indigo-600" />
              ) : (
                <Package className="h-6 w-6 text-indigo-600" />
              )}
              <h3 className="font-semibold text-lg">
                {planGate.type === 'credits' ? 'AI Kredisi Yetersiz' : 'Ürün Limiti Doldu'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {planGate.type === 'credits'
                ? `İşlem için ${planGate.required ?? 'AI'} kredisi gerekli. Kredi satın alabilir veya üst pakete geçebilirsiniz.`
                : `Planınızdaki ürün limitine ulaştınız (${planGate.current ?? ''} / ${planGate.limit ?? ''}). Daha fazla ürün eklemek için üst pakete geçin.`}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPlanGate(null)} className="px-4 py-1.5 border rounded text-sm">
                Vazgeç
              </button>
              {planGate.type === 'credits' ? (
                <button
                  onClick={() => router.push('/credits')}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm flex items-center gap-1"
                >
                  Kredi Satın Al <ArrowUpRight className="h-4 w-4" />
                </button>
              ) : null}
              <button
                onClick={() => router.push('/billing')}
                className="px-4 py-1.5 bg-zinc-900 text-white rounded text-sm flex items-center gap-1"
              >
                Üst Pakete Geç <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
