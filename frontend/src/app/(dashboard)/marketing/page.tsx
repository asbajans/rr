'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { useAuth } from '@/lib/auth'
import { CardSkeleton } from '@/components/ui/skeleton'
import { Megaphone, Share2, Camera, Check, ExternalLink, Sparkles, ShoppingBag, MessageCircle, Mail, TrendingUp, Users, BarChart3, MessageSquare, Trash2, Reply } from 'lucide-react'
import { FlaskConical } from 'lucide-react'

type ProductLite = { id: number; title: string; sku: string; images: string[]; priceTRY: number }

const CHANNELS = [
  { key: 'facebook_post', label: 'Facebook Gönderi', icon: <Share2 className="h-4 w-4" />, desc: 'Sayfanda görsel + link paylaşılır, sitede satışa yönlendirir' },
  { key: 'facebook_story', label: 'Facebook Story', icon: <Share2 className="h-4 w-4" />, desc: 'Hikaye olarak yayınlanır' },
  { key: 'instagram_post', label: 'Instagram Gönderi', icon: <Camera className="h-4 w-4" />, desc: 'Feed gönderisi, tracking link bio/caption içinde' },
  { key: 'instagram_story', label: 'Instagram Story', icon: <Camera className="h-4 w-4" />, desc: 'Hikaye (24s) — link sticker ile siteye' },
]

