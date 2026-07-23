'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Plus, Edit, Trash2, Loader2, X } from 'lucide-react'

type RateLimit = {
  id: number
  providerId: number
  scope: 'per_minute' | 'per_hour' | 'per_day'
  maxRequests: number
  isActive: boolean
  provider?: { id: number; code: string; name: string }
}

type Provider = {
  id: number
  code: string
  name: string
}

const SCOPE_LABELS: Record<string, string> = {
  per_minute: 'Dakikada',
  per_hour: 'Saatte',
  per_day: 'Günde',
}

const SCOPE_OPTIONS = [
  { value: 'per_minute', label: 'Dakikada' },
  { value: 'per_hour', label: 'Saatte' },
  { value: 'per_day', label: 'Günde' },
]

export default function AiRateLimitsPage() {
  const { user } = useAuth()
  const [limits, setLimits] = useState<RateLimit[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RateLimit | null>(null)
  const [form, setForm] = useState({
    providerId: 0,
    scope: 'per_hour' as string,
    maxRequests: 100,
    isActive: true,
  })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [limRes, provRes] = await Promise.all([
        api.getAiRateLimits(),
        api.getAiProviders(),
      ])
      setLimits(limRes.limits || [])
      setProviders((provRes.providers || []).map(p => ({ id: p.id, code: p.code, name: p.name })))
      if (!form.providerId && provRes.providers?.length) {
        setForm(f => ({ ...f, providerId: provRes.providers[0].id }))
      }
    } catch {
      setMessage('Veriler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      providerId: providers[0]?.id || 0,
      scope: 'per_hour',
      maxRequests: 100,
      isActive: true,
    })
    setEditing(null)
    setShowForm(false)
  }

  function startEdit(l: RateLimit) {
    setForm({
      providerId: l.providerId,
      scope: l.scope,
      maxRequests: l.maxRequests,
      isActive: l.isActive,
    })
    setEditing(l)
    setShowForm(true)
  }

  async function save() {
    if (!form.providerId || !form.scope) {
      setMessage('Provider ve scope zorunlu')
      return
    }
    setSaving(editing?.id || -1)
    try {
      if (editing) {
        await api.updateAiRateLimit(editing.id, { maxRequests: form.maxRequests, isActive: form.isActive })
        setMessage('Rate limit güncellendi')
      } else {
        await api.createAiRateLimit(form)
        setMessage('Rate limit oluşturuldu')
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
    if (!confirm('Bu rate limit kuralını silmek istediğinizden emin misiniz?')) return
    try {
      await api.deleteAiRateLimit(id)
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
          <h1 className="text-2xl font-bold text-zinc-900">AI Rate Limits</h1>
          <p className="mt-1 text-sm text-zinc-600">Sağlayıcı bazında API istek limitlerini yönet</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          Yeni Limit
        </button>
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
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Sağlayıcı</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kapsam</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Max İstek</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 w-36">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {limits.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-4 text-sm text-zinc-900">{l.provider?.name || l.provider?.code || `ID: ${l.providerId}`}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-medium text-zinc-700">
                      {SCOPE_LABELS[l.scope] || l.scope}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-900">{l.maxRequests.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-50 text-zinc-600'
                    }`}>
                      {l.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(l)}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                        title="Düzenle"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(l.id)}
                        disabled={saving === l.id}
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
          {limits.length === 0 && (
            <div className="p-12 text-center text-zinc-500">
              Henüz rate limit tanımlanmamış.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={resetForm}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-zinc-900">{editing ? 'Rate Limit Düzenle' : 'Yeni Rate Limit'}</h2>
              <button onClick={resetForm} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Sağlayıcı <span className="text-red-500">*</span></label>
                <select
                  value={form.providerId}
                  onChange={e => setForm({...form, providerId: Number(e.target.value)})}
                  disabled={!!editing}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50"
                >
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Kapsam <span className="text-red-500">*</span></label>
                <select
                  value={form.scope}
                  onChange={e => setForm({...form, scope: e.target.value})}
                  disabled={!!editing}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50"
                >
                  {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Maksimum İstek <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.maxRequests}
                  onChange={e => setForm({...form, maxRequests: Number(e.target.value)})}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-2">
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