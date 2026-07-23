'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Plus, Edit, Trash2, Settings, Database, Brain, Image, Zap, Save, X, Eye, EyeOff, Loader2 } from 'lucide-react'

type Provider = {
  id: number
  code: string
  name: string
  type: string
  baseUrl?: string
  authConfig?: any
  isActive: boolean
  isDefault: boolean
}

type Model = {
  id: number
  providerId: number
  modelCode: string
  displayName: string
  capability?: string
  parameters?: any
  isActive: boolean
  provider?: { id: number; code: string; name: string }
}

export default function AiProvidersPage() {
  const { user } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [providerForm, setProviderForm] = useState({
    code: '',
    name: '',
    type: 'llm',
    baseUrl: '',
    authType: 'api-key' as 'bearer' | 'api-key' | 'basic' | 'none',
    apiKey: '',
    headerName: '',
    authConfig: {} as Record<string, string>,
    isActive: true,
    isDefault: false,
  })
  const [showModelForm, setShowModelForm] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [modelForm, setModelForm] = useState({
    providerId: 0,
    modelCode: '',
    displayName: '',
    capability: 'chat',
    parameters: {},
    isActive: true,
  })

  const typeLabels: Record<string, string> = {
    llm: 'LLM (Chat/Text)',
    vision: 'Vision (Görsel)',
    embedding: 'Embedding',
    image: 'Image Generation',
    diffusion: 'Diffusion',
  }
  const [showApiKey, setShowApiKey] = useState(false)

  const typeIcons: Record<string, React.ReactNode> = {
    llm: <Brain className="h-4 w-4" />,
    vision: <Image className="h-4 w-4" />,
    embedding: <Database className="h-4 w-4" />,
    image: <Image className="h-4 w-4" />,
    diffusion: <Zap className="h-4 w-4" />,
  }

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [provRes, modRes] = await Promise.all([
        api.getAiProviders(),
        api.getAiModels(),
      ])
      setProviders(provRes.providers || [])
      setModels(modRes.models || [])
    } catch {
      setMessage('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function resetProviderForm() {
    setProviderForm({
      code: '',
      name: '',
      type: 'llm',
      baseUrl: '',
      authType: 'api-key',
      apiKey: '',
      headerName: '',
      authConfig: {},
      isActive: true,
      isDefault: false,
    })
    setEditingProvider(null)
    setShowProviderForm(false)
  }

  function resetModelForm() {
    setModelForm({
      providerId: providers[0]?.id || 0,
      modelCode: '',
      displayName: '',
      capability: 'chat',
      parameters: {},
      isActive: true,
    })
    setEditingModel(null)
    setShowModelForm(false)
  }

  async function saveProvider() {
    if (!providerForm.code || !providerForm.name) {
      setMessage('Kod ve isim zorunlu')
      return
    }
    const authConfig: Record<string, string> = {}
    if (providerForm.apiKey) {
      authConfig.apiKey = providerForm.apiKey
      authConfig.authType = providerForm.authType === 'api-key' ? 'header' : providerForm.authType
      if (providerForm.authType === 'api-key' && providerForm.headerName) {
        authConfig.headerName = providerForm.headerName
      }
    }
    const payload: any = {
      code: providerForm.code,
      name: providerForm.name,
      type: providerForm.type,
      baseUrl: providerForm.baseUrl || '',
      isActive: providerForm.isActive,
      isDefault: providerForm.isDefault,
    }
    if (Object.keys(authConfig).length > 0) {
      payload.authConfig = authConfig
    }
    setSaving(editingProvider?.id || -1)
    try {
      if (editingProvider) {
        await api.updateAiProvider(editingProvider.id, payload)
        setMessage('Sağlayıcı güncellendi')
      } else {
        await api.createAiProvider(payload)
        setMessage('Sağlayıcı oluşturuldu')
      }
      resetProviderForm()
      load()
    } catch (e: any) {
      setMessage(e.message || 'Kaydetme başarısız')
    } finally {
      setSaving(null)
    }
  }

  async function deleteProvider(id: number) {
    if (!confirm('Bu sağlayıcıyı silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteAiProvider(id)
      setMessage('Silindi')
      load()
    } catch {
      setMessage('Silme başarısız')
    }
  }

  async function saveModel() {
    if (!modelForm.modelCode || !modelForm.displayName) {
      setMessage('Model kodu ve görünen isim zorunlu')
      return
    }
    setSaving(editingModel?.id || -1)
    try {
      if (editingModel) {
        await api.updateAiModel(editingModel.id, modelForm)
        setMessage('Model güncellendi')
      } else {
        await api.createAiModel(modelForm)
        setMessage('Model oluşturuldu')
      }
      resetModelForm()
      load()
    } catch (e: any) {
      setMessage(e.message || 'Kaydetme başarısız')
    } finally {
      setSaving(null)
    }
  }

  async function deleteModel(id: number) {
    if (!confirm('Bu modeli silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteAiModel(id)
      setMessage('Silindi')
      load()
    } catch {
      setMessage('Silme başarısız')
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">AI Sağlayıcıları</h1>
          <p className="mt-1 text-sm text-zinc-600">LLM, Vision, Embedding, Image ve Diffusion sağlayıcılarını yönetin</p>
        </div>
        <button
          onClick={() => { resetProviderForm(); setShowProviderForm(true); }}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" /> Sağlayıcı Ekle
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}

      {!loading && (
        <div className="space-y-6">
          {providers.map((provider) => {
            const providerModels = models.filter(m => m.providerId === provider.id)
            return (
              <div key={provider.id} className="rounded-xl border border-zinc-200 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      {typeIcons[provider.type] || <Brain className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900">{provider.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-zinc-500">
                        <span className="font-mono">{provider.code}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                          {typeLabels[provider.type] || provider.type}
                        </span>
                        {provider.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Varsayılan</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          provider.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-50 text-zinc-600'
                        }`}>
                          {provider.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                        {provider.authConfig?.apiKey ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Anahtar Var
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Anahtar Yok
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const cfg = provider.authConfig || {};
                        setEditingProvider(provider);
                        setProviderForm({
                          code: provider.code,
                          name: provider.name,
                          type: provider.type,
                          baseUrl: provider.baseUrl || '',
                          authType: cfg.authType === 'bearer' ? 'bearer' : 'api-key',
                          apiKey: '',
                          headerName: cfg.headerName || '',
                          authConfig: cfg,
                          isActive: provider.isActive,
                          isDefault: provider.isDefault,
                        });
                        setShowProviderForm(true);
                      }}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                      title="Düzenle"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteProvider(provider.id)}
                      disabled={saving === provider.id}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {providerModels.length > 0 && (
                  <div className="p-6 border-b border-zinc-100">
                    <h4 className="mb-4 text-sm font-semibold text-zinc-700">Modeller ({providerModels.length})</h4>
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => { resetModelForm(); setModelForm(prev => ({...prev, providerId: provider.id})); setShowModelForm(true); }}
                        className="text-xs rounded-lg bg-zinc-100 px-3 py-1.5 text-zinc-700 hover:bg-zinc-200"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Model Ekle
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-zinc-500">
                            <th className="pb-2">Model Kodu</th>
                            <th className="pb-2">Görünen İsim</th>
                            <th className="pb-2">Yetenek</th>
                            <th className="pb-2">Parametreler</th>
                            <th className="pb-2">Durum</th>
                            <th className="pb-2 w-20">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {providerModels.map((model) => (
                            <tr key={model.id} className="hover:bg-zinc-50">
                              <td className="py-3 font-mono text-zinc-900">{model.modelCode}</td>
                              <td className="py-3 text-zinc-900">{model.displayName}</td>
                              <td className="py-3">
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700">
                                  {model.capability || '—'}
                                </span>
                              </td>
                              <td className="py-3 text-zinc-500 font-mono text-xs">
                                {model.parameters ? JSON.stringify(model.parameters).substring(0, 40) + (JSON.stringify(model.parameters).length > 40 ? '...' : '') : '—'}
                              </td>
                              <td className="py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  model.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-50 text-zinc-600'
                                }`}>
                                  {model.isActive ? 'Aktif' : 'Pasif'}
                                </span>
                              </td>
                              <td className="py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setEditingModel(model); setModelForm({...model, capability: model.capability || 'chat', parameters: model.parameters || {}}); setShowModelForm(true); }}
                                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                                  >
                                    <Edit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteModel(model.id)}
                                    disabled={saving === model.id}
                                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {providerModels.length === 0 && (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    Henüz model eklenmemiş.
                    <button
                      onClick={() => { resetModelForm(); setModelForm(prev => ({...prev, providerId: provider.id})); setShowModelForm(true); }}
                      className="ml-2 text-indigo-600 hover:underline"
                    >
                      İlk modeli ekle
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {providers.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              Henüz AI sağlayıcısı yok. "Sağlayıcı Ekle" butonuyla başlayın.
            </div>
          )}
        </div>
      )}

      {/* Provider Form Modal */}
      {showProviderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetProviderForm}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-zinc-900">{editingProvider ? 'Sağlayıcıyı Düzenle' : 'Yeni Sağlayıcı'}</h2>
              <button onClick={resetProviderForm} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kod <span className="text-red-500">*</span></label>
                  <input
                    value={providerForm.code}
                    onChange={e => setProviderForm({...providerForm, code: e.target.value.toLowerCase()})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="openrouter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">İsim <span className="text-red-500">*</span></label>
                  <input
                    value={providerForm.name}
                    onChange={e => setProviderForm({...providerForm, name: e.target.value})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="OpenRouter"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tür <span className="text-red-500">*</span></label>
                <select
                  value={providerForm.type}
                  onChange={e => setProviderForm({...providerForm, type: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="llm">LLM (Chat/Text)</option>
                  <option value="vision">Vision (Görsel Analiz)</option>
                  <option value="embedding">Embedding</option>
                  <option value="image">Image Generation</option>
                  <option value="diffusion">Diffusion</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Base URL (Opsiyonel)</label>
                <input
                  value={providerForm.baseUrl}
                  onChange={e => setProviderForm({...providerForm, baseUrl: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">API Key <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={providerForm.apiKey}
                    onChange={e => setProviderForm({...providerForm, apiKey: e.target.value})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-10 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={editingProvider ? '••••••••••••••••' : 'sk-or-v1-...'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Auth Türü</label>
                  <select
                    value={providerForm.authType}
                    onChange={e => setProviderForm({...providerForm, authType: e.target.value as any})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="bearer">Bearer Token</option>
                    <option value="api-key">API Key (Header)</option>
                    <option value="basic">Basic Auth</option>
                    <option value="none">Auth Yok</option>
                  </select>
                </div>
                {providerForm.authType === 'api-key' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Header Adı</label>
                    <input
                      value={providerForm.headerName}
                      onChange={e => setProviderForm({...providerForm, headerName: e.target.value})}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="X-API-Key"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={providerForm.isActive}
                    onChange={e => setProviderForm({...providerForm, isActive: e.target.checked})}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-700">Aktif</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={providerForm.isDefault}
                    onChange={e => setProviderForm({...providerForm, isDefault: e.target.checked})}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-700">Bu tür için varsayılan olsun</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button onClick={resetProviderForm} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  İptal
                </button>
                <button
                  onClick={saveProvider}
                  disabled={saving !== null}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingProvider ? 'Güncelle' : 'Oluştur')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Form Modal */}
      {showModelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetModelForm}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-zinc-900">{editingModel ? 'Modeli Düzenle' : 'Yeni Model'}</h2>
              <button onClick={resetModelForm} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Sağlayıcı <span className="text-red-500">*</span></label>
                <select
                  value={modelForm.providerId}
                  onChange={e => setModelForm({...modelForm, providerId: Number(e.target.value)})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Model Kodu <span className="text-red-500">*</span></label>
                  <input
                    value={modelForm.modelCode}
                    onChange={e => setModelForm({...modelForm, modelCode: e.target.value})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="gpt-4o"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Görünen İsim <span className="text-red-500">*</span></label>
                  <input
                    value={modelForm.displayName}
                    onChange={e => setModelForm({...modelForm, displayName: e.target.value})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="GPT-4o"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Yetenek</label>
                <select
                  value={modelForm.capability}
                  onChange={e => setModelForm({...modelForm, capability: e.target.value})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="chat">Chat</option>
                  <option value="vision">Vision</option>
                  <option value="embedding">Embedding</option>
                  <option value="image">Image Generation</option>
                  <option value="diffusion">Diffusion</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Parametreler (JSON)</label>
                <textarea
                  value={JSON.stringify(modelForm.parameters || {}, null, 2)}
                  onChange={e => {
                    try {
                      setModelForm({...modelForm, parameters: JSON.parse(e.target.value)})
                    } catch {}
                  }}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder='{"temperature": 0.7, "max_tokens": 2000}'
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={modelForm.isActive}
                    onChange={e => setModelForm({...modelForm, isActive: e.target.checked})}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-zinc-700">Aktif</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button onClick={resetModelForm} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  İptal
                </button>
                <button
                  onClick={saveModel}
                  disabled={saving !== null}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editingModel ? 'Güncelle' : 'Oluştur')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}