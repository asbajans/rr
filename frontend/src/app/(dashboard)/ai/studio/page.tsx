'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { MarketplaceCategory, Brand, Category } from '@/lib/types'
import { Wand2, Loader2, Check, Coins, ArrowUpRight, ImageUp, RotateCcw, ShieldCheck, Send } from 'lucide-react'

type ChannelSelection = { categoryId?: string | number | null; brandId?: string | null; brand?: string | null }

const ALL_CHANNELS = [
  { key: 'storefront', n: 'Kendi Sitem' },
  { key: 'trendyol', n: 'Trendyol' },
  { key: 'n11', n: 'N11' },
  { key: 'hepsiburada', n: 'Hepsiburada' },
  { key: 'pazarama', n: 'Pazarama' },
  { key: 'amazon', n: 'Amazon' },
  { key: 'etsy', n: 'Etsy' },
]

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  published: { text: 'aiPublished', cls: 'bg-green-900/50 text-green-400' },
  queued: { text: 'aiQueued', cls: 'bg-blue-900/50 text-blue-400' },
  skipped: { text: 'aiSkipped', cls: 'bg-amber-900/50 text-amber-400' },
  failed: { text: 'aiFailed', cls: 'bg-red-900/50 text-red-400' },
}

const CHANNEL_STATUS: Record<string, { text: string; cls: string }> = {
  ready: { text: 'aiReady', cls: 'bg-green-900/50 text-green-400' },
  'integration-not-connected': { text: 'aiIntegrationMissing', cls: 'bg-amber-900/50 text-amber-400' },
  'category-mapping-needed': { text: 'aiCategoryMappingMissing', cls: 'bg-violet-900/50 text-violet-400' },
  'missing-fields': { text: 'aiFieldsMissing', cls: 'bg-red-900/50 text-red-400' },
}

const LISTING_STATUS: Record<string, { text: string; cls: string }> = {
  active: { text: 'aiActive', cls: 'bg-green-900/50 text-green-400' },
  publishing: { text: 'aiPublishing', cls: 'bg-blue-900/50 text-blue-400' },
  pending: { text: 'aiPending', cls: 'bg-amber-900/50 text-amber-400' },
  failed: { text: 'aiFailed', cls: 'bg-red-900/50 text-red-400' },
  inactive: { text: 'aiInactive', cls: 'bg-zinc-800 text-zinc-400' },
  deleted: { text: 'aiDeleted', cls: 'bg-zinc-800 text-zinc-400' },
}

function attributesToText(attributes: Record<string, unknown> | null | undefined): string {
  return Object.entries(attributes || {}).map(([key, value]) => `${key}: ${String(value)}`).join('\n')
}

function parseAttributes(value: string): Record<string, string> {
  const entries: Array<[string, string]> = []
  value.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const separator = line.indexOf(':')
    const key = separator > 0 ? line.slice(0, separator).trim() : ''
    const item = separator > 0 ? line.slice(separator + 1).trim() : ''
    if (key && item) entries.push([key, item])
  })
  return Object.fromEntries(entries)
}

