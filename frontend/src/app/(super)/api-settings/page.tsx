'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Settings, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'

export default function SuperApiSettingsPage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.getGlobalSettings()
      .then(r => setSettings(r.settings || {}))
      .catch(() => setMessage('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  async function saveSetting(key: string, value: string) {
    setSaving(key)
    setMessage('')
    try {
      await api.updateGlobalSetting(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
      setMessage(`${key} kaydedildi`)
    } catch {
      setMessage(`${key} kaydedilemedi`)
    } finally {
      setSaving(null)
    }
  }

  if (!user) return null

  const fields: { key: string; label: string; secret: boolean }[] = [
    { key: 'etsy_client_id', label: 'Etsy Client ID', secret: false },
    { key: 'etsy_client_secret', label: 'Etsy Client Secret', secret: true },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Global API Ayarları</h1>
      <p className="mt-1 text-sm text-zinc-600">Pazaryeri entegrasyonları için global API anahtarları</p>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm flex items-center gap-2 ${message.includes('edildi') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.includes('edildi') ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message}
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>
      ) : (
        <div className="mt-6 space-y-4 max-w-xl">
          {fields.map(({ key, label, secret }) => (
            <div key={key} className="rounded-xl border border-zinc-200 bg-white p-4">
              <label className="block text-sm font-semibold text-zinc-900 mb-2">{label}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={secret && !showSecret[key] ? 'password' : 'text'}
                    defaultValue={settings[key] || ''}
                    className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono pr-10"
                    id={`input-${key}`}
                  />
                  {secret && (
                    <button
                      type="button"
                      onClick={() => setShowSecret(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showSecret[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    const input = document.getElementById(`input-${key}`) as HTMLInputElement
                    if (input) saveSetting(key, input.value)
                  }}
                  disabled={saving === key}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 shrink-0"
                >
                  {saving === key ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}