export default function MarketingPage() {
  const { user } = useAuth()
  const isSuperAdmin = (user as any)?.role === 'superadmin' || (user as any)?.is_admin === true
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

  // New permission-based sections
  const [igComments, setIgComments] = useState<any[]>([])
  const [igConversations, setIgConversations] = useState<any[]>([])
  const [ads, setAds] = useState<any[]>([])
  const [adInsights, setAdInsights] = useState<any>(null)
  const [pageInsights, setPageInsights] = useState<any>(null)
  const [igAccount, setIgAccount] = useState<any>(null)
  const [activeSection, setActiveSection] = useState<string>('publish') // publish | comments | messages | ads | insights | test

  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [convMessages, setConvMessages] = useState<any[]>([])
  const [sendingMsg, setSendingMsg] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  // Handle meta=select / meta=error redirect after OAuth — supports popup flow (window.open)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const meta = sp.get('meta')
      const isPopup = window.opener != null && !window.opener.closed
      if (meta === 'select') {
        setShowAssetPicker(true)
        refreshMeta()
        if (isPopup) {
          try { window.opener.postMessage({ type: 'meta_connected' }, window.location.origin) } catch {}
          // give user a moment to see success, then close popup
          setTimeout(() => { try { window.close() } catch {} }, 1500)
        }
      }
      if (meta === 'error') {
        setError(decodeURIComponent(sp.get('message') || 'Meta bağlantısı başarısız. Geçersiz yetkiler veya whitelist hatası — Meta Ayarları’ndaki yönlendirme URI’yi kontrol et.'))
        if (isPopup) {
          try { window.opener.postMessage({ type: 'meta_error', message: sp.get('message') }, window.location.origin) } catch {}
          setTimeout(() => { try { window.close() } catch {} }, 3000)
        }
      }
      // Listen for popup success when this window is the opener
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return
        if (e.data?.type === 'meta_connected') { refreshMeta(); setShowAssetPicker(true) }
        if (e.data?.type === 'meta_error') setError(decodeURIComponent(e.data.message || 'Meta bağlantısı başarısız.'))
      }
      window.addEventListener('message', onMsg)
      return () => window.removeEventListener('message', onMsg)
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
        api.getMetaPixels().then(r => setMetaStatus(s => ({ ...s, pixels: r.pixels }))).catch(() => {})
      } else {
        setMetaStatus({ connected: false, pages: [], catalogs: [], selected: null, pixels: [], domain: null, loading: false })
      }
    } catch {
      setMetaStatus({ connected: false, pages: [], catalogs: [], selected: null, pixels: [], domain: null, loading: false })
    }
  }

  const refreshExtras = async () => {
    try {
      const igC = await api.getMetaIgComments().catch(() => ({ comments: [] }))
      setIgComments(igC.comments || [])
    } catch {}
    try {
      const convs = await api.getMetaIgMessages().catch(() => ({ conversations: [] }))
      setIgConversations(convs.conversations || [])
    } catch {}
    try {
      const a = await api.getMetaAds().catch(() => ({ ads: [] }))
      setAds(a.ads || [])
    } catch {}
    try {
      const pi = await api.getMetaPageInsights().catch(() => ({ insights: null, posts: [] }))
      setPageInsights(pi.insights)
    } catch {}
    try {
      const acc = await api.getMetaIgAccount().catch(() => ({ account: null, accounts: [] }))
      setIgAccount(acc.account)
    } catch {}
  }

  useEffect(() => { refreshMeta() }, [])
  useEffect(() => {
    // superadmin değilse test sekmesine düşerse publish'e at
    if (!isSuperAdmin && activeSection === 'test') setActiveSection('publish')
    if (activeSection !== 'publish') refreshExtras()
  }, [activeSection, refreshKey, isSuperAdmin])

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

  const [oauthRedirectUri, setOauthRedirectUri] = useState<string>('')
  useEffect(() => { api.getMetaOAuthConfig().then(r => setOauthRedirectUri(r.redirectUri)).catch(() => {}) }, [])
  const handleConnect = async (mode: 'minimal' | 'full' = 'minimal') => {
    setConnecting(true); setError('')
    try {
      const { url } = await api.getMetaConnectUrl(mode)
      if (!url) throw new Error('Bağlantı URL’si alınamadı')
      const popup = window.open(url, '_blank', 'width=600,height=700')
      // popup blocked fallback: same-window redirect
      if (!popup) window.location.href = url
      // reset button after popup opened
      setTimeout(() => setConnecting(false), 800)
      return
    } catch (e: any) {
      const msg = e?.data?.error || e?.message || 'Bağlantı başlatılamadı'
      const detail = e?.data?.message || ''
      if (String(msg).includes('Meta App') || String(detail).includes('Meta App')) {
        setError('Meta uygulaması henüz yapılandırılmadı. Super Admin → Meta Ayarları’ndan App ID ve App Secret girmen gerekiyor. (developers.facebook.com → Uygulama → Ayarlar → Temel)')
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
      if (window.opener && !window.opener.closed) { try { window.opener.postMessage({ type: 'meta_connected' }, window.location.origin) } catch {} ; setTimeout(() => { try { window.close() } catch {} }, 800) }
    } catch (e: any) { setError(e.message) }
  }

  const handleSelectAssets = async () => {
    setError('')
    try {
      await api.selectMetaAssets({ pageId: selectedPage, catalogId: selectedCatalog, igUserId: selectedIg || null })
      await handleFbeAuto()
    } catch (e: any) { setError(e.message) }
  }

  const handleReplyComment = async () => {
    if (!replyTarget || !replyText.trim()) return
    setSendingReply(true)
    try {
      await api.replyMetaIgComment(replyTarget, replyText)
      setIgComments(igComments.map((c: any) => c.id === replyTarget ? { ...c, replies: [...(c.replies || []), { text: replyText, from: { name: 'Sen' } }] } : c))
      setReplyTarget(null)
      setReplyText('')
    } catch (e: any) { setError(e.message || 'Cevap gönderilemedi') }
    finally { setSendingReply(false) }
  }

  const handleSendMessage = async () => {
    if (!activeConv || !replyText.trim()) return
    setSendingMsg(true)
    try {
      const msg = replyText.trim()
      setReplyText('')
      await api.sendMetaIgMessage(activeConv, msg)
      setConvMessages([...convMessages, { message: msg, from: { name: 'Sen' }, created_time: new Date().toISOString() }])
    } catch (e: any) { setError(e.message || 'Mesaj gönderilemedi') }
    finally { setSendingMsg(false) }
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

  // Section tabs — Test Alanı sadece superadmin
  const allSections = [
    { key: 'publish', label: 'Paylaşım', icon: <Megaphone className="h-4 w-4" /> },
    { key: 'comments', label: 'Yorum Yönet', icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'messages', label: 'Mesajlar', icon: <Mail className="h-4 w-4" /> },
    { key: 'ads', label: 'Reklamlar', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'insights', label: 'İstatistik', icon: <BarChart3 className="h-4 w-4" /> },
    { key: 'test', label: 'Test Alanı', icon: <FlaskConical className="h-4 w-4" />, superOnly: true },
  ]
  const sections = allSections.filter(s => !(s as any).superOnly || isSuperAdmin)

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
          <div className="flex flex-col gap-2">
            {!metaStatus.connected ? (
              <>
                <div className="flex gap-2">
                  <button onClick={() => handleConnect('minimal')} disabled={connecting} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50" title="Sadece katalog_management — Invalid Scopes hatası vermez">
                    {connecting ? 'Yönlendiriliyor...' : 'Katalog ile Bağla (hatasız)'}
                  </button>
                  <button onClick={() => handleConnect('full')} disabled={connecting} className="rounded-lg bg-white border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50" title="Tüm sayfa/IG izinleri — App Review sonrası">
                    Tam yetki ile Bağla
                  </button>
                </div>
                <p className="text-xs text-zinc-500">İlk bağlantı için soldaki “Katalog ile Bağla” hatasız çalışır. Sayfada post/story için App Type Business + Facebook Login for Business aktif edip sağdaki ile tekrar bağla.</p>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleFbeAuto} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Otomatik Kur (katalog+piksel+domain)</button>
                <button onClick={() => setShowAssetPicker(v => !v)} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Varlıkları Seç</button>
              </div>
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

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mt-6">
        {sections.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)} className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition ${activeSection === s.key ? 'bg-indigo-600 text-white' : 'bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Comments section */}
      {activeSection === 'comments' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-3"><MessageCircle className="h-4 w-4 text-indigo-600" /> Instagram Yorum Yönetimi <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">instagram_manage_comments</span></h3>
          <div className="flex gap-2 mb-3">
            <button onClick={async () => { try { const r = await api.getMetaIgComments(); setIgComments(r.comments || []) } catch {} }} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Yorumları Yükle</button>
          </div>
          {igComments.length > 0 && (
            <div className="space-y-2 max-h-[360px] overflow-auto">
              {igComments.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs"><span className="font-medium">{c.from?.name}</span> <span className="text-zinc-500">{c.created_time ? new Date(c.created_time).toLocaleString('tr-TR') : ''}</span></p>
                    <p className="text-sm text-zinc-800 mt-0.5">{c.text}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setReplyTarget(c.id); setReplyText('') }} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-600" title="Cevapla"><Reply className="h-3 w-3" /></button>
                    <button onClick={async () => { try { await api.deleteMetaIgComment(c.id); setIgComments(igComments.filter((x: any) => x.id !== c.id)); } catch {} }} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Sil"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {replyTarget && (
            <div className="mt-3 flex gap-2">
              <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Cevap yazın..." className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm" onKeyDown={e => e.key === 'Enter' && handleReplyComment()} />
              <button onClick={handleReplyComment} disabled={sendingReply || !replyText.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Cevapla</button>
            </div>
          )}
          {igComments.length === 0 && <p className="text-xs text-zinc-500">Yorum yüklenmedi veya yok.</p>}
        </div>
      )}

      {/* Messages section */}
      {activeSection === 'messages' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-3"><Mail className="h-4 w-4 text-indigo-600" /> Instagram DM Mesajları <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">instagram_business_manage_messages</span></h3>
          <div className="flex gap-2 mb-3">
            <button onClick={async () => { try { const r = await api.getMetaIgMessages(); setIgConversations(r.conversations || []) } catch {} }} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Sohbetleri Yükle</button>
          </div>
          <div className="space-y-2">
            {igConversations.map((conv: any) => (
              <div key={conv.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700">Sohbet {conv.id.slice(0, 12)}…</span>
                  <button onClick={() => { setActiveConv(activeConv === conv.id ? null : conv.id); if (activeConv !== conv.id) api.getMetaIgConversation(conv.id).then(r => setConvMessages(r.conversation?.messages || [])).catch(() => {}) }} className="text-xs text-indigo-600 hover:underline">{activeConv === conv.id ? 'Kapatalım' : 'Aç'}</button>
                </div>
                {activeConv === conv.id && (
                  <div className="mt-2 space-y-1 max-h-[200px] overflow-auto">
                    {convMessages.map((m: any, i: number) => (
                      <div key={i} className="text-xs bg-white rounded px-2 py-1"><span className="font-medium">{m.from?.name}</span>: {m.message}</div>
                    ))}
                    {convMessages.length === 0 && <p className="text-xs text-zinc-500">Mesaj yok</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {activeConv && (
            <div className="mt-3 flex gap-2">
              <input id="msgInput" placeholder="Mesaj gönderin..." className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm" onKeyDown={e => e.key === 'Enter' && handleSendMessage()} />
              <button onClick={handleSendMessage} disabled={sendingMsg} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Gönder</button>
            </div>
          )}
        </div>
      )}

      {/* Ads section */}
      {activeSection === 'ads' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4">
           <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4 text-indigo-600" /> Reklamlar <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">ads_read</span></h3>
          <div className="flex gap-2 mb-3">
            <button onClick={async () => { try { const r = await api.getMetaAds(); setAds(r.ads || []) } catch {} }} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50">Reklamları Yükle</button>
          </div>
          <div className="space-y-2 max-h-[360px] overflow-auto">
            {ads.map((ad: any) => (
              <div key={ad.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-zinc-900">{ad.name}</p><p className="text-xs text-zinc-500">{ad.objective} · {ad.status}</p></div>
                  <button onClick={async () => { try { const r = await api.getMetaAdInsights(ad.id); setAdInsights(r.insights) } catch {} }} className="text-xs text-indigo-600 hover:underline">İstatistik</button>
                </div>
                {adInsights && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(adInsights[0] || {}).map(([k, v]) => (
                       <div key={k} className="bg-white rounded px-2 py-1"><span className="text-zinc-500">{k}:</span> <span className="font-medium">{String(v ?? '')}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {ads.length === 0 && <p className="text-xs text-zinc-500">Reklama yok.</p>}
        </div>
      )}

      {/* Insights section */}
      {activeSection === 'insights' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2 mb-3"><BarChart3 className="h-4 w-4 text-indigo-600" /> Sayfa & IG İstatistikleri <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">pages_read_engagement + ig_business_basic</span></h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold text-zinc-700 mb-2">Instagram Hesap</h4>
              {igAccount ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white rounded px-2 py-1">@<span className="font-medium">{igAccount.username}</span></div>
                  <div className="bg-white rounded px-2 py-1">Takipçi: <span className="font-medium">{igAccount.followers}</span></div>
                  <div className="bg-white rounded px-2 py-1">Takip: <span className="font-medium">{igAccount.followsCount}</span></div>
                  <div className="bg-white rounded px-2 py-1">Gönderi: <span className="font-medium">{igAccount.mediaCount}</span></div>
                </div>
              ) : <p className="text-xs text-zinc-500">Hesap bilgisi yüklenemedi</p>}
            </div>
            <div>
              <h4 className="text-xs font-semibold text-zinc-700 mb-2">Sayfa İstatistikleri</h4>
              {pageInsights ? (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(pageInsights).map(([k, v]) => (
                     <div key={k} className="bg-white rounded px-2 py-1"><span className="text-zinc-500">{k}:</span> <span className="font-medium">{String((v as any) ?? '')}</span></div>
                  ))}
                </div>
              ) : <p className="text-xs text-zinc-500">İstatistik yüklenemedi</p>}
            </div>
          </div>
        </div>
      )}

      {/* Test area — sadece superadmin (Meta Ayarları'ndaki inline test asıl yer) */}
      {isSuperAdmin && activeSection === 'test' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 mt-4">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2 mb-1"><FlaskConical className="h-4 w-4" /> Super Admin Test Alanı</h3>
          <p className="text-xs text-amber-700 mb-3">Tüm API endpoint'lerini doğrudan çağırıp yanıtları test et. Sadece süperadmin tarafından kullanılır.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <button onClick={async () => { try { const r = await api.getMetaIgComments(); console.log('ig/comments:', r); alert('Yorumlar: ' + JSON.stringify(r.comments?.length || 0) + ' adet') } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">📝 <span className="font-medium">Yorumları GET</span><br /><span className="text-xs text-zinc-500">/facebook/ig/comments</span></button>
            <button onClick={async () => { try { const r = await api.getMetaIgMessages(); console.log('ig/messages:', r); alert('Sohbetler: ' + JSON.stringify(r.conversations?.length || 0) + ' adet') } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">💬 <span className="font-medium">Mesajları GET</span><br /><span className="text-xs text-zinc-500">/facebook/ig/messages</span></button>
            <button onClick={async () => { try { const r = await api.getMetaAds(); console.log('ads:', r); alert('Reklamlar: ' + JSON.stringify(r.ads?.length || 0) + ' adet') } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">🎯 <span className="font-medium">Reklamları GET</span><br /><span className="text-xs text-zinc-500">/facebook/ads</span></button>
            <button onClick={async () => { try { const r = await api.getMetaPageInsights(); console.log('insights:', r); alert('İstatistik: ' + JSON.stringify(r)) } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">📊 <span className="font-medium">İstatistikleri GET</span><br /><span className="text-xs text-zinc-500">/facebook/page/insights</span></button>
            <button onClick={async () => { try { const r = await api.getMetaIgAccount(); console.log('ig/account:', r); alert('IG Hesap: ' + JSON.stringify(r.account)) } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">📸 <span className="font-medium">IG Hesap Bilgisi</span><br /><span className="text-xs text-zinc-500">/facebook/ig/account</span></button>
            <button onClick={async () => { try { const r = await api.getMetaIgComments(''); alert('Boş yorum listesi: ' + JSON.stringify(r)) } catch (e: any) { alert('Hata: ' + e.message) } }} className="rounded-lg bg-white border border-amber-300 px-4 py-3 text-left hover:bg-amber-100">🔍 <span className="font-medium">Edge Test</span><br /><span className="text-xs text-zinc-500">Çağrı formatı kontrol</span></button>
          </div>
          <p className="text-xs text-amber-600 mt-3">Tüm istekler konsola (F12 → Console) ve alert ile döner. Hata mesajları hangi izinlerin eksik olduğunu gösterir.</p>
        </div>
      )}

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
          {error && (
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
              {String(error).toLowerCase().includes('beyaz liste') || String(error).toLowerCase().includes('whitelist') || String(error).toLowerCase().includes('redirect') ? (
                <div className="mt-2 rounded-md bg-white border border-red-200 p-3">
                  <p className="text-xs font-semibold text-zinc-900">Yapman gereken (30 sn):</p>
                  <p className="mt-1 text-xs text-zinc-600">developers.facebook.com → Uygulaman → Facebook Login → Ayarlar → Valid OAuth Redirect URIs → şunu ekle:</p>
                  <code className="mt-1 block rounded bg-zinc-900 px-2 py-1.5 text-xs font-mono text-white break-all">{oauthRedirectUri || 'https://api.rahatio.com.tr/api/admin/integrations/facebook/oauth/callback'}</code>
                  <p className="mt-1 text-xs text-zinc-500">Client OAuth Login ve Web OAuth Login = Açık, App Domains = rahatio.com.tr</p>
                  <a href="/meta-settings" className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700">Meta Ayarları’na git →</a>
                </div>
              ) : null}
            </div>
          )}
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