export default function AiStudioPage() {
  const { t } = useI18n()
  const { user, can, refreshMe } = useAuth()
  const router = useRouter()
  const [gate, setGate] = useState<'product' | 'credits' | null>(null)

  // Create session
  const [rawFile, setRawFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [category, setCategory] = useState('diger')
  const [notes, setNotes] = useState({ short_description: '', keywords: '' })
  const [suggestPrice, setSuggestPrice] = useState(true)
  const [targetMps, setTargetMps] = useState<string[]>(['storefront'])
  const [creating, setCreating] = useState(false)

  // Draft
  const [draft, setDraft] = useState<any | null>(null)
  const [form, setForm] = useState({ title: '', category: '', short_description: '', description: '', keywords: '', tags: '', attributes: '', price: '', stock: '10', sku: '' })
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<any[]>([])

  // Images (edit existing / generate new) — every generation/düzenleme bills credits
  const [draftImages, setDraftImages] = useState<string[]>([])
  const [imgEditPrompt, setImgEditPrompt] = useState('')
  const [imgGenPrompt, setImgGenPrompt] = useState('')
  const [imgGenCount, setImgGenCount] = useState(1)
  const [aiImgBusy, setAiImgBusy] = useState<'edit' | 'generate' | null>(null)
  const [aiImgMsg, setAiImgMsg] = useState('')

  // Channels / publish
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [validation, setValidation] = useState<any[]>([])
  const [validating, setValidating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishResults, setPublishResults] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [retrying, setRetrying] = useState(false)

  // Per-channel marketplace category/brand selections (like the manual product form)
  const [marketplaceTrees, setMarketplaceTrees] = useState<Record<string, MarketplaceCategory[]>>({})
  const [categoriesFlat, setCategoriesFlat] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selections, setSelections] = useState<Record<string, ChannelSelection>>({})
  const [loadingSelectionData, setLoadingSelectionData] = useState(false)
  // Marketplace category attributes (for AI product creation)
  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, any[]>>({})
  const [loadingCategoryAttrs, setLoadingCategoryAttrs] = useState<Record<string, boolean>>({})

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadDrafts = useCallback(async () => {
    try {
      setDrafts(await api.listAiProductDrafts())
    } catch {
      setDrafts([])
    }
  }, [])

  useEffect(() => {
    if (can('ai_product_create')) loadDrafts()
  }, [can, loadDrafts])

  // Load marketplace category trees + universal categories + brands (for per-channel selectors)
  useEffect(() => {
    setLoadingSelectionData(true)
    ;(async () => {
      try {
        const res = await api.getMarketplaceTrees()
        setMarketplaceTrees(res.trees ?? {})
      } catch { /* ignore */ }
      try {
        const res = await api.getCategoriesFlat()
        setCategoriesFlat(res.data ?? [])
      } catch { /* ignore */ }
      try {
        const res = await api.getBrands()
        setBrands(res ?? [])
      } catch { /* ignore */ }
    })().finally(() => setLoadingSelectionData(false))
  }, [])

  // category options per marketplace (marketplace trees; storefront = universal categories)
  const catOptionsFor = useCallback((mp: string): { id: string; name: string }[] => {
    if (mp === 'storefront') {
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
  }, [marketplaceTrees, categoriesFlat])

  // brand options per marketplace
  const brandsFor = useCallback((mp: string): { id: string; name: string }[] => {
    return brands
      .filter((b) => {
        if (!b.isActive) return false
        if (mp === 'storefront') return !b.marketplace || b.marketplace === 'storefront'
        return b.marketplace === mp && !!b.marketplaceBrandId
      })
      .map((b) => ({ id: b.marketplaceBrandId!, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
  }, [brands])

  const marketplaceChannels = useMemo(() => selectedChannels.filter((c) => c !== 'storefront'), [selectedChannels])

  const loadPublishState = useCallback(async (draftId: number) => {
    try {
      const st = await api.getAiProductPublishState(draftId)
      setListings(st.listings || [])
      return st
    } catch {
      return null
    }
  }, [])

  // Fetch marketplace category attributes for AI product creation
  const fetchCategoryAttrs = useCallback(async (mp: string, catId: string | number | undefined) => {
    setLoadingCategoryAttrs(prev => ({ ...prev, [mp]: true }))
    try {
      if (catId !== undefined) {
        const res = await api.getMarketplaceCategoryAttributes(mp, catId)
        setCategoryAttrs(prev => ({ ...prev, [mp]: res.attributes ?? [] }))
      } else {
        setCategoryAttrs(prev => ({ ...prev, [mp]: [] }))
      }
    } catch {
      setCategoryAttrs(prev => ({ ...prev, [mp]: [] }))
    } finally {
      setLoadingCategoryAttrs(prev => ({ ...prev, [mp]: false }))
    }
  }, [])

  if (!user) return null

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setRawFile(f)
    setPreview(URL.createObjectURL(f))
    setDraft(null)
    setValidation([])
    setPublishResults([])
    setListings([])
    setError('')
    setSuccess('')
  }

function toggleChannel(c: string) {
    setSelectedChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
    setValidation([])
    setSelections(prev => {
      const next = { ...prev }
      delete next[c]
      return next
    })
    // Fetch category attributes when a marketplace is selected
    if (c !== 'storefront') {
      const catId = selections[c]?.categoryId
      if (catId != null) fetchCategoryAttrs(c, catId)
    }
  }

  function setChannelSelection(channel: string, patch: Partial<ChannelSelection>) {
    setSelections(prev => ({ ...prev, [channel]: { ...(prev[channel] || {}), ...patch } }))
    setValidation([])
  }

  function setFormFromDraft(d: any) {
    setForm({
      title: d.title || '',
      category: (d.categoryPath || []).join(' > '),
      short_description: d.shortDescription || '',
      description: d.description || '',
      keywords: (d.keywords || []).join(', '),
      tags: (d.tags || []).join(', '),
      attributes: attributesToText(d.attributes),
      price: d.suggestedPrice != null ? String(d.suggestedPrice) : '',
      stock: d.quantity != null ? String(d.quantity) : '10',
      sku: d.sku || '',
    })
    setDraftImages(d.images?.length ? d.images.filter(Boolean) : (d.imageUrls?.length ? d.imageUrls.filter(Boolean) : []))
  }

  async function openDraft(id: number) {
    setError('')
    setSuccess('')
    try {
      const d = await api.getAiProductDraft(id)
      setDraft(d)
      setFormFromDraft(d)
      setValidation([])
      setPublishResults([])
      setListings([])
      loadPublishState(id)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('aiDraftLoadFailed'))
    }
  }

  async function handleRun() {
    if (!rawFile) return
    setCreating(true)
    setError('')
    setSuccess('')
    try {
      const uploaded = await api.uploadImage(rawFile)
      const { session, draft: d } = await api.createAiProductSession({
        sourceImageUrl: uploaded.url,
        category: category !== 'diger' ? category : undefined,
        short_description: notes.short_description || undefined,
        keywords: notes.keywords ? notes.keywords.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        suggest_price: suggestPrice,
        target_marketplaces: targetMps,
      })

      let draftData = d
      if (!draftData) {
        for (let i = 0; i < 12; i++) {
          await new Promise(r => setTimeout(r, 2500))
          const st = await api.getAiProductSessionStatus(session.id)
          if (st.status === 'review' || st.status === 'approved' || st.status === 'completed') {
            const g = await api.getAiProductSession(session.id)
            draftData = g.draft
            break
          }
          if (st.status === 'failed') throw new Error(st.errorMessage || t('aiAnalysisFailed'))
        }
      }
      if (!draftData) throw new Error(t('aiDraftNotReady'))

      setDraft(draftData)
      setFormFromDraft(draftData)
      loadPublishState(draftData.id)
      loadDrafts()
      refreshMe()
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setError(err instanceof Error ? err.message : t('aiPrepareFailed'))
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveDraft() {
    if (!draft) return
    const price = form.price ? Number(form.price) : undefined
    const stock = form.stock ? Number(form.stock) : undefined
    if (!form.title.trim() || !form.description.trim()) { setError(t('aiTitleDescriptionRequired')); return }
    if (form.price && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) { setError(t('aiPriceInvalid')); return }
    if (form.stock && (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0)) { setError(t('aiStockInvalid')); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api.updateAiProductDraft(draft.id, {
        title: form.title,
        description: form.description,
        shortDescription: form.short_description,
        categoryPath: form.category.split(' > ').map(s => s.trim()).filter(Boolean),
        sku: form.sku,
        suggestedPrice: price,
        quantity: stock,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
        attributes: parseAttributes(form.attributes),
        images: draftImages,
      })
      setDraft(updated)
      setSuccess(t('aiDraftSaved'))
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('aiDraftSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleValidate() {
    if (!draft || selectedChannels.length === 0) return
    setValidating(true)
    setError('')
    try {
      const allowed = selectedChannels.filter((c) => c !== 'storefront')
      const cleanSelections: Record<string, ChannelSelection> = {}
      for (const c of allowed) {
        const s = selections[c] || {}
        if (s.categoryId != null || s.brandId || s.brand) cleanSelections[c] = s
      }
      const res = await api.validateAiProductChannels(draft.id, selectedChannels, cleanSelections)
      setValidation(res || [])
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('aiValidationFailed'))
    } finally {
      setValidating(false)
    }
  }

  async function handleApprove() {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.approveAiProductDraft(draft.id)
      setDraft(updated)
      setSuccess(t('aiDraftApproved'))
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('aiApprovalFailed'))
    } finally {
      setSaving(false)
    }
  }

  // AI image steps — every edit/generation bills credits (backend deducts on 202)
  async function handleEditImage(idx: number) {
    const url = draftImages[idx]?.trim()
    if (!url) { setAiImgMsg('Düzenlenecek görsel yok — önce görsel yükleyin veya üretin.'); return }
    const prompt = imgEditPrompt.trim()
    if (prompt.length < 3) { setAiImgMsg('Görsel düzenleme talimatı girin.'); return }
    setAiImgBusy('edit')
    setAiImgMsg('')
    try {
      const res = await api.imageEdit({
        imageUrl: url,
        prompt,
        category: draft?.categoryPath?.[0] ? String(draft.categoryPath[0]).toLowerCase() : undefined,
      })
      const files = await api.pollAiImageSession(res.sessionId)
      if (files.length === 0) throw new Error('Görsel düzenlenemedi')
      for (const file of files) {
        const up = await api.takeAiResultImage(res.sessionId, file)
        setDraftImages(prev => [...prev, up.url])
      }
      setAiImgMsg('Yeni görsel eklendi. İsterseniz eski görseli silerek sadece yenisini tutabilirsiniz.')
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setAiImgMsg(e?.message || 'Görsel düzenlenemedi')
    } finally {
      setAiImgBusy(null)
    }
  }

  async function handleGenerateImages() {
    const prompt = imgGenPrompt.trim()
    if (prompt.length < 3) { setAiImgMsg('Görsel talimatı girin (örn: ürünün beyaz arka planlı profesyonel çekimi).'); return }
    const count = Math.max(1, Math.min(4, imgGenCount || 1))
    setAiImgBusy('generate')
    setAiImgMsg('')
    try {
      const res = await api.imageGenerate({
        prompt,
        count,
        category: draft?.categoryPath?.[0] ? String(draft.categoryPath[0]).toLowerCase() : undefined,
        referenceImageUrl: draftImages.length > 0 ? draftImages[draftImages.length - 1] : undefined,
      })
      const files = await api.pollAiImageSession(res.sessionId)
      if (files.length === 0) throw new Error('Görsel üretilemedi')
      const urls: string[] = []
      for (const file of files) {
        const up = await api.takeAiResultImage(res.sessionId, file)
        if (up.url) urls.push(up.url)
      }
      setDraftImages(prev => [...prev, ...urls])
      setAiImgMsg(`${urls.length} görsel üretildi — mevcut ürün görseli referans alındı (${count * 3} kredi düşüldü).`)
      refreshMe()
    } catch (e: any) {
      if (e?.code === 'INSUFFICIENT_CREDITS') { setGate('credits'); refreshMe() }
      else setAiImgMsg(e?.message || 'Görsel üretilemedi')
    } finally {
      setAiImgBusy(null)
    }
  }

  async function handlePublish() {
    if (!draft || selectedChannels.length === 0) return
    setPublishing(true)
    setError('')
    setSuccess('')
    try {
      const price = form.price ? Number(form.price) : undefined
      const stock = form.stock ? Number(form.stock) : undefined
      if (!form.title.trim() || !form.description.trim()) { setError(t('aiTitleDescriptionRequired')); setPublishing(false); return }
      if (form.price && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) { setError(t('aiPriceInvalid')); setPublishing(false); return }
      if (form.stock && (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0)) { setError(t('aiStockInvalid')); setPublishing(false); return }
      const saved = await api.updateAiProductDraft(draft.id, {
        title: form.title,
        description: form.description,
        shortDescription: form.short_description,
        categoryPath: form.category.split(' > ').map(s => s.trim()).filter(Boolean),
        sku: form.sku,
        suggestedPrice: price,
        quantity: stock,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
        attributes: parseAttributes(form.attributes),
        images: draftImages,
      })
      setDraft(saved)
      const allowed = selectedChannels.filter((c) => c !== 'storefront')
      const cleanSelections: Record<string, ChannelSelection> = {}
      for (const c of allowed) {
        const s = selections[c] || {}
        if (s.categoryId != null || s.brandId || s.brand) cleanSelections[c] = s
      }
      const res = await api.publishAiProductDraft(saved.id || draft.id, selectedChannels, cleanSelections)
      setPublishResults(res.results || [])
      loadPublishState(saved.id || draft.id)
      loadDrafts()
      refreshMe()
      setSuccess(t('aiPublishQueuedMessage'))
    } catch (err: any) {
      if (err?.code === 'PLAN_PRODUCT_LIMIT') setGate('product')
      else if (err?.code === 'DRAFT_CHANNEL_VALIDATION_FAILED') {
        setValidation(err?.data?.results || [])
        setError(t('aiPublishBlocked'))
      }
      else setError(err instanceof Error ? err.message : t('aiPublishFailedMessage'))
    } finally {
      setPublishing(false)
    }
  }

  async function handleRetry() {
    if (!draft) return
    const failed = listings.filter(l => l.status === 'failed').map(l => l.channel || l.platform)
    if (failed.length === 0) return
    setRetrying(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.retryAiProductPublish(draft.id, failed)
      setPublishResults(res.results || [])
      loadPublishState(draft.id)
      setSuccess(`${t('aiRetrying')} (${res.retried})`)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('aiRetryFailed'))
    } finally {
      setRetrying(false)
    }
  }

  const failedCount = listings.filter(l => l.status === 'failed').length

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('aiStudio')}</h1>
          <p className="mt-1 text-sm text-zinc-400">{t('aiStudioSubtitle')}</p>
        </div>
        {user.ai_credits != null && <p className="text-xs text-zinc-500">{t('aiRemainingCredits')} {user.ai_credits}</p>}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}
      {success && <div className="mt-4 rounded-lg bg-green-900/50 p-3 text-sm text-green-400">{success}</div>}

      {!can('ai_product_create') ? (
        <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
          <p className="text-sm text-zinc-400">{t('aiModuleDisabled')}</p>
          <button onClick={() => router.push('/billing')} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-zinc-700 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-600">
            {t('aiUpgradePlan')} <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Saved drafts */}
          {drafts.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-zinc-400">{t('aiDrafts')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {drafts.map(d => (
                  <button key={d.id} onClick={() => openDraft(d.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${draft?.id === d.id ? 'border-violet-500 bg-violet-600 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}>
                    #{d.id} — {d.title?.slice(0, 40) || t('aiDraft')}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Upload + options */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
              <div className="flex items-center gap-3">
                <Wand2 className="h-5 w-5 text-violet-400" />
                <h2 className="text-lg font-semibold text-white">{t('aiStep1')}</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{t('aiStep1Desc')}</p>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-400">{t('aiCategory')}</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                  <option value="giyim">Giyim</option>
                  <option value="taki">Takı</option>
                  <option value="kozmetik">Kozmetik</option>
                  <option value="ayakkabi">Ayakkabı</option>
                  <option value="canta">Çanta</option>
                  <option value="elektronik">Elektronik</option>
                  <option value="ev_dekorasyon">Ev Dekorasyon</option>
                  <option value="spor">Spor</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>

              <div className="mt-4">
                <input type="file" accept="image/*" onChange={handleFile}
                  className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-violet-500" />
              </div>
              {preview && <img src={preview} alt="Preview" className="mt-4 max-h-48 rounded-lg border border-zinc-700 object-cover" />}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-400">{t('aiOptionalShort')}</label>
                  <input value={notes.short_description} onChange={e => setNotes({ ...notes, short_description: e.target.value })}
                    placeholder="Satıcı notu / kısa bilgi"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400">Anahtar Kelimeler (opsiyonel)</label>
                  <input value={notes.keywords} onChange={e => setNotes({ ...notes, keywords: e.target.value })}
                    placeholder="virgülle ayır"
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-zinc-400">{t('aiTargetChannels')}</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ALL_CHANNELS.map(o => (
                    <button key={o.key} type="button" onClick={() => setTargetMps(prev => prev.includes(o.key) ? prev.filter(x => x !== o.key) : [...prev, o.key])}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border ${targetMps.includes(o.key) ? 'bg-violet-600 border-violet-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                      {o.n}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={suggestPrice} onChange={e => setSuggestPrice(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-800" />
                {t('aiSuggestPrice')}
              </label>

              <button onClick={handleRun} disabled={!rawFile || creating}
                className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {creating ? t('aiPreparing') : t('aiPrepare')}
              </button>
            </div>

            {/* 2. Draft + Publish */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white">{t('aiStep2')}</h2>
              <p className="mt-1 text-sm text-zinc-400">{t('aiStep2Desc')}</p>

              {!draft && !creating && (
                <div className="mt-8 flex flex-col items-center gap-2 text-zinc-500">
                  <ImageUp className="h-10 w-10" />
                  <p className="text-sm">{t('aiUploadHint')}</p>
                </div>
              )}
              {creating && (
                <div className="mt-8 flex flex-col items-center gap-2 text-zinc-400">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  <p className="text-sm">{t('aiAnalyzing')}</p>
                </div>
              )}

              {draft && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('title')}</label>
                    <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-400">{t('aiCategoryPath')}</label>
                      <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                        placeholder="Kategori > Alt Kategori"
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-400">{t('aiSku')}</label>
                      <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-zinc-400">{t('aiPrice')} (₺)</label>
                      <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-400">{t('aiStock')}</label>
                      <input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('aiShortDescription')}</label>
                    <textarea value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} rows={2}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('aiDescription')}</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('aiKeywords')}</label>
                    <input value={form.keywords} onChange={e => setForm({ ...form, keywords: e.target.value })}
                      placeholder="virgülle ayır"
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('aiTags')}</label>
                    <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                      placeholder="virgülle ayır"
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">{t('aiAttributes')}</label>
                    <textarea value={form.attributes} onChange={e => setForm({ ...form, attributes: e.target.value })} rows={4}
                      placeholder={'renk: Siyah\nmalzeme: Deri\nmarka: Marka adı'}
                      className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" />
                    <p className="mt-1 text-[11px] text-zinc-500">{t('aiAttributesHint')}</p>
                  </div>

                  {/* Marketplace category attributes */}
                  <div className="mt-3 border-t border-zinc-700 pt-3">
                    <p className="text-xs font-medium text-zinc-400">Pazaryerinde kategori öznitelikleri</p>
                    {selectedChannels.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {selectedChannels.map((c) => {
                          const attrs = categoryAttrs[c] ?? []
                          if (attrs.length === 0) return null
                          return (
                            <div key={c} className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
                              <p className="mb-2 text-xs font-semibold text-zinc-300">{c}</p>
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                                {attrs.map((attr, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span>{attr}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {selectedChannels.length === 0 && (
                      <p className="mt-2 text-[11px] text-zinc-500">Pazaryeri seçince öznitelikler görünür</p>
                    )}
                  </div>

                  {/* Images: AI edit + generate new (per-image credit) */}
                  <div className="border-t border-zinc-700 pt-3">
                    <p className="text-xs font-medium text-zinc-400">Görseller ({draftImages.length}) <span className="text-zinc-500">— her AI işlemi {t('aiImageCreditNote')}</span></p>
                    {draftImages.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {draftImages.map((img, idx) => (
                          <div key={idx} className="group relative">
                            <img src={img} alt={`Görsel ${idx + 1}`} className="h-20 w-full rounded-lg border border-zinc-700 object-cover" />
                            <button type="button" onClick={() => setDraftImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white group-hover:flex"
                              title="Sil">✕</button>
                            <button type="button"
                              onClick={() => handleEditImage(idx)}
                              disabled={aiImgBusy !== null}
                              className="mt-1 w-full rounded border border-violet-500 bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-500 disabled:opacity-40">
                              {aiImgBusy === 'edit' ? 'İşleniyor...' : 'AI Düzenle'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {draftImages.length === 0 && (
                      <p className="mt-2 text-[11px] text-zinc-500">Henüz görsel yok — aşağıdan yeni görsel üretebilirsiniz.</p>
                    )}
                    <div className="mt-3 space-y-2">
                      <label className="text-[11px] text-zinc-500">AI Görsel Talimatı</label>
                      <input value={imgEditPrompt} onChange={e => setImgEditPrompt(e.target.value)}
                        placeholder="örn: beyaz arka plan, profesyonel ürün çekimi, daha parlak"
                        className="block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => draftImages.length > 0 ? handleEditImage(draftImages.length - 1) : (setAiImgMsg('Önce görsel üretin veya kaydedilmiş taslağı açın.'))}
                          disabled={aiImgBusy !== null || draftImages.length === 0}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40">
                          {aiImgBusy === 'edit' ? 'Düzenleniyor...' : 'Son Görseli Düzenle'}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500">adet</span>
                          <input type="number" min={1} max={4} value={imgGenCount}
                            onChange={e => setImgGenCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
                            className="w-14 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
                      <p className="text-[11px] font-medium text-zinc-400">Yeni Görsel(ler) Üret (sıfırdan)</p>
                      {draftImages.length > 0 && (
                        <p className="mt-1 text-[10px] text-zinc-500">Zaten görsel var — mevcut görseli düzenlemek için "Son Görseli Düzenle" butonunu kullanın.</p>
                      )}
                      <input value={imgGenPrompt} onChange={e => setImgGenPrompt(e.target.value)}
                        disabled={draftImages.length > 0}
                        placeholder="örn: ürünün mavi kadife kutu içinde çekimi, beyaz arka plan"
                        className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed" />
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button"
                          onClick={handleGenerateImages}
                          disabled={aiImgBusy !== null || draftImages.length > 0}
                          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed">
                          {aiImgBusy === 'generate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
                          {aiImgBusy === 'generate' ? 'Üretiliyor...' : `${imgGenCount} Görsel Üret (${imgGenCount * 3} kredi)`}
                        </button>
                      </div>
                    </div>
                    {aiImgMsg && <p className="mt-2 text-[11px] text-zinc-400">{aiImgMsg}</p>}
                  </div>

                  {draft.confidence && Object.keys(draft.confidence).length > 0 && (
                    <details className="rounded-lg border border-zinc-700 bg-zinc-800">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">{t('aiConfidence')}</summary>
                      <div className="border-t border-zinc-700 px-3 py-2 text-xs text-zinc-500">
                        {Object.entries(draft.confidence).map(([k, v]) => <p key={k}>{k}: {Math.round((v as number) * 100)}%</p>)}
                      </div>
                    </details>
                  )}

                  <button onClick={handleSaveDraft} disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t('aiSaveDraft')}
                  </button>

                  {/* Channels */}
                  <div className="mt-2 border-t border-zinc-700 pt-4">
                    <p className="text-xs font-medium text-zinc-400">{t('aiPublishChannels')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ALL_CHANNELS.map(o => (
                        <button key={o.key} type="button" onClick={() => toggleChannel(o.key)}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border ${selectedChannels.includes(o.key) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                          {o.n}
                        </button>
                      ))}
                    </div>

                    {/* Per-channel marketplace category + brand selectors */}
                    {marketplaceChannels.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {loadingSelectionData && <p className="text-[11px] text-zinc-500">Kategori/marka listesi yükleniyor...</p>}
                        {marketplaceChannels.map((c) => {
                          const catOpts = catOptionsFor(c)
                          const brOpts = brandsFor(c)
                          const sel = selections[c] || {}
                          return (
                            <div key={c} className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
                              <p className="mb-2 text-xs font-semibold text-zinc-300">{c}</p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div>
                                  <label className="text-[11px] text-zinc-500">{t('aiCategoryPath')}</label>
                                  <select
                                    value={sel.categoryId != null ? String(sel.categoryId) : ''}
                                    onChange={(e) => {
                                      const opt = catOpts.find((o) => o.id === e.target.value)
                                      if (opt) setChannelSelection(c, { categoryId: opt.id })
                                    }}
                                    disabled={catOpts.length === 0}
                                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                                    <option value="">{catOpts.length === 0 ? t('aiNoCategories') : '— Kategori seç —'}</option>
                                    {catOpts.map((o) => (
                                      <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[11px] text-zinc-500">{t('aiBrand')}</label>
                                  <select
                                    value={sel.brandId ? String(sel.brandId) : ''}
                                    onChange={(e) => {
                                      const opt = brOpts.find((o) => o.id === e.target.value)
                                      setChannelSelection(c, { brandId: opt ? opt.id : null, brand: opt ? opt.name : null })
                                    }}
                                    disabled={brOpts.length === 0}
                                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
                                    <option value="">{brOpts.length === 0 ? '— Marka yok —' : '— Marka seç —'}</option>
                                    {brOpts.map((o) => (
                                      <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <button onClick={handleValidate} disabled={validating || selectedChannels.length === 0}
                      className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                      {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {t('aiValidateChannels')}
                    </button>
                  </div>

                  {validation.length > 0 && (
                    <div className="space-y-1.5">
                      {validation.map(v => {
                        const s = CHANNEL_STATUS[v.status] || CHANNEL_STATUS['missing-fields']
                        return (
                          <div key={v.channel} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                            <div>
                              <span className="text-xs text-zinc-300">{v.channel}</span>
                              {v.suggestion && <p className="mt-1 max-w-md text-[11px] text-zinc-500">{v.suggestion}</p>}
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                              {t(s.text)}{v.status === 'missing-fields' && v.missingFields?.length ? ` (${v.missingFields.join(', ')})` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Publish + approve */}
                  <div className="mt-2 flex gap-2">
                    <button onClick={handleApprove} disabled={saving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                      <Check className="h-4 w-4" /> {t('aiApprove')}
                    </button>
                    <button onClick={handlePublish} disabled={publishing || selectedChannels.length === 0}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
                      {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {publishing ? t('aiPublishing') : t('aiPublish')}
                    </button>
                  </div>

                  {publishResults.length > 0 && (
                    <div className="space-y-1.5">
                      {publishResults.map(r => {
                        const s = STATUS_LABEL[r.status] || STATUS_LABEL['failed']
                        return (
                          <div key={r.channel} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                            <span className="text-xs text-zinc-300">{r.channel}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
                              {t(s.text)}{r.error ? ` — ${r.error}` : r.externalId ? ` (${r.externalId})` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Listing state */}
                  {listings.length > 0 && (
                    <div className="mt-2 border-t border-zinc-700 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-zinc-400">{t('aiPublishStatus')}</p>
                        {failedCount > 0 && (
                          <button onClick={handleRetry} disabled={retrying}
                            className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-500 disabled:opacity-50">
                            {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            {t('aiRetry')} ({failedCount})
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {listings.map(l => {
                          const s = LISTING_STATUS[l.status] || LISTING_STATUS['pending']
                          return (
                            <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                              <span className="text-xs text-zinc-300">{l.channel || l.platform}{l.externalId ? ` · ${l.externalId}` : ''}</span>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>{t(s.text)}</span>
                                {l.retryCount > 0 && <span className="text-[10px] text-zinc-500">×{l.retryCount}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {listings.some(l => l.lastError) && (
                        <details className="mt-2 rounded-lg border border-zinc-700 bg-zinc-800">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">{t('aiFailed')}</summary>
                          <div className="border-t border-zinc-700 px-3 py-2 text-xs text-red-400">
                            {listings.filter(l => l.lastError).map(l => (
                              <p key={l.id} className="mt-1">{l.channel || l.platform}: {l.lastError}</p>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-[420px] max-w-full rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <div className="mb-2 flex items-center gap-3">
              {gate === 'credits' ? <Coins className="h-6 w-6 text-indigo-400" /> : <Wand2 className="h-6 w-6 text-indigo-400" />}
              <h3 className="text-lg font-semibold text-white">{gate === 'credits' ? t('aiCreditsInsufficient') : t('aiProductLimitReached')}</h3>
            </div>
            <p className="mb-4 text-sm text-zinc-400">
              {gate === 'credits'
                ? t('aiCreditsMessage')
                : t('aiProductLimitMessage')}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGate(null)} className="rounded border border-zinc-600 px-4 py-1.5 text-sm text-zinc-300">{t('cancel')}</button>
              {gate === 'credits' && (
                <button onClick={() => router.push('/credits')} className="flex items-center gap-1 rounded bg-indigo-600 px-4 py-1.5 text-sm text-white">
                  {t('aiBuyCredits')} <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => router.push('/billing')} className="flex items-center gap-1 rounded bg-white px-4 py-1.5 text-sm text-black">
                {t('aiUpgradePlan')} <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
