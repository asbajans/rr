'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Mail, MessageSquare, Save, RotateCcw } from 'lucide-react'

type Template = {
  id: number | null; channel: string; type: string; subject: string; body: string; isActive: boolean; isCustom: boolean
}

const TYPE_LABELS: Record<string, string> = {
  order_created: 'Sipariş Oluşturuldu',
  status_change: 'Durum Değişikliği',
  shipping_update: 'Kargo Güncellemesi',
  custom: 'Özel',
}

const VARIABLES_HELP: Record<string, string[]> = {
  order_created: ['{{orderNumber}}', '{{customerName}}', '{{totalAmount}}', '{{storeName}}'],
  status_change: ['{{orderNumber}}', '{{customerName}}', '{{status}}', '{{storeName}}'],
  shipping_update: ['{{orderNumber}}', '{{customerName}}', '{{carrier}}', '{{trackingNumber}}', '{{storeName}}'],
  custom: [],
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email')
  const [editState, setEditState] = useState<Record<string, { subject: string; body: string; isActive: boolean }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getTemplates()
      setTemplates(data)
      const state: Record<string, { subject: string; body: string; isActive: boolean }> = {}
      for (const t of data) state[`${t.channel}:${t.type}`] = { subject: t.subject, body: t.body, isActive: t.isActive }
      setEditState(state)
    } catch {
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (channel: string, type: string) => {
    const key = `${channel}:${type}`
    const data = editState[key]
    if (!data) return
    setSaving(key)
    try {
      await api.updateTemplate({ channel, type, subject: data.subject, body: data.body, isActive: data.isActive })
    } catch {
    } finally {
      setSaving(null)
    }
  }

  const updateField = (channel: string, type: string, field: string, value: string | boolean) => {
    const key = `${channel}:${type}`
    setEditState(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  const filtered = templates.filter(t => t.channel === activeTab)

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Mail className="h-6 w-6" /> Bildirim Şablonları</h1>
          <p className="mt-1 text-sm text-zinc-400">Email ve SMS şablonlarını düzenleyin</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        <button onClick={() => setActiveTab('email')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'email' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          <Mail className="h-4 w-4" /> Email
        </button>
        <button onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'sms' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          <MessageSquare className="h-4 w-4" /> SMS
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : (
        <div className="mt-6 space-y-6">
          {filtered.map(t => {
            const key = `${t.channel}:${t.type}`
            const state = editState[key]
            if (!state) return null
            return (
              <div key={key} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{TYPE_LABELS[t.type] || t.type}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {t.isCustom ? 'Özel şablon' : 'Varsayılan şablon'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      <input type="checkbox" checked={state.isActive} onChange={e => updateField(t.channel, t.type, 'isActive', e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800" />
                      Aktif
                    </label>
                    <button onClick={() => handleSave(t.channel, t.type)} disabled={saving === key}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                      <Save className="h-3.5 w-3.5" /> {saving === key ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </div>
                </div>

                {t.channel === 'email' && (
                  <div className="mt-3">
                    <label className="text-xs text-zinc-500">Konu</label>
                    <input value={state.subject} onChange={e => updateField(t.channel, t.type, 'subject', e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
                  </div>
                )}

                <div className="mt-3">
                  <label className="text-xs text-zinc-500">İçerik</label>
                  <textarea value={state.body} onChange={e => updateField(t.channel, t.type, 'body', e.target.value)} rows={5}
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 font-mono" />
                </div>

                {VARIABLES_HELP[t.type]?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {VARIABLES_HELP[t.type].map(v => (
                      <span key={v} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">{v}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
