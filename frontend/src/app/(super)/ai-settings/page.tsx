'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Save, Loader2, Cpu, KeyIcon, Check, Eye, EyeOff } from 'lucide-react'

type Provider = { id: number; code: string; name: string; type: string; baseUrl?: string }
type ModelItem = { id: number; providerId: number; modelId: string; displayName: string; modality?: string }

const KEY_PROVIDERS = [
  { code: 'openai', label: 'OpenAI' },
  { code: 'openrouter', label: 'OpenRouter' },
  { code: 'nvidia', label: 'NVIDIA' },
  { code: 'deepseek', label: 'DeepSeek' },
  { code: 'mistral', label: 'Mistral' },
  { code: 'google', label: 'Google Gemini' },
]

export default function AiSettingsPage() {
  const { user } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<ModelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [defaultProviderId, setDefaultProviderId] = useState<number | null>(null)
  const [defaultModelId, setDefaultModelId] = useState<number | null>(null)
  const [keys, setKeys] = useState<Record<string, boolean>>({})
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [prov, modelsRes, settings] = await Promise.all([
        api.getAiProviders(),
        api.getAiModels(),
        api.getAiSettings(),
      ])
      setProviders(prov.providers)
      setModels(modelsRes.models)
      setDefaultProviderId(settings.defaultProviderId ? Number(settings.defaultProviderId) : null)
      setDefaultModelId(settings.defaultModelId ? Number(settings.defaultModelId) : null)
      setKeys(settings.keys)
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Ayarlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const filteredModels = defaultProviderId
    ? models.filter(m => Number(m.providerId) === Number(defaultProviderId))
    : []

  async function handleSave() {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      // send non-empty inputs; empty input on an already-set key clears it
      const keysToSend: Record<string, string> = {}
      for (const { code } of KEY_PROVIDERS) {
        if (keyInputs[code]) {
          keysToSend[code] = keyInputs[code].trim()
        } else if (keys[code] && keyInputs[code] === '') {
          keysToSend[code] = ''
        }
      }
      await api.updateAiSettings({
        defaultProviderId,
        defaultModelId,
        keys: keysToSend,
      })
      const settings = await api.getAiSettings()
      setKeys(settings.keys)
      setKeyInputs({})
      setMessage('Ayarlar kaydedildi.')
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Kaydetme başarısız')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-40 items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3">
        <Cpu className="h-6 w-6 text-violet-400" />
        <h1 className="text-2xl font-bold text-white">Global AI Ayarları</h1>
      </div>
      <p className="mt-1 text-sm text-zinc-400">Senaryoya sağlayıcı atanmamışsa kullanılacak varsayılan model ve sağlayıcı API anahtarları.</p>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}
      {message && <div className="mt-4 rounded-lg bg-green-900/50 p-3 text-sm text-green-400">{message}</div>}

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-white">Varsayılan Model</h2>
        <p className="mt-1 text-sm text-zinc-400">Senaryo veya per-mağaza override yokken AI istekleri bu provider/model üzerinden çalışır. Hiç seçilmezse ai-service kendi Ollama varsayılanını kullanır.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-400">Sağlayıcı</label>
            <select value={defaultProviderId ?? ''} onChange={e => { setDefaultProviderId(e.target.value ? Number(e.target.value) : null); setDefaultModelId(null) }}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white">
              <option value="">— Seçilmedi (Ollama) —</option>
              {providers.filter(p => p.type === 'llm' || p.type === 'vision').map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Model</label>
            <select value={defaultModelId ?? ''} onChange={e => setDefaultModelId(e.target.value ? Number(e.target.value) : null)}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" disabled={!defaultProviderId}>
              <option value="">— Seçilmedi —</option>
              {filteredModels.map(m => (
                <option key={m.id} value={m.id}>{m.displayName} ({m.modelId})</option>
              ))}
            </select>
            {defaultProviderId && filteredModels.length === 0 && (
              <p className="mt-1 text-xs text-amber-400">Bu sağlayıcıda model yok. Önce AI Sağlayıcılar sayfasında ekleyin.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <KeyIcon className="h-5 w-5 text-violet-400" />
          <h2 className="text-lg font-semibold text-white">Sağlayıcı API Anahtarları</h2>
        </div>
        <p className="mt-1 text-sm text-zinc-400">Anahtarlar yalnızca super admin panelinde gösterilir ve şifrelenmeden sunucuda saklanır. Kayıtlı anahtar maskeyle görünür; üzerine yazarak değiştirebilir, boş bırakıp kaydederek silebilirsiniz.</p>

        <div className="mt-4 space-y-3">
          {KEY_PROVIDERS.map(p => (
            <div key={p.code} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-sm font-medium text-zinc-300">{p.label}</div>
              <div className="relative flex-1">
                <input
                  type={showKeys[p.code] ? 'text' : 'password'}
                  value={keys[p.code] && keyInputs[p.code] === undefined ? '••••••••' : (keyInputs[p.code] ?? '')}
                  onChange={e => setKeyInputs({ ...keyInputs, [p.code]: e.target.value })}
                  disabled={!keys[p.code] || keyInputs[p.code] !== undefined ? false : false}
                  placeholder={keys[p.code] ? 'Anahtar kayıtlı' : 'API anahtarı girin'}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
              </div>
              <span className={`w-16 shrink-0 text-right text-xs ${keys[p.code] ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {keys[p.code] ? 'kayıtlı' : '—'}
              </span>
              <button type="button" onClick={() => setShowKeys({ ...showKeys, [p.code]: !showKeys[p.code] })}
                className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 hover:text-white">
                {showKeys[p.code] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}