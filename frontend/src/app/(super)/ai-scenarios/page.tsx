'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Plus, Edit, Trash2, Loader2, X } from 'lucide-react'

type Scenario = {
  id: number
  code: string
  name: string
  description?: string
  modelId?: number
  parameters?: any
  costCredits: number
  isActive: boolean
  model?: { id: number; modelCode: string; displayName: string; provider?: { code: string; name: string } }
}

type Model = {
  id: number
  modelCode: string
  displayName: string
  provider?: { code: string; name: string }
}

const SCENARIO_CODES = [
  { code: 'analyze_product', name: 'Ürün Analizi', desc: 'Görselden kategori/özellik çıkarma' },
  { code: 'generate_description', name: 'Açıklama Üretimi', desc: 'Başlık+özelliklerden SEO açıklama' },
  { code: 'chat', name: 'Sohbet/Chat', desc: 'Müşteri destek asistanı' },
  { code: 'search', name: 'Semantik Arama', desc: 'Ürünler arası anlam bazlı arama' },
  { code: 'recommend', name: 'Öneri Sistemi', desc: 'Cross-sell / Up-sell önerileri' },
] as const

export default function AiScenariosPage() {
  const { user } = useAuth()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Scenario | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    modelId: 0,
    parameters: {},
    costCredits: 1,
    isActive: true,
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [scRes, modRes] = await Promise.all([
        api.getAiScenarios(),
        api.getAiModels(),
      ])
      setScenarios(scRes.scenarios || [])
      setModels((modRes.models || []).filter(m => m.isActive).map(m => ({
        id: m.id,
        modelCode: m.modelCode,
        displayName: m.displayName,
        provider: m.provider,
      })))
    } catch {
      setMessage('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      code: '',
      name: '',
      description: '',
      modelId: models[0]?.id || 0,
      parameters: {},
      costCredits: 1,
      isActive: true,
    })
    setEditing(null)
    setShowForm(false)
  }

  function startNew(code: string) {
    const def = SCENARIO_CODES.find(s => s.code === code)
    if (def) {
      setForm({
        code: def.code,
        name: def.name,
        description: def.desc,
        modelId: models[0]?.id || 0,
        parameters: { temperature: 0.7, max_tokens: 2000 },
        costCredits: code === 'chat' ? 1 : 3,
        isActive: true,
      })
      setEditing(null)
      setShowForm(true)
    }
  }

  function startEdit(s: Scenario) {
    setForm({
      code: s.code,
      name: s.name,
      description: s.description || '',
      modelId: s.modelId || models[0]?.id || 0,
      parameters: s.parameters || {},
      costCredits: s.costCredits,
      isActive: s.isActive,
    })
    setEditing(s)
    setShowForm(true)
  }

  async function save() {
    if (!form.code || !form.name) {
      setMessage('Kod ve isim zorunlu')
      return
    }
    setSaving(editing?.id || -1)
    try {
      if (editing) {
        await api.updateAiScenario(editing.id, form)
        setMessage('Senaryo güncellendi')
      } else {
        await api.createAiScenario(form)
        setMessage('Senaryo oluşturuldu')
      }
      resetForm()
      load()
    } catch (e: any) {
      setMessage(e.message || 'Kaydetme başarısız')
    } finally {
      setSaving(null)
    }
  }

  async function del(id: number) {
    if (!confirm('Bu senaryoyu silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteAiScenario(id)
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
          <h1 className="text-2xl font-bold text-zinc-900">AI Senaryoları</h1>
          <p className="mt-1 text-sm text-zinc-600">Her kullanım senaryosu için model, parametreler ve kredi maliyeti tanımla</p>
        </div>
        <div className="flex gap-2">
          {SCENARIO_CODES.map(s => (
            <button
              key={s.code}
              onClick={() => startNew(s.code)}
              className="flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">İsim</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Açıklama</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Parametreler</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kredi</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-36">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {scenarios.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 font-mono text-sm text-zinc-900">{s.code}</td>
                  <td className="px-6 py-4 font-medium text-sm text-zinc-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-zinc-500 max-w-xs truncate">{s.description || '—'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700">
                    {s.model ? (
                      <span className="font-mono">{s.model.displayName} ({s.model.provider?.code || '—'})</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500 font-mono max-w-xs truncate">
                    {s.parameters ? JSON.stringify(s.parameters).substring(0, 50) + (JSON.stringify(s.parameters).length > 50 ? '...' : '') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-900">{s.costCredits}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-50 text-zinc-600'
                    }`}>
                      {s.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                        title="Düzenle"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(s.id)}
                        disabled={saving === s.id}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scenarios.length === 0 && (
            <div className="p-12 text-center text-zinc-500">
              Henüz senaryo tanımlanmamış. Yukarıdaki butonlardan birini seçerek başlayın.
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b border-zinc-100">
              <h2 className="text-xl font-semibold text-zinc-900">{editing ? 'Senaryoyu Düzenle' : 'Yeni Senaryo'}</h2>
              <button onClick={resetForm} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Kod <span className="text-red-500">*</span></label>
                  <input
                    value={form.code}
                    onChange={e => setForm({...form, code: e.target.value.toLowerCase()})}
                    disabled={!!editing}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50"
                    placeholder="analyze_product"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">İsim <span className="text-red-500">*</span></label>
                  <input
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ürün Analizi"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Bu senaryo ne işe yarar?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Model <span className="text-red-500">*</span></label>
                <select
                  value={form.modelId}
                  onChange={e => setForm({...form, modelId: Number(e.target.value)})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {models.map(m => <option key={m.id} value={m.id}>{m.displayName} ({m.modelCode}) — {m.provider?.name || '—'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Parametreler (JSON)</label>
                <textarea
                  value={JSON.stringify(form.parameters || {}, null, 2)}
                  onChange={e => {
                    try { setForm({...form, parameters: JSON.parse(e.target.value)}) } catch {}
                  }}
                  rows={5}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder='{"temperature": 0.7, "max_tokens": 2000, "top_p": 0.9}'
                />
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Maliyet (Kredi)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.costCredits}
                    onChange={e => setForm({...form, costCredits: Number(e.target.value)})}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={e => setForm({...form, isActive: e.target.checked})}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-zinc-700">Aktif</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button onClick={resetForm} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  İptal
                </button>
                <button
                  onClick={save}
                  disabled={saving !== null}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : (editing ? 'Güncelle' : 'Oluştur')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}