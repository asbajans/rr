'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Copy } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [store, setStore] = useState<Store | null>(null)
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

  useEffect(() => {
    api.getSettings()
      .then((s) => { setStore(s); setName(s.name); setEmail(s.email ?? '') })
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.getAdminApiKeys()
      .then(setApiKeys)
      .catch(() => {})
      .finally(() => setKeysLoading(false))
  }, [])

  if (!user) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.updateSettings({ name, email })
      setStore(updated)
      setMessage('Ayarlar kaydedildi.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hata oluştu')
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
              <p className="text-xs text-zinc-400">Site Kodu: {store.site_code} | Domain: {store.domain ?? '-'}</p>
              {message && <p className={`text-sm ${message.includes('kaydedildi') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
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
