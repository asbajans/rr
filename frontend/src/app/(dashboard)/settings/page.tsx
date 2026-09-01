'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Copy, Bell, Sparkles, Star, Tag, Loader2, Lock } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, store } = useAuth()
  const [storeSettings, setStoreSettings] = useState<Store | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

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
  }, [])

  if (!user) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.updateSettings({ name, email })
      setStoreSettings(updated)
      setMessage('Ayarlar kaydedildi.')
    } catch (err: any) {
      setMessage(err?.message || 'Hata oluştu')
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

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    setPwError('')
    if (!newPassword || newPassword.length < 8) {
      setPwError('Yeni şifre en az 8 karakter olmalı')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Yeni şifre ve tekrarı uyuşmuyor')
      return
    }
    setPwSaving(true)
    try {
      const res = await api.changePassword(currentPassword || undefined, newPassword)
      setPwMsg(res.message || 'Şifre başarıyla güncellendi')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Şifre değiştirilemedi')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ayarlar</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza ve hesap ayarlarını yönet.</p>
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
              <p><span className="font-medium text-zinc-900">Yayınlama:</span> {store.plan?.hosting === 'vercel' ? 'Vercel (Slave)' : store.plan?.hosting === 'custom' ? 'Kendi Sunucu' : 'Rahatio'}</p>
              <p><span className="font-medium text-zinc-900">Ürün Limiti:</span> {(store.plan?.product_limit ?? -1) < 0 ? 'Sınırsız' : store.plan?.product_limit ?? '-'}</p>
              <p><span className="font-medium text-zinc-900">AI Kredisi / Ay:</span> {store.plan?.ai_credits ?? '-'}</p>
            </div>
            <p className="mt-3 text-xs text-zinc-500">Site yayın ve domain ayarları için <Link href="/site-publish" className="font-medium text-indigo-600 hover:underline">Site Yayın</Link> sayfasına git.</p>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Şifre Değiştir</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Hesap şifrenizi güncelleyin. Google ile giriş yaptıysanız mevcut şifreyi boş bırakabilirsiniz.</p>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Mevcut Şifre</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mevcut şifreniz (Google hesabı için boş bırakın)"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Yeni Şifre</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Yeni Şifre (Tekrar)</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreyi tekrar girin"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </Button>
          </form>
        </div>

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
            <h2 className="text-lg font-semibold text-zinc-900">Mağaza Bilgileri</h2>
            <p className="mt-1 text-sm text-zinc-600">Ad ve iletişim e-postası. Adres ve domain için <Link href="/site-publish" className="text-indigo-600 hover:underline">Site Yayın</Link>.</p>
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
              {message && <p className={`text-sm ${message.includes('kaydedildi') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving}>
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
            Ürün oluştururken AI&apos;ın yönlendirileceği kategoriler. Her kategoriye özel özellik şeması otomatik üretilir.
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

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Tehlikeli Bölge</h2>
          </div>
          <p className="mt-1 text-sm text-red-700">
            Hesabınızı ve verilerinizi silme talebi. Bu işlem 3 ayrı onayla hesabınızı pasife alır; tekrar giriş yapamazsınız.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/deletemyaccount">
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <Trash2 className="mr-1 h-3 w-3" /> Hesabımı Sil — deletemyaccount
              </Button>
            </Link>
            <span className="text-xs text-red-600">rahatio.com.tr/deletemyaccount</span>
          </div>
        </div>
      </div>
    </div>
  )
}
