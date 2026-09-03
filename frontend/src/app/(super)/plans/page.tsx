'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { Plan } from '@/lib/types'
import { SCENARIO_CODES } from '@/lib/ai-hub'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const MODULE_LABELS: Record<string, string> = {
  ai_product_create: 'AI Ürün Oluşturma',
  ai_image_generate: 'AI Görsel Üretme',
  b2b_request: 'B2B Talep Etme (Ürün İsteme)',
  b2b_supply: 'B2B Tedarik Etme (Ürün Gönderme)',
  b2b: 'B2B / Beatby (Eski)',
  marketplace: 'Pazaryeri Entegrasyonu',
  xml_feed: 'XML Feed',
  variations: 'Varyasyonlar',
  blog: 'Blog',
  blog_generation: 'AI Blog Üretimi',
  custom_domain: 'Özel Domain',
  shipping: 'Kargo Yönetimi',
  static_pages: 'Statik Sayfalar',
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  ai_product_create: 'AI ile ürün açıklaması ve görsel analizi',
  ai_image_generate: 'AI ile görsel düzenleme/üretme',
  b2b_request: 'Diğer satıcıların B2B’ye açtığı ürünleri keşfet, talep et ve klonla',
  b2b_supply: 'Kendi ürünlerini B2B’ye açma — tedarikçi başvurusu onaylı olmalı',
  b2b: 'Eski birleşik B2B anahtarı (geriye dönük uyumluluk)',
  marketplace: 'Dış pazaryerleri (Trendyol, N11, HB, Pazarama, Amazon, Etsy). Kendi Siteniz bu limite dahil DEĞİLDİR.',
  xml_feed: 'Harici feed ile toplu ürün içe aktarma',
  variations: 'Ürün varyantları',
  blog: 'Blog modülü',
  blog_generation: 'AI ile blog yazısı üretme',
  custom_domain: 'Özel domain bağlama',
  shipping: 'Kargo yönetimi',
  static_pages: 'Statik sayfalar',
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
  hosting: 'rahatio' | 'vercel' | 'custom'
  is_active: boolean
  modules: Record<string, { enabled: boolean; credit_cost?: number; limit?: number }>
  ai_scenario_models: Record<string, number>
}

const HOSTING_LABELS: Record<string, string> = {
  rahatio: 'Rahatio (rahatio.com.tr/stores/{kod})',
  vercel: 'Vercel (Slave)',
  custom: 'Kendi Sunucu',
}

