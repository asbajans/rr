'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Copy, Download, Globe, Server, Bell, Sparkles, Star, Tag, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, store, productLimit } = useAuth()
  const [storeSettings, setStoreSettings] = useState<Store | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [siteStatus, setSiteStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPlain, setNewKeyPlain] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [aiCategories, setAiCategories] = useState<any[]>([])
  const [defaultAiCategoryId, setDefaultAiCategoryId] = useState<number | null>(null)
  const [aiCatLoading, setAiCatLoading] = useState(true)
  const [newCatName, setNewCatName] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [catCreating, setCatCreating] = useState(false)
  const [catGenerating, setCatGenerating] = useState<number | null>(null)
  const [catDeleting, setCatDeleting] = useState<number | null>(null)

  const loadAiCategories = async () => {
    try {
      const r = await api.listAiCategories()
      setAiCategories(r.categories)
      setDefaultAiCategoryId(r.defaultCategoryId)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        setStoreSettings(s)
        setName(s.name)
        setEmail(s.email ?? '')
        setSiteCode(s.site_code ?? s.siteCode ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.getAdminApiKeys()
      .then(setApiKeys)
      .catch(() => {})
      .finally(() => setKeysLoading(false))
  }, [])

  useEffect(() => {
    setAiCatLoading(true)
    loadAiCategories().finally(() => setAiCatLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!siteCode.trim()) {
      setSiteStatus('idle')
      return
    }
    const saved = storeSettings?.site_code ?? ''
    const timer = setTimeout(() => {
      const normalized = siteCode.trim().toLowerCase()
      if (!/^[a-z0-9-]{2,50}$/.test(normalized)) {
        setSiteStatus('invalid')
        return
      }
      if (normalized === saved.toLowerCase()) {
        setSiteStatus('available')
        return
      }
      setSiteStatus('checking')
      api.checkSiteCode(normalized)
        .then((r) => setSiteStatus(r.available ? 'available' : 'taken'))
        .catch(() => setSiteStatus('idle'))
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])

  if (!user) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload: any = { name, email }
      const current = (storeSettings?.site_code ?? '').toLowerCase()
      const next = siteCode.trim().toLowerCase()
      if (next && next !== current) payload.siteCode = next
      const updated = await api.updateSettings(payload)
      setStoreSettings(updated)
      setSiteCode(updated.site_code ?? next)
      setMessage('Ayarlar kaydedildi.')
    } catch (err) {
      const anyErr = err as any
      setMessage(anyErr?.message || 'Hata oluştu')
      if (anyErr?.status === 409) setSiteStatus('taken')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setNewKeyPlain('')
    try {
      const res = await api.createAdminApiKey({ name: newKeyName })
      setNewKeyPlain(res.plain_text)
      setApiKeys((prev) => [...prev, res.api_key])
      setNewKeyName('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'API anahtarı oluşturulamadı')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteKey(id: number) {
    setDeleting(id)
    try {
      await api.deleteAdminApiKey(id)
      setApiKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    setCatCreating(true)
    try {
      await api.createAiCategory({ name: newCatName.trim(), autoGenerate })
      setNewCatName('')
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kategori oluşturulamadı')
    } finally {
      setCatCreating(false)
    }
  }

  async function handleRegenerateAttributes(id: number) {
    setCatGenerating(id)
    try {
      await api.regenerateAiCategoryAttributes(id)
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Özellikler üretilemedi')
    } finally {
      setCatGenerating(null)
    }
  }

  async function handleSetDefault(id: number | null) {
    try {
      await api.setDefaultAiCategory(id)
      setDefaultAiCategoryId(id)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Varsayılan ayarlanamadı')
    }
  }

  async function handleDeleteCategory(id: number) {
    setCatDeleting(id)
    try {
      await api.deleteAiCategory(id)
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setCatDeleting(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ayarlar</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza ayarlarını yönet.</p>
      <div className="mt-8 space-y-8">
          <div className="rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Profil</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p><span className="font-medium text-zinc-900">Ad:</span> {user.name}</p>
            <p><span className="font-medium text-zinc-900">E-posta:</span> {user.email}</p>
            <p><span className="font-medium text-zinc-900">AI Kredisi:</span> {user.ai_credits}</p>
          </div>
        </div>

        {store && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Plan</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="font-medium text-zinc-900">Plan:</span> {store.plan?.name ?? '—'}</p>
              <p><span className="font-medium text-zinc-900">Yayınlama:</span> {store.plan?.hosting === 'vercel' ? 'Vercel (Slave)' : store.plan?.hosting === 'custom' ? 'Kendi Sunucu' : 'Rahatio Alan Adı'}</p>
              <p><span className="font-medium text-zinc-900">Ürün Limiti:</span> {(store.plan?.product_limit ?? -1) < 0 ? 'Sınırsız' : store.plan?.product_limit ?? '-'}</p>
              <p><span className="font-medium text-zinc-900">AI Kredisi / Ay:</span> {store.plan?.ai_credits ?? '-'}</p>
            </div>
          </div>
        )}

        <Link href="/settings/notifications"
          className="flex items-center gap-3 rounded-xl border border-zinc-200 p-6 hover:bg-zinc-50 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <Bell className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Bildirim Ayarları</h2>
            <p className="text-sm text-zinc-600">Email (SMTP) ve SMS (Twilio) ayarlarını yapılandırın</p>
          </div>
        </Link>

        {storeSettings && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Mağaza Ayarları</h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Mağaza Adı</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">İletişim E-postası</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Mağaza Adresi</label>
                <div className="mt-1 flex items-stretch rounded-lg border border-zinc-300 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="flex items-center whitespace-nowrap rounded-l-lg bg-zinc-100 px-3 text-sm text-zinc-500">rahatio.com.tr/stores/</span>
                  <input
                    type="text"
                    value={siteCode}
                    onChange={(e) => setSiteCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="magaza-adin"
                    maxLength={50}
                    className="w-full rounded-r-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {siteStatus === 'checking' && <span className="text-zinc-400">Kontrol ediliyor...</span>}
                  {siteStatus === 'available' && <span className="text-green-600">✓ Bu adres kullanılabilir.</span>}
                  {siteStatus === 'taken' && <span className="text-red-600">Bu adres başka bir mağaza tarafından kullanılıyor. Lütfen başka bir adres seçin.</span>}
                  {siteStatus === 'invalid' && <span className="text-red-600">Sadece küçük harf, rakam ve tire (-) kullanın (2-50 karakter).</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3">
                <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500">Mağaza Siten</p>
                  <a
                    href={storeSettings.domain ? `https://${storeSettings.domain}` : `https://rahatio.com.tr/stores/${siteCode}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block truncate text-sm text-indigo-600 hover:underline"
                  >
                    {storeSettings.domain ?? `rahatio.com.tr/stores/${siteCode}`}
                  </a>
                </div>
              </div>
              {message && <p className={`text-sm ${message.includes('kaydedildi') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving || siteStatus === 'taken' || siteStatus === 'invalid'}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </form>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">API Anahtarları</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Mağazana bağlanmak için API anahtarlarını yönet.</p>

          <div className="mt-4 flex items-center gap-2">
            <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Anahtar adı" maxLength={255}
              className="block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <Button size="sm" onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              <Plus className="mr-1 h-3 w-3" />{creating ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>

          {newKeyPlain && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">Anahtar oluşturuldu! Bir kez gösterilir, kopyala:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2 py-1 text-sm text-green-800">{newKeyPlain}</code>
                <button onClick={() => navigator.clipboard.writeText(newKeyPlain)}
                  className="rounded p-1 text-green-600 hover:bg-green-100">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {keysLoading && <p className="mt-3 text-sm text-zinc-400">Yükleniyor...</p>}
          {!keysLoading && apiKeys.length === 0 && (
            <p className="mt-3 text-sm text-zinc-400">Henüz API anahtarı oluşturulmamış.</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">AI Kategorileri</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Ürün oluştururken AI'ın yönlendirileceği kategoriler. Her kategoriye özel özellik şeması otomatik üretilir; AI görseli analiz ederken ve başlık/açıklama yazarken bu şemayı kullanır. Varsayılan kategori, ürün oluşturma ekranında önceden seçili gelir.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-zinc-900">Yeni Kategori</label>
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder="örn. Oto Yedek Parça, Bebek Giyim..."
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-600">
              <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300" />
              Özellikleri AI ile otomatik üret (2 kredi)
            </label>
            <Button size="sm" onClick={handleCreateCategory} disabled={catCreating || !newCatName.trim()}>
              <Plus className="mr-1 h-3 w-3" />{catCreating ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>

          {aiCatLoading && <p className="mt-4 text-sm text-zinc-400">Yükleniyor...</p>}
          {!aiCatLoading && aiCategories.length === 0 && (
            <p className="mt-4 text-sm text-zinc-400">Henüz kategori yok. Yukarıdan bir kategori oluştur.</p>
          )}
          {!aiCatLoading && aiCategories.length > 0 && (
            <div className="mt-4 space-y-3">
              {aiCategories.map((cat) => {
                const attrs = Array.isArray(cat.aiAttributes) ? cat.aiAttributes : []
                return (
                  <div key={cat.id} className={`rounded-lg border px-4 py-3 ${cat.isDefault ? 'border-indigo-300 bg-indigo-50/50' : 'border-zinc-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900">{cat.name}</span>
                        {cat.builtin && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Hazır</span>}
                        {cat.isDefault && (
                          <span className="flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            <Star className="h-3 w-3" />Varsayılan
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">{attrs.length} özellik</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!cat.isDefault && (
                          <button onClick={() => handleSetDefault(cat.id)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                            Varsayılan Yap
                          </button>
                        )}
                        {cat.builtin && <button onClick={() => handleSetDefault(null)}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                          Varsayılan Kaldır
                        </button>}
                        <button onClick={() => handleRegenerateAttributes(cat.id)} disabled={catGenerating === cat.id}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                          {catGenerating === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-violet-500" />}
                          Özellik Üret
                        </button>
                        {!cat.builtin && (
                          <button onClick={() => handleDeleteCategory(cat.id)} disabled={catDeleting === cat.id}
                            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {attrs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {attrs.map((a: any, i: number) => (
                          <span key={i} title={a.description || a.name}
                            className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Slave Node</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Mağazanı kendi sunucunda çalıştırmak için slave yazılımını indir.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <Server className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">PHP (Paylaşımlı Hosting)</h3>
              <p className="mt-1 text-xs text-zinc-500">
                cPanel, FTP veya herhangi bir PHP hosting için tek dosya.
                İndir → FTP'ye yükle → Çalışmaya başla.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => api.downloadSlavePhp()}
                disabled={apiKeys.length === 0}
              >
                <Download className="mr-1 h-3 w-3" />İndir (PHP)
              </Button>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Globe className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">Vercel (Serverless)</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Vercel'e tek tıkla deploy. Ücretsiz, otomatik ölçeklenir.
                GitHub bağla veya ZIP yükle.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => api.downloadSlaveVercel()}
                disabled={apiKeys.length === 0}
              >
                <Download className="mr-1 h-3 w-3" />İndir (Vercel ZIP)
              </Button>
            </div>
          </div>
          {apiKeys.length === 0 && (
            <p className="mt-3 text-xs text-amber-600">Önce bir API anahtarı oluşturmalısın.</p>
          )}
          {!keysLoading && apiKeys.length > 0 && (
            <div className="mt-3 space-y-2">
              {apiKeys.map((ak) => (
                <div key={ak.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{ak.name}</p>
                    <p className="text-xs text-zinc-400">
                      {ak.last_used_at ? `Son: ${new Date(ak.last_used_at).toLocaleDateString('tr-TR')}` : 'Hiç kullanılmadı'}
                      {' · '}ID: {ak.id}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteKey(ak.id)} disabled={deleting === ak.id}
                    className="rounded p-1 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
