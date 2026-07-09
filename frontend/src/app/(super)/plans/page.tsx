'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Plan } from '@/lib/types'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const MODULE_LABELS: Record<string, string> = {
  ai_product_create: 'AI Ürün Oluşturma',
  ai_image_generate: 'AI Görsel Üretme',
  b2b: 'B2B / Beatby',
  marketplace: 'Pazaryeri Entegrasyonu',
  xml_feed: 'XML Feed',
  variations: 'Varyasyonlar',
  blog: 'Blog',
  custom_domain: 'Özel Domain',
  shipping: 'Kargo Yönetimi',
  static_pages: 'Statik Sayfalar',
}

interface PlanForm {
  name: string
  slug: string
  description: string
  price: string
  currency: string
  ai_credits: string
  product_limit: string
  store_limit: string
  is_active: boolean
  modules: Record<string, { enabled: boolean; credit_cost?: number; limit?: number }>
}

const defaultForm: PlanForm = {
  name: '', slug: '', description: '', price: '0', currency: 'TRY',
  ai_credits: '10', product_limit: '100', store_limit: '1', is_active: true,
  modules: {},
}

export default function SuperPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<PlanForm>(defaultForm)

  useEffect(() => {
    api.getAdminPlans().then(setPlans).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [])

  function openNew() {
    setForm({ ...defaultForm, modules: {} })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(plan: Plan) {
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: String(plan.price),
      currency: plan.currency,
      ai_credits: String(plan.ai_credits),
      product_limit: String(plan.product_limit),
      store_limit: String(plan.store_limit),
      is_active: plan.is_active,
      modules: plan.modules || {},
    })
    setEditingId(plan.id)
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const data: any = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        price: parseFloat(form.price),
        currency: form.currency,
        ai_credits: parseInt(form.ai_credits),
        product_limit: parseInt(form.product_limit),
        store_limit: parseInt(form.store_limit),
        is_active: form.is_active,
        modules: form.modules,
      }
      if (editingId) {
        await api.updateAdminPlan(editingId, data)
        setMessage('Plan güncellendi')
      } else {
        await api.createAdminPlan(data)
        setMessage('Plan oluşturuldu')
      }
      setShowForm(false)
      api.getAdminPlans().then(setPlans)
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Bu planı silmek istediğine emin misin?')) return
    try {
      await api.deleteAdminPlan(id)
      setPlans(prev => prev.filter(p => p.id !== id))
      setMessage('Plan silindi')
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    }
  }

  function toggleModule(key: string) {
    setForm(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: { ...prev.modules[key], enabled: !(prev.modules[key]?.enabled ?? false) },
      },
    }))
  }

  function setModuleCredit(key: string, credit_cost: number) {
    setForm(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [key]: { ...prev.modules[key], enabled: true, credit_cost },
      },
    }))
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planlar</h1>
          <p className="mt-1 text-sm text-zinc-400">Abonelik planlarını ve modül izinlerini yönet.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-zinc-100">
          <Plus className="h-4 w-4" /> Plan Ekle
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-green-400">{message}</div>}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.id} className={`rounded-xl border p-5 ${plan.is_active ? 'border-zinc-700 bg-zinc-900' : 'border-red-900 bg-zinc-900/50 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="text-xs text-zinc-400">{plan.slug}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(plan)} className="p-1 text-zinc-500 hover:text-white"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(plan.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{plan.description}</p>
              <p className="mt-3 text-2xl font-bold text-white">{plan.price.toLocaleString('tr-TR')} <span className="text-sm font-normal text-zinc-400">₺/ay</span></p>
              <div className="mt-3 space-y-1 text-xs text-zinc-400">
                <p>AI Kredisi: {plan.ai_credits === -1 ? 'Sınırsız' : plan.ai_credits.toLocaleString('tr-TR')}</p>
                <p>Ürün Limiti: {plan.product_limit === -1 ? 'Sınırsız' : plan.product_limit.toLocaleString('tr-TR')}</p>
                {plan.modules && Object.entries(plan.modules).filter(([, v]) => v.enabled).map(([k]) => (
                  <p key={k} className="text-green-400">✓ {MODULE_LABELS[k] || k}{'credit_cost' in (plan.modules?.[k] || {}) ? ` (${(plan.modules?.[k] as any)?.credit_cost} kredi)` : ''}</p>
                ))}
              </div>
              {!plan.is_active && <p className="mt-3 text-xs font-medium text-red-400">Pasif</p>}
            </div>
          ))}
          {plans.length === 0 && <div className="col-span-full p-12 text-center text-sm text-zinc-500">Henüz plan bulunmuyor.</div>}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-zinc-900 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">{editingId ? 'Plan Düzenle' : 'Yeni Plan'}</h2>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Plan Adı</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Slug</label>
                  <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400">Açıklama</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Fiyat (₺)</label>
                  <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">AI Kredisi</label>
                  <input type="number" min="0" value={form.ai_credits} onChange={e => setForm({ ...form, ai_credits: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Para Birimi</label>
                  <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Ürün Limiti (-1 = sınırsız)</label>
                  <input type="number" value={form.product_limit} onChange={e => setForm({ ...form, product_limit: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Mağaza Limiti</label>
                  <input type="number" min="1" value={form.store_limit} onChange={e => setForm({ ...form, store_limit: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800" />
                Aktif
              </label>

              {/* Modules */}
              <div>
                <label className="block text-sm font-medium text-zinc-400">Modüller</label>
                <div className="mt-2 space-y-2">
                  {Object.entries(MODULE_LABELS).map(([key, label]) => {
                    const mod = form.modules[key] || { enabled: false }
                    return (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                          <input type="checkbox" checked={mod.enabled} onChange={() => toggleModule(key)}
                            className="rounded border-zinc-600 bg-zinc-800" />
                          {label}
                        </label>
                        {key === 'ai_product_create' || key === 'ai_image_generate' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Kredi:</span>
                            <input type="number" min="0" value={mod.credit_cost ?? 1}
                              onChange={e => setModuleCredit(key, parseInt(e.target.value) || 0)}
                              className="w-16 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs text-white" />
                          </div>
                        ) : key === 'marketplace' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Limit:</span>
                            <input type="number" min="0" value={mod.limit ?? 1}
                              onChange={e => setForm(prev => ({ ...prev, modules: { ...prev.modules, [key]: { ...prev.modules[key], enabled: true, limit: parseInt(e.target.value) || 0 } } }))}
                              className="w-16 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs text-white" />
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-400">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