const defaultForm: PlanForm = {
  name: '', slug: '', description: '', price: '0', currency: 'TRY',
  ai_credits: '10', product_limit: '100', store_limit: '1', hosting: 'rahatio', is_active: true,
  modules: {},
  ai_scenario_models: {},
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
  const [models, setModels] = useState<{ id: number; modelId: string; displayName: string; tier?: string; isActive?: boolean; provider?: { code: string; name: string } }[]>([])

  useEffect(() => {
    api.getAdminPlans().then(setPlans).catch(err => setError(err.message)).finally(() => setLoading(false))
    api.getAiModels().then(r => setModels(r.models || [])).catch(() => {})
  }, [])

  function openNew() {
    setForm({ ...defaultForm, modules: {}, ai_scenario_models: {} })
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
      hosting: (plan.hosting ?? 'rahatio') as PlanForm['hosting'],
      is_active: plan.is_active,
      modules: plan.modules || {},
      ai_scenario_models: plan.ai_scenario_models || {},
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
        price: parseFloat(form.price),
        product_limit: Math.round(parseInt(form.product_limit || '0')),
        store_limit: Math.round(parseInt(form.store_limit || '1')),
        ai_credits: Math.round(parseInt(form.ai_credits || '0')),
        is_active: form.is_active,
        hosting: form.hosting,
        modules: form.modules,
        ai_scenario_models: form.ai_scenario_models,
      }
      if (form.slug) data.slug = form.slug
      if (form.description) data.description = form.description
      if (form.currency) data.currency = form.currency
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
    setForm(prev => {
      const currently = prev.modules[key]?.enabled ?? false
      const nextEnabled = !currently
      const patch: Record<string, any> = { enabled: nextEnabled }
      // Marketplace varsayılan limit 1 olmalı, yoksa sınırsız gibi davranır
      if (nextEnabled && key === 'marketplace' && prev.modules[key]?.limit == null) patch.limit = 1
      // AI credit cost default
      if (nextEnabled && ['ai_product_create','ai_image_generate','blog_generation'].includes(key) && prev.modules[key]?.credit_cost == null) patch.credit_cost = 1
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [key]: { ...prev.modules[key], ...patch },
        },
      }
    })
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
              <p className="mt-3 text-2xl font-bold text-white">{(plan.price ?? 0).toLocaleString('tr-TR')} <span className="text-sm font-normal text-zinc-400">₺/ay</span></p>
              <div className="mt-3 space-y-1 text-xs text-zinc-400">
                <p>Yayınlama: <span className="text-zinc-300">{HOSTING_LABELS[plan.hosting] ?? plan.hosting}</span></p>
                <p>AI Kredisi: {(plan.ai_credits ?? 0).toLocaleString('tr-TR')}</p>
                <p>Ürün Limiti: {(plan.product_limit ?? 0).toLocaleString('tr-TR')} · Mağaza Limiti: {(plan.store_limit ?? 1).toLocaleString('tr-TR')}</p>
                {plan.modules && Object.entries(plan.modules).filter(([, v]) => v.enabled).map(([k]) => (
                  <p key={k} className="text-green-400">✓ {MODULE_LABELS[k] || k}{'credit_cost' in (plan.modules?.[k] || {}) ? ` (${(plan.modules?.[k] as any)?.credit_cost} kredi)` : ''}</p>
                ))}
                {plan.ai_scenario_models && Object.keys(plan.ai_scenario_models).length > 0 && (
                  <p className="text-amber-400">AI model override: {Object.keys(plan.ai_scenario_models).length} senaryo</p>
                )}
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
                  <label className="block text-xs font-medium text-zinc-400">Ürün Limiti</label>
                  <input type="number" min="0" value={form.product_limit} onChange={e => setForm({ ...form, product_limit: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  <p className="mt-1 text-xs text-zinc-500">Bu planla kaç ürün oluşturulabilir.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400">Mağaza Limiti</label>
                  <input type="number" min="1" value={form.store_limit} onChange={e => setForm({ ...form, store_limit: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
                  <p className="mt-1 text-xs text-zinc-500">Aynı hesapla kaç mağaza açılabilir (multi-store, şu an tek mağaza aktif; ileride geçerli).</p>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-zinc-600 bg-zinc-800" />
                Aktif
              </label>

              {/* Hosting */}
              <div>
                <label className="block text-sm font-medium text-zinc-400">Site Yayınlama</label>
                <select
                  value={form.hosting}
                  onChange={e => setForm({ ...form, hosting: e.target.value as PlanForm['hosting'] })}
                  className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="rahatio">Rahatio (rahatio.com.tr/stores/{'{kod}'})</option>
                  <option value="vercel">Vercel (Slave)</option>
                  <option value="custom">Kendi Sunucu</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">Rahatio hosting'de mağaza siteniz otomatik olarak bu domain altında yayınlanır.</p>
              </div>

              {/* AI Scenario Models */}
              <div>
                <label className="block text-sm font-medium text-zinc-400">AI Modelleri (senaryo başına)</label>
                <p className="mt-1 text-xs text-zinc-500">Seçilen senaryolar için bu planın mağazalarında kullanılacak model. "Varsayılan" bırakılırsa senaryonun kendi modeli / global default geçerli olur.</p>
                <div className="mt-2 space-y-2">
                  {SCENARIO_CODES.map(sc => {
                    const selected = form.ai_scenario_models[sc.code] || 0
                    return (
                      <div key={sc.code} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-300">{sc.name}</p>
                          <p className="truncate text-xs text-zinc-500">{sc.code}</p>
                        </div>
                        <select
                          value={selected}
                          onChange={e => setForm(prev => {
                            const ai_scenario_models = { ...prev.ai_scenario_models }
                            const v = Number(e.target.value)
                            if (v) ai_scenario_models[sc.code] = v
                            else delete ai_scenario_models[sc.code]
                            return { ...prev, ai_scenario_models }
                          })}
                          className="w-56 rounded-lg border border-zinc-600 bg-zinc-700 px-2 py-1.5 text-xs text-white"
                        >
                          <option value={0}>— Senaryo varsayılanı —</option>
                          {models.filter(m => m.isActive).map(m => (
                            <option key={m.id} value={m.id}>{m.displayName} ({m.modelId}){m.tier === 'free' ? ' · Free' : ''}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Modules */}
              <div>
                <label className="block text-sm font-medium text-zinc-400">Modüller</label>
                <p className="mt-1 text-xs text-zinc-500">Mağaza Limiti = kaç mağaza açılabilir. Pazaryeri Limiti = kaç dış pazaryeri entegrasyonu bağlanabilir (Kendi Siteniz dahil değil).</p>
                <div className="mt-2 space-y-2">
                  {Object.entries(MODULE_LABELS).filter(([k]) => k !== 'b2b').map(([key, label]) => {
                    const mod = form.modules[key] || { enabled: false }
                    const isLegacy = key === 'b2b'
                    return (
                      <div key={key} className={`flex flex-col gap-1 rounded-lg border px-3 py-2 ${isLegacy ? 'border-amber-800 bg-amber-950/30' : 'border-zinc-700 bg-zinc-800'}`}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <input type="checkbox" checked={mod.enabled} onChange={() => toggleModule(key)}
                              className="rounded border-zinc-600 bg-zinc-800" />
                            {label}
                          </label>
                          {key === 'ai_product_create' || key === 'ai_image_generate' || key === 'blog_generation' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">Kredi:</span>
                              <input type="number" min="0" value={mod.credit_cost ?? 1}
                                onChange={e => setModuleCredit(key, parseInt(e.target.value) || 0)}
                                className="w-16 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs text-white" />
                            </div>
                          ) : key === 'marketplace' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-zinc-500">Limit:</span>
                              <input type="number" min="1" value={mod.limit ?? 1}
                                onChange={e => setForm(prev => ({ ...prev, modules: { ...prev.modules, [key]: { ...prev.modules[key], enabled: true, limit: Math.max(1, parseInt(e.target.value) || 1) } } }))}
                                className="w-16 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-xs text-white" />
                            </div>
                          ) : null}
                        </div>
                        {MODULE_DESCRIPTIONS[key] && <p className="ml-6 text-xs text-zinc-500">{MODULE_DESCRIPTIONS[key]}</p>}
                        {key === 'b2b_supply' && mod.enabled && <p className="ml-6 text-xs text-amber-400">Not: Ürün gönderebilmek için tedarikçi başvurusunun onaylı olması gerekir.</p>}
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
