'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Megaphone, Share2, Camera, Check, ExternalLink, Sparkles, ShoppingBag } from 'lucide-react'

type ProductLite = { id: number; title: string; sku: string; images: string[]; priceTRY: number }

const CHANNELS = [
  { key: 'facebook_post', label: 'Facebook Gönderi', icon: <Share2 className="h-4 w-4" />, desc: 'Sayfanda görsel + link paylaşılır, sitede satışa yönlendirir' },
  { key: 'facebook_story', label: 'Facebook Story', icon: <Share2 className="h-4 w-4" />, desc: 'Hikaye olarak yayınlanır' },
  { key: 'instagram_post', label: 'Instagram Gönderi', icon: <Camera className="h-4 w-4" />, desc: 'Feed gönderisi, tracking link bio/caption içinde' },
  { key: 'instagram_story', label: 'Instagram Story', icon: <Camera className="h-4 w-4" />, desc: 'Hikaye (24s) — link sticker ile siteye' },
]

export default function MarketingPage() {
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; pages: any[]; catalogs: any[]; selected: any; pixels: any[]; domain: any; loading: boolean }>({ connected: false, pages: [], catalogs: [], selected: null, pixels: [], domain: null, loading: true })
  const [assets, setAssets] = useState<any>({ pages: [], catalogs: [], selected: {} })
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [selectedPage, setSelectedPage] = useState('')
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [selectedIg, setSelectedIg] = useState('')
  const [connecting, setConnecting] = useState(false)

  const [products, setProducts] = useState<ProductLite[]>([])
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [caption, setCaption] = useState('')
  const [channels, setChannels] = useState<string[]>(['facebook_post'])
  const [publishing, setPublishing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Handle meta=select redirect after OAuth
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('meta') === 'select') {
      setShowAssetPicker(true)
    }
  }, [])

  const [igShop, setIgShop] = useState<any>(null)

  const refreshMeta = async () => {
    setMetaStatus(s => ({ ...s, loading: true }))
    try {
      const [assetsRes, domainRes, igRes] = await Promise.allSettled([
        api.getMetaAssets(),
        api.getMetaDomain().catch(() => ({ domain: '', verificationToken: null, businessId: null } as any)),
        api.getInstagramShoppingStatus().catch(() => null as any),
      ])
      if (assetsRes.status === 'fulfilled') {
        const a: any = assetsRes.value
        setAssets(a)
        setIgShop(igRes.status === 'fulfilled' ? igRes.value : null)
        setMetaStatus({
          connected: true,
          pages: a.pages || [],
          catalogs: a.catalogs || [],
          selected: a.selected,
          pixels: [],
          domain: domainRes.status === 'fulfilled' ? (domainRes.value as any) : null,
          loading: false,
        })
        // try pixels
        api.getMetaPixels().then(r => setMetaStatus(s => ({ ...s, pixels: r.pixels }))).catch(() => {})
      } else {
        setMetaStatus({ connected: false, pages: [], catalogs: [], selected: null, pixels: [], domain: null, loading: false })
      }
    } catch {
      setMetaStatus({ connected: false, pages: [], catalogs: [], selected: null, pixels: [], domain: null, loading: false })
    }
  }

  useEffect(() => { refreshMeta() }, [])

  useEffect(() => {
    if (assets.selected?.pageId) setSelectedPage(assets.selected.pageId)
    if (assets.selected?.catalogId) setSelectedCatalog(assets.selected.catalogId)
    if (assets.selected?.igUserId) setSelectedIg(assets.selected.igUserId)
  }, [assets])

  const loadProducts = async (q = search) => {
    setLoadingProducts(true)
    try {
      const r: any = await api.getProducts({ search: q || undefined, limit: 24 } as any)
      const list = r.data || r.products || []
      setProducts(list.map((p: any) => ({ id: Number(p.id), title: p.title || p.label, sku: p.sku || p.code, images: p.images || [], priceTRY: p.priceTRY ?? p.price ?? 0 })))
    } catch {} finally { setLoadingProducts(false) }
  }
  useEffect(() => { loadProducts('') }, [])

  const handleConnect = async () => {
    setConnecting(true); setError('')
    try {
      const { url } = await api.getMetaConnectUrl()
      if (!url) throw new Error('Bağlantı URL’si alınamadı')
      window.location.href = url
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Bağlantı başlatılamadı'
      const detail = e?.data?.message || ''
      // Backend 400: Meta App ID/Secret tanımlı değil → yönlendir
      if (String(msg).includes('Meta App') || String(detail).includes('Meta App')) {
        setError('Meta uygulaması henüz yapılandırılmadı. Super Admin → Meta Ayarları’ndan App ID ve App Secret girmen gerekiyor. (developers.facebook.com → Uygulama → Ayarlar → Temel) — Alternatif: .env’de META_APP_ID / META_APP_SECRET')
      } else if (String(msg).includes('PLAN_MARKETPLACE_LIMIT') || e?.status === 403) {
        setError('Pazaryeri limitin dolu veya marketplace modülü kapalı. Planını kontrol et.')
      } else {
        setError(`${msg}${detail ? ` — ${detail}` : ''}`)
      }
      setConnecting(false)
    }
  }

  const handleFbeAuto = async () => {
    setError('')
    try {
      const res = await api.fbeCallback({})
      setResult(res)
      await refreshMeta()
      setShowAssetPicker(false)
    } catch (e: any) { setError(e.message) }
  }

  const handleSelectAssets = async () => {
    setError('')
    try {
      await api.selectMetaAssets({ pageId: selectedPage, catalogId: selectedCatalog, igUserId: selectedIg || null })
      await handleFbeAuto()
    } catch (e: any) { setError(e.message) }
  }

  const handlePublish = async () => {
    if (selectedIds.length === 0) { setError('En az 1 ürün seçin'); return }
    if (channels.length === 0) { setError('En az 1 kanal seçin'); return }
    setPublishing(true); setError(''); setResult(null)
    try {
      const res = await api.metaPublish({ productIds: selectedIds, channels, caption: caption || undefined })
      setResult(res)
    } catch (e: any) { setError(e.message || 'Paylaşım başarısız') } finally { setPublishing(false) }
  }

  const toggleId = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleCh = (k: string) => setChannels(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  if (metaStatus.loading) return <div className="mt-8"><CardSkeleton count={3} /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><Megaphone className="h-6 w-6 text-indigo-600" /> Marketing — Meta</h1>
          <p className="mt-1 text-sm text-zinc-600">Ürünlerini Facebook ve Instagram’da post / story olarak paylaş, tüm trafik <span className="font-medium text-zinc-900">senin sitede</span> satışa dönüşsün. Sipariş kaynağı otomatik etiketlenir (UTM + piksel).</p>
        </div>
      </div>

      {/* Connection card — TechProvider auto */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${metaStatus.connected && assets.selected?.catalogId ? 'bg-green-100 text-green-600' : 'bg-zinc-100 text-zinc-500'}`}>
              {metaStatus.connected && assets.selected?.catalogId ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{metaStatus.connected ? (assets.selected?.catalogId ? 'Meta bağlı — otomatik' : 'Meta bağlı — kurulum gerekiyor') : 'Meta bağlı değil'}</p>
              <p className="text-xs text-zinc-500">
                {metaStatus.connected
                  ? `Sayfa: ${assets.selected?.pageId || '-'} · Katalog: ${assets.selected?.catalogId || '-'} · IG: ${assets.selected?.igUserId || '-'}`
                  : 'Tek tıkla Facebook Sayfası, ürün kataloğu ve piksel/domain doğrulaması otomatik kurulur'}
              </p>
              {metaStatus.domain?.verificationToken && <p className="text-xs text-green-600 mt-0.5">Domain doğrulaması aktif ✓ — piksel otomatik enjekte ediliyor</p>}
              {igShop && igShop.connected && igShop.eligible === true && <p className="text-xs text-green-600 mt-0.5">Instagram Shop uygun ✓ — @{igShop.igUsername} ürün etiketlemeye açık</p>}
              {igShop && igShop.connected && igShop.eligible === false && <p className="text-xs text-amber-600 mt-0.5">Instagram Shop henüz onaylı değil — Commerce Manager’dan katalogu Instagram’a bağlayın ({igShop.raw?.shopping_review_status || 'pending'})</p>}
              {igShop && !igShop.connected && <p className="text-xs text-amber-600 mt-0.5">Instagram işletme hesabı bağlı değil — Facebook Sayfa → Ayarlar → Instagram’dan bağlayın</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {!metaStatus.connected ? (
              <button onClick={handleConnect} disabled={connecting} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {connecting ? 'Yönlendiriliyor...' : 'Meta’yı Otomatik Bağla (v26.0)'}
              </button>
            ) : (
              <>
                <button onClick={handleFbeAuto} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Otomatik Kur (katalog+piksel+domain)</button>
                <button onClick={() => setShowAssetPicker(v => !v)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Varlıkları Seç</button>
              </>
            )}
          </div>
        </div>

        {showAssetPicker && metaStatus.connected && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Facebook Sayfası</label>
              <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
                <option value="">Seçin</option>
                {assets.pages.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Katalog</label>
              <select value={selectedCatalog} onChange={e => setSelectedCatalog(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
                <option value="">{assets.catalogs.length === 0 ? 'Otomatik oluşturulacak' : 'Seçin'}</option>
                {assets.catalogs.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.product_count ?? 0})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Instagram</label>
              <select value={selectedIg} onChange={e => setSelectedIg(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
                <option value="">Yok</option>
                {assets.pages.filter((p: any) => p.igUserId).map((p: any) => <option key={p.igUserId} value={p.igUserId}>{p.name} — {p.igUserId}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button onClick={handleSelectAssets} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Kaydet & Otomatik Kur</button>
            </div>
          </div>
        )}
        {metaStatus.connected && !assets.selected?.catalogId && (
          <p className="mt-3 text-xs text-amber-600">Katalog seçilmedi — post/story yine çalışır, ama ürünlerin Mağaza kataloğuna düşmesi için katalogu seçip “Otomatik Kur” deyin. Katalog URL’leri tracking ile siteye gider.</p>
        )}
      </div>

      {/* Marketing composer */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product selector */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Ürün Seç (çoklu)</h3>
          <div className="mt-3 flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProducts()} placeholder="Ürün ara (ad, SKU)" className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <button onClick={() => loadProducts()} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">Ara</button>
          </div>
          {selectedIds.length > 0 && <p className="mt-2 text-xs text-zinc-600">{selectedIds.length} ürün seçildi · Paylaşınca her ürün için seçili kanallarda ayrı post oluşturulur, link tracking ile sitenize gider</p>}
          <div className="mt-4 grid gap-2 max-h-[420px] overflow-auto pr-1">
            {loadingProducts && <CardSkeleton count={3} />}
            {!loadingProducts && products.map(p => (
              <label key={p.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedIds.includes(p.id) ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:bg-zinc-50'}`}>
                <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleId(p.id)} className="h-4 w-4 rounded border-zinc-300 text-indigo-600" />
                {p.images[0] ? <img src={p.images[0]} alt={p.title} className="h-12 w-12 rounded object-cover border" /> : <div className="h-12 w-12 rounded bg-zinc-100" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.title}</p>
                  <p className="text-xs text-zinc-500">{p.sku} · {Number(p.priceTRY).toLocaleString('tr-TR')} ₺</p>
                </div>
              </label>
            ))}
            {!loadingProducts && products.length === 0 && <p className="text-sm text-zinc-500 py-8 text-center">Ürün bulunamadı. Katalogdaki ürünlerinizi mağazanıza ekleyin.</p>}
          </div>
        </div>

        {/* Channels + caption */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-900">Kanallar</h3>
          <div className="space-y-2">
            {CHANNELS.map(ch => (
              <label key={ch.key} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${channels.includes(ch.key) ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200'}`}>
                <input type="checkbox" checked={channels.includes(ch.key)} onChange={() => toggleCh(ch.key)} className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 flex items-center gap-1.5">{ch.icon} {ch.label}</p>
                  <p className="text-xs text-zinc-500">{ch.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Açıklama (caption) — boş bırakırsan “Başlık + tracking link” otomatik eklenir</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={4} placeholder="Örn: Yeni sezon ürünü stokta! Detaylar için tıkla 👇" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-zinc-500">Her post’un sonuna ürün sayfanın <span className="font-mono">?utm_source=facebook&utm_medium=social&rh_src=...</span> tracking linki eklenir — sipariş kaynağı admin panelde görünür.</p>
          </div>
          <button onClick={handlePublish} disabled={publishing || selectedIds.length === 0} className="w-full rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2">
            <Megaphone className="h-4 w-4" /> {publishing ? 'Paylaşılıyor...' : `Paylaş (${selectedIds.length} ürün × ${channels.length} kanal)`}
          </button>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
          {result && (
            <div className="rounded-lg bg-green-50 p-3 text-sm">
              <p className="font-medium text-green-800">{result.results ? `${result.results.filter((r:any)=>r.ok).length}/${result.results.length} başarılı` : 'Bitti'}</p>
              {result.results?.map((r:any, i:number) => (
                <p key={i} className={`text-xs ${r.ok ? 'text-green-700' : 'text-red-600'}`}>{r.ok ? '✓' : '✗'} {r.channel} — ürün {r.productId} {r.id ? `→ ${r.id}` : ''} {r.error ? `— ${r.error}` : ''}</p>
              ))}
            </div>
          )}
          <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Nasıl izlenir?</p>
            <p className="mt-1">Siparişler → sipariş detayında <span className="font-mono">attribution</span> alanında <span className="font-medium">utm_source / rh_src</span> görünür. Ayrıca Facebook Piksel sayfada otomatik tetiklenir. İlk kurulumdan sonra tüm yeni ürünler tracking’li link ile paylaşılmaya hazırdır.</p>
            <a href="/pixels" className="inline-flex items-center gap-1 mt-2 text-indigo-600 hover:text-indigo-700">Piksel ayarları <ExternalLink className="h-3 w-3" /></a>
          </div>
        </div>
      </div>
    </div>
  )
}
