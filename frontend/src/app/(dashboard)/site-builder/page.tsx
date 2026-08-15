'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, StoreTheme, StoreHomepage, SiteDeployment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Palette, Type, Code, Upload, Image, Rocket, Undo2, History, LayoutTemplate, MessageCircle } from 'lucide-react'

const FONT_OPTIONS = ['Inter', 'Playfair Display', 'Roboto', 'Open Sans']

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  published: { label: 'Yayında', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  draft: { label: 'Taslak', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  reverted: { label: 'Geri Alındı', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
  failed: { label: 'Hata', cls: 'bg-red-50 text-red-700 border-red-200' },
}

export default function SiteBuilderPage() {
  const { user } = useAuth()
  const [store, setStore] = useState<Store | null>(null)
  const [theme, setTheme] = useState<StoreTheme>({})
  const [homepage, setHomepage] = useState<StoreHomepage>({ enabled: false, type: 'none' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(true)
  const [deployments, setDeployments] = useState<SiteDeployment[]>([])
  const [deploying, setDeploying] = useState(false)
  const [publishNote, setPublishNote] = useState('')
  const [providerInfo, setProviderInfo] = useState<{ provider: string; configured: boolean; canDeploy: boolean; reason: string | null } | null>(null)
  const [domainInput, setDomainInput] = useState('')
  const [domainInfo, setDomainInfo] = useState<{ domain: string | null; verified: boolean; configured?: boolean; verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }>; url?: string | null } | null>(null)
  const [domainBusy, setDomainBusy] = useState(false)

  useEffect(() => {
    api.getSettings()
      .then((s) => { setStore(s); setTheme(s.theme ?? {}); setHomepage(s.homepage ?? { enabled: false, type: 'none' }); setPublished(s.published !== false) })
      .catch(() => {})
    api.getSiteDeployments()
      .then((r) => { setPublished(r.published); setDeployments(r.deployments) })
      .catch(() => {})
    api.getSiteProvider().then(setProviderInfo).catch(() => {})
    api.getSiteDomain().then((d) => { setDomainInfo(d); if (d.domain) setDomainInput(d.domain) }).catch(() => {})
  }, [])

  useEffect(() => {
    const pending = deployments.filter((d) => d.provider === 'vercel' && d.providerStatus === 'pending')
    if (pending.length === 0) return
    const timer = window.setInterval(async () => {
      await Promise.all(pending.map((d) => api.getSiteDeploymentStatus(d.id).catch(() => null)))
      await refreshDeployments()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [deployments])

  if (!user) return null

  function updateTheme(partial: Partial<StoreTheme>) {
    setTheme((prev) => ({ ...prev, ...partial }))
  }

  function updateHomepage(partial: Partial<StoreHomepage>) {
    setHomepage((prev) => ({ ...prev, ...partial }))
  }

  async function handleHeroUpload() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading('logo') // reuse busy indicator slot
      try {
        const { url } = await api.uploadImage(file)
        updateHomepage({ image_url: url })
        setMessage('Hero görseli yüklendi.')
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Yükleme hatası')
      } finally {
        setUploading(null)
      }
    }
    input.click()
  }

  async function handleUpload(field: 'logo_url' | 'favicon_url') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(field === 'logo_url' ? 'logo' : 'favicon')
      try {
        const { url } = await api.uploadImage(file)
        updateTheme({ [field]: url })
        setMessage(`${field === 'logo_url' ? 'Logo' : 'Favicon'} yüklendi.`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Yükleme hatası')
      } finally {
        setUploading(null)
      }
    }
    input.click()
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.updateSettings({ theme, homepage })
      setMessage('Tema ayarları kaydedildi.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setDeploying(true)
    setMessage('')
    try {
      // Kaydedilmemiş tema değişikliklerini önce kaydet
      await api.updateSettings({ theme, homepage })
      await api.publishSite(publishNote || undefined)
      setPublished(true)
      setPublishNote('')
      await refreshDeployments()
      setMessage('Site yayınlandı.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Yayınlama hatası')
    } finally {
      setDeploying(false)
    }
  }

  async function handleManagedDeploy() {
    setDeploying(true); setMessage('')
    try {
      await api.updateSettings({ theme, homepage })
      const result = await api.deployManagedSite(publishNote || undefined)
      setPublishNote('')
      await refreshDeployments()
      setMessage(result.deployment.providerStatus === 'pending' ? 'Deployment başlatıldı; durum izleniyor.' : 'Deployment tamamlandı.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Deployment hatası') }
    finally { setDeploying(false) }
  }

  async function handleAddDomain() {
    setDomainBusy(true); setMessage('')
    try {
      const result = await api.addSiteDomain(domainInput)
      setDomainInfo(result)
      setMessage(result.verified ? 'Domain doğrulandı ve siteye bağlandı.' : 'Domain eklendi. Aşağıdaki DNS kayıtlarını oluşturup tekrar doğrulayın.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Domain eklenemedi') }
    finally { setDomainBusy(false) }
  }

  async function handleVerifyDomain() {
    setDomainBusy(true); setMessage('')
    try {
      const result = await api.verifySiteDomain()
      setDomainInfo(result)
      setMessage(result.verified ? 'Domain doğrulandı ve siteye bağlandı.' : 'Domain henüz doğrulanamadı; DNS kayıtlarını kontrol edin.')
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Domain doğrulanamadı') }
    finally { setDomainBusy(false) }
  }

  async function handleUnpublish() {
    setDeploying(true)
    setMessage('')
    try {
      await api.unpublishSite(publishNote || undefined)
      setPublished(false)
      setPublishNote('')
      await refreshDeployments()
      setMessage('Site yayından kaldırıldı (taslak).')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Yayından kaldırma hatası')
    } finally {
      setDeploying(false)
    }
  }

  async function handleRollback(d: SiteDeployment) {
    if (!window.confirm(`#${d.id} (v${d.version}) sürümüne geri dönülsün mü? Mevcut tema ve site adresi geri alınır.`)) return
    setDeploying(true)
    setMessage('')
    try {
      await api.rollbackSiteDeployment(d.id)
      const s = await api.getSettings()
      setStore(s)
      setTheme(s.theme ?? {})
      setPublished(true)
      await refreshDeployments()
      setMessage(`#${d.id} sürümüne geri dönüldü.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Geri alma hatası')
    } finally {
      setDeploying(false)
    }
  }

  async function refreshDeployments() {
    try {
      const r = await api.getSiteDeployments()
      setPublished(r.published)
      setDeployments(r.deployments)
    } catch { /* ignore */ }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Site Builder</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza temasını ve görünümünü özelleştir.</p>

      {/* Publish / Deployment */}
      {providerInfo && (
        <div className={`mt-4 rounded-lg border p-3 text-sm ${providerInfo.canDeploy ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          Yayınlama sağlayıcısı: <span className="font-semibold">{providerInfo.provider}</span>
          {!providerInfo.canDeploy && providerInfo.reason ? ` — ${providerInfo.reason}` : ''}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Site Yayını</h2>
            <span className={`ml-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_LABEL[published ? 'published' : 'draft']?.cls ?? ''}`}>
              {STATUS_LABEL[published ? 'published' : 'draft']?.label ?? (published ? 'Yayında' : 'Taslak')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={publishNote} onChange={(e) => setPublishNote(e.target.value)}
              placeholder="Yayın notu (opsiyonel)"
              className="block w-56 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
            <Button size="sm" onClick={handlePublish} disabled={deploying || published || providerInfo?.canDeploy === false}>
              {deploying ? 'İşleniyor...' : 'Yayınla'}
            </Button>
            {providerInfo?.provider !== 'rahatio' && providerInfo?.canDeploy && (
              <Button size="sm" variant="outline" onClick={handleManagedDeploy} disabled={deploying}>
                {deploying ? 'İşleniyor...' : 'Provider’a Deploy Et'}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleUnpublish} disabled={deploying || !published}>
              Yayından Kaldır
            </Button>
          </div>
        </div>

        {store?.site_code && (
          <p className="mt-3 text-xs text-zinc-500">
            Mağaza adresi: <a className="font-medium text-indigo-600 hover:underline"
              href={`/stores/${store.site_code}`} target="_blank" rel="noreferrer">
              rahatio.com.tr/stores/{store.site_code}
            </a>
            {published && ' — şu anda yayında'}
          </p>
        )}

        {deployments.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900">Yayın Geçmişi</h3>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">#</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Durum</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Tarih</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500">Not</th>
                    <th className="px-4 py-2.5 font-medium text-zinc-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {deployments.map((d) => {
                    const st = STATUS_LABEL[d.status] ?? { label: d.status, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' }
                    return (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5 text-zinc-700">v{d.version}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                          {d.provider && <span className="ml-2 text-[11px] text-zinc-400">{d.provider}{d.providerStatus ? `/${d.providerStatus}` : ''}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-600">
                          {new Date(d.createdAt).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500">{d.note || '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {d.status === 'published' && !published && (
                            <button onClick={() => handleRollback(d)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
                              <Undo2 className="h-3.5 w-3.5" /> Geri Dön
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {providerInfo?.provider === 'vercel' && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Özel Domain</h2>
            <p className="mt-1 text-sm text-zinc-600">Domaininizi Vercel projesine bağlayın. DNS kayıtları kendi DNS sağlayıcınızda oluşturulur.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="magazaniz.com"
                className="w-64 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button size="sm" onClick={handleAddDomain} disabled={domainBusy || !domainInput.trim()}>
                {domainBusy ? 'Kontrol ediliyor...' : 'Domaini Ekle'}
              </Button>
              {domainInfo?.domain && !domainInfo.verified && (
                <Button size="sm" variant="outline" onClick={handleVerifyDomain} disabled={domainBusy}>
                  Tekrar Doğrula
                </Button>
              )}
            </div>
            {domainInfo?.domain && (
              <div className={`mt-4 rounded-lg border p-3 text-sm ${domainInfo.verified ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                <div className="font-medium">{domainInfo.domain}: {domainInfo.verified ? 'Doğrulandı' : 'DNS doğrulaması bekleniyor'}</div>
                {!domainInfo.verified && domainInfo.verification.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <p className="mb-2 text-xs">Aşağıdaki kayıtları DNS sağlayıcınızda oluşturun:</p>
                    <table className="min-w-full text-xs">
                      <thead><tr className="text-left"><th className="pr-4 py-1">Tür</th><th className="pr-4 py-1">Ad</th><th className="py-1">Değer</th></tr></thead>
                      <tbody>
                        {domainInfo.verification.map((record, index) => (
                          <tr key={`${record.type}-${index}`} className="border-t border-amber-200/70 align-top">
                            <td className="pr-4 py-2 font-medium">{record.type || 'TXT'}</td>
                            <td className="pr-4 py-2 font-mono break-all">{record.domain || domainInfo.domain}</td>
                            <td className="py-2 font-mono break-all">{record.value || record.reason || 'Vercel panelindeki değeri kullanın'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Logo & Favicon */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Logo & Favicon</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Logo</label>
              {theme.logo_url && (
                <img src={theme.logo_url} alt="Logo" className="mt-2 mb-2 max-h-16 rounded border border-zinc-200" />
              )}
              <Button size="sm" variant="outline" onClick={() => handleUpload('logo_url')} disabled={uploading === 'logo'}>
                <Upload className="mr-1 h-3 w-3" />{uploading === 'logo' ? 'Yükleniyor...' : 'Logo Yükle'}
              </Button>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Favicon</label>
              {theme.favicon_url && (
                <img src={theme.favicon_url} alt="Favicon" className="mt-2 mb-2 max-h-10 rounded border border-zinc-200" />
              )}
              <Button size="sm" variant="outline" onClick={() => handleUpload('favicon_url')} disabled={uploading === 'favicon'}>
                <Upload className="mr-1 h-3 w-3" />{uploading === 'favicon' ? 'Yükleniyor...' : 'Favicon Yükle'}
              </Button>
            </div>
          </div>
        </div>

        {/* Homepage Hero */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-zinc-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Ana Sayfa Hero Alanı</h2>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input type="checkbox" checked={homepage.enabled !== false}
                onChange={(e) => updateHomepage({ enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
              Hero alanını göster
            </label>
          </div>
          {homepage.enabled !== false && (
            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Hero Türü</label>
                <select
                  value={homepage.type || 'image'}
                  onChange={(e) => updateHomepage({ type: e.target.value as 'image' | 'youtube' })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="image">Görsel / Arka Plan</option>
                  <option value="youtube">YouTube Videosu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Yükseklik</label>
                <select
                  value={homepage.min_height || 'min-h-[420px]'}
                  onChange={(e) => updateHomepage({ min_height: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="min-h-[300px]">Kısa (300px)</option>
                  <option value="min-h-[420px]">Orta (420px)</option>
                  <option value="min-h-[560px]">Uzun (560px)</option>
                </select>
              </div>
              {homepage.type === 'youtube' ? (
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-zinc-900">YouTube Video URL</label>
                  <input
                    value={homepage.youtube_url || ''}
                    onChange={(e) => updateHomepage({ youtube_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                </div>
              ) : (
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-zinc-900">Hero Görseli (Arka Plan)</label>
                  {homepage.image_url && (
                    <img src={homepage.image_url} alt="Hero" className="mt-2 mb-2 max-h-40 rounded border border-zinc-200 object-cover" />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={homepage.image_url || ''}
                      onChange={(e) => updateHomepage({ image_url: e.target.value })}
                      placeholder="https://... veya yükle"
                      className="block flex-1 min-w-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    <Button size="sm" variant="outline" onClick={handleHeroUpload} disabled={uploading !== null}>
                      <Upload className="mr-1 h-3 w-3" />{uploading !== null ? 'Yükleniyor...' : 'Görsel Yükle'}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-zinc-900">Karartma / Opaklık (%{homepage.overlay_opacity ?? 40})</label>
                    <input type="range" min="0" max="90" value={homepage.overlay_opacity ?? 40}
                      onChange={(e) => updateHomepage({ overlay_opacity: parseInt(e.target.value, 10) })}
                      className="mt-1 w-full" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-900">Başlık</label>
                <input
                  value={homepage.heading || ''}
                  onChange={(e) => updateHomepage({ heading: e.target.value })}
                  placeholder="Mağazanızın sloganı..."
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Alt Metin</label>
                <input
                  value={homepage.subtitle || ''}
                  onChange={(e) => updateHomepage({ subtitle: e.target.value })}
                  placeholder="Kısa açıklama..."
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Buton Metni</label>
                <input
                  value={homepage.button_text || ''}
                  onChange={(e) => updateHomepage({ button_text: e.target.value })}
                  placeholder="Alışverişe Başla"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Buton Linki</label>
                <input
                  value={homepage.button_url || ''}
                  onChange={(e) => updateHomepage({ button_url: e.target.value })}
                  placeholder="#"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Renkler</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Birincil Renk</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.primary_color || '#4f46e5'}
                  onChange={(e) => updateTheme({ primary_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.primary_color || ''}
                  onChange={(e) => updateTheme({ primary_color: e.target.value })}
                  placeholder="#4f46e5"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">İkincil Renk</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.secondary_color || '#18181b'}
                  onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.secondary_color || ''}
                  onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                  placeholder="#18181b"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Vurgu Rengi</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.accent_color || '#f59e0b'}
                  onChange={(e) => updateTheme({ accent_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.accent_color || ''}
                  onChange={(e) => updateTheme({ accent_color: e.target.value })}
                  placeholder="#f59e0b"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Yazı Tipi</h2>
          </div>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-zinc-900">Font Ailesi</label>
            <select value={theme.font_family || 'Inter'}
              onChange={(e) => updateTheme({ font_family: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WhatsApp Contact */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold text-zinc-900">WhatsApp İletişim</h2>
          </div>
          <div className="mt-4 max-w-md">
            <label className="block text-sm font-medium text-zinc-900">WhatsApp Telefon Numarası</label>
            <input type="tel" value={theme.whatsapp_number || ''}
              onChange={(e) => updateTheme({ whatsapp_number: e.target.value })}
              placeholder="+90 5XX XXX XX XX"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500" />
            <p className="mt-1 text-xs text-zinc-500">Ülke kodu ile birlikte girin. Boş bırakırsanız buton gösterilmez.</p>
          </div>
        </div>

        {/* Custom CSS */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Özel CSS</h2>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-900">CSS Kodları</label>
            <textarea value={theme.custom_css || ''}
              onChange={(e) => updateTheme({ custom_css: e.target.value })}
              rows={10}
              placeholder="/* Özel stillerinizi buraya ekleyin */"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('kaydedildi') || message.includes('yüklendi') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Temayı Kaydet'}
        </Button>
      </div>
    </div>
  )
}
