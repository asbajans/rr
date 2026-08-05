'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, StoreTheme, SiteDeployment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Palette, Type, Code, Upload, Image, Rocket, Undo2, History } from 'lucide-react'

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
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(true)
  const [deployments, setDeployments] = useState<SiteDeployment[]>([])
  const [deploying, setDeploying] = useState(false)
  const [publishNote, setPublishNote] = useState('')
  const [providerInfo, setProviderInfo] = useState<{ provider: string; configured: boolean; canDeploy: boolean; reason: string | null } | null>(null)

  useEffect(() => {
    api.getSettings()
      .then((s) => { setStore(s); setTheme(s.theme ?? {}); setPublished(s.published !== false) })
      .catch(() => {})
    api.getSiteDeployments()
      .then((r) => { setPublished(r.published); setDeployments(r.deployments) })
      .catch(() => {})
    api.getSiteProvider().then(setProviderInfo).catch(() => {})
  }, [])

  if (!user) return null

  function updateTheme(partial: Partial<StoreTheme>) {
    setTheme((prev) => ({ ...prev, ...partial }))
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
      await api.updateSettings({ theme })
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
      await api.updateSettings({ theme })
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
