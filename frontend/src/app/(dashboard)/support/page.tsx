'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { CardSkeleton } from '@/components/ui/skeleton'
import { LifeBuoy, Bug, MessageSquare, Lightbulb, Upload, X, Send, Eye, Clock, CheckCircle, AlertCircle, XCircle } from 'lucide-react'

const CATS = [
  { key: 'bug', label: 'Hata', icon: Bug, color: 'text-red-600 bg-red-50 border-red-200', dot: 'bg-red-500' },
  { key: 'support', label: 'Destek', icon: LifeBuoy, color: 'text-blue-600 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  { key: 'feedback', label: 'Geri Bildirim', icon: Lightbulb, color: 'text-amber-600 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
] as const

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  open: { label: 'Açık', cls: 'bg-zinc-900 text-white', icon: AlertCircle },
  pending: { label: 'Beklemede', cls: 'bg-amber-100 text-amber-800 border border-amber-200', icon: Clock },
  resolved: { label: 'Çözüldü', cls: 'bg-green-100 text-green-800 border border-green-100', icon: CheckCircle },
  closed: { label: 'Kapandı', cls: 'bg-zinc-100 text-zinc-600 border border-zinc-200', icon: XCircle },
}

export default function SupportPage() {
  const { t } = useI18n()
  const [category, setCategory] = useState<'bug'|'support'|'feedback'>('support')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [okCode, setOkCode] = useState('')

  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [selected, setSelected] = useState<any|null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [replySending, setReplySending] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.getSupportTickets({ status: filterStatus || undefined } as any)
      setTickets(r.tickets || [])
    } catch {} finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [filterStatus])

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError('')
    const remaining = 3 - screenshots.length
    const list = Array.from(files).slice(0, remaining) as File[]
    for (const f of list) {
      if (f.size > 1024*1024) { setError(`${f.name}: dosya 1MB üzeri olamaz`); continue }
      if (!f.type.startsWith('image/')) { setError(`${f.name}: sadece görsel yükleyin`); continue }
      setUploading(true)
      try {
        const up = await api.uploadImage(f)
        setScreenshots(prev => [...prev, up.url].slice(0,3))
      } catch (e: any) { setError(e.message || 'Yükleme başarısız') }
      finally { setUploading(false) }
    }
  }

  const handleSend = async () => {
    setError(''); setOkCode('')
    if (subject.trim().length < 5) { setError('Konu en az 5 karakter olmalı'); return }
    if (message.trim().length < 10) { setError('Mesaj en az 10 karakter olmalı'); return }
    setSending(true)
    try {
      const r: any = await api.createSupportTicket({ category, subject: subject.trim(), message: message.trim(), screenshots: screenshots.length? screenshots : undefined })
      const code = r.ticket?.code || r.code
      setOkCode(code)
      setSubject(''); setMessage(''); setScreenshots([])
      await load()
    } catch (e: any) { setError(e.message || 'Gönderilemedi') }
    finally { setSending(false) }
  }

  const openDetail = async (code: string) => {
    setDetailLoading(true); setSelected({ code, loading: true })
    try {
      const r = await api.getSupportTicket(code)
      setSelected(r.ticket)
    } catch (e: any) { setError(e.message) }
    finally { setDetailLoading(false) }
  }

  const handleReply = async () => {
    if (!selected || !reply.trim()) return
    setReplySending(true)
    try {
      await api.replySupportTicket(selected.code, reply.trim())
      setReply('')
      const r = await api.getSupportTicket(selected.code)
      setSelected(r.ticket)
      await load()
    } catch (e: any) { setError(e.message) }
    finally { setReplySending(false) }
  }

  const handleClose = async () => {
    if (!selected) return
    try {
      await api.closeSupportTicket(selected.code)
      const r = await api.getSupportTicket(selected.code)
      setSelected(r.ticket)
      await load()
    } catch (e:any){ setError(e.message)}
  }

  const catMeta = (k:string)=> CATS.find(c=>c.key===k) || CATS[1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><LifeBuoy className="h-6 w-6 text-indigo-600" /> {t('supportTitle')}</h1>
        <p className="mt-1 text-sm text-zinc-600">{t('supportSubtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Yeni Bildirim</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CATS.map(c=>{
              const active = category===c.key
              return (
                <button key={c.key} onClick={()=>setCategory(c.key as any)} className={`rounded-lg border px-2 py-3 text-xs font-medium flex flex-col items-center gap-1.5 ${active? c.color+' ring-1 ring-offset-0' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}>
                  <c.icon className="h-4 w-4" /> {c.label}
                </button>
              )
            })}
          </div>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Konu</label>
              <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Örn: Sipariş senkronizasyonu çalışmıyor" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" maxLength={200} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Mesaj</label>
              <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={5} placeholder="Sorunu detaylı anlatın..." className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" maxLength={5000} />
              <p className="text-[11px] text-zinc-400 text-right">{message.length}/5000</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Ekran Görüntüsü (max 3, 1MB)</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {screenshots.map((url,i)=>(
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                    <img src={url} alt={`ss ${i+1}`} className="h-full w-full object-cover" />
                    <button onClick={()=>setScreenshots(s=>s.filter((_,idx)=>idx!==i))} className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
                  </div>
                ))}
                {screenshots.length<3 && (
                  <label className={`flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed ${uploading?'bg-zinc-100':'border-zinc-300 hover:bg-zinc-50'}`}>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e=>{ handleFiles(e.target.files); e.target.value='' }} disabled={uploading} />
                    {uploading? <span className="text-xs text-zinc-500">Yükleniyor...</span> : <><Upload className="h-4 w-4 text-zinc-500" /></>}
                  </label>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {okCode && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Gönderildi — Takip kodun: <span className="font-mono font-bold">{okCode}</span></p>}
            <button onClick={handleSend} disabled={sending || uploading} className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="h-4 w-4" /> {sending? t('supportSending') : t('supportSend')}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">{t('supportMyTickets')}</h2>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs">
              <option value="">Tümü</option>
              <option value="open">Açık</option>
              <option value="pending">Beklemede</option>
              <option value="resolved">Çözüldü</option>
              <option value="closed">Kapandı</option>
            </select>
          </div>
          <div className="mt-4 space-y-2 max-h-[560px] overflow-auto pr-1">
            {loading && <CardSkeleton count={3} />}
            {!loading && tickets.length===0 && <p className="text-sm text-zinc-500 py-10 text-center">{t('supportNoTickets')}</p>}
            {!loading && tickets.map((tk:any)=>{
              const st = STATUS_MAP[tk.status] || STATUS_MAP.open
              const cm = catMeta(tk.category)
              return (
                <div key={tk.id} className="rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-zinc-900 bg-zinc-100 rounded px-1.5 py-0.5">{tk.code}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cm.color} border`}>{(() => { const I=cm.icon; return <I className="h-3 w-3" />})()} {cm.label}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-900 truncate">{tk.subject}</p>
                      <p className="text-xs text-zinc-500 line-clamp-2">{tk.message}</p>
                      <p className="mt-1 text-[11px] text-zinc-400">{new Date(tk.createdAt).toLocaleString('tr-TR')}</p>
                    </div>
                    <button onClick={()=>openDetail(tk.code)} className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 flex items-center gap-1"><Eye className="h-3 w-3" /> Detay</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-zinc-900">{selected.code}</p>
                <h3 className="text-base font-semibold text-zinc-900">{selected.subject}</h3>
                <p className="text-xs text-zinc-500">{selected.category} · {selected.status} · {selected.createdAt? new Date(selected.createdAt).toLocaleString('tr-TR'):''}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="rounded-lg border border-zinc-300 px-3 py-1 text-sm">Kapat</button>
            </div>
            <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 whitespace-pre-wrap">{selected.message}</div>
            {selected.screenshots?.length>0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {selected.screenshots.map((u:string,i:number)=><a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} className="h-20 w-20 rounded object-cover border" alt={`ss ${i}`} /></a>)}
              </div>
            )}
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-zinc-900">Yanıtlar</h4>
              {(selected.messages||[]).length===0 && <p className="text-xs text-zinc-500">Henüz yanıt yok.</p>}
              {(selected.messages||[]).map((m:any)=>(
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.senderType==='seller'?'bg-blue-50 border border-blue-100':'bg-amber-50 border border-amber-100'}`}>
                  <p className="text-xs font-medium text-zinc-700">{m.senderType==='seller'?'Sen':'Destek'} · {new Date(m.createdAt).toLocaleString('tr-TR')}</p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-800">{m.body}</p>
                  {m.attachments?.length>0 && <div className="mt-2 flex gap-1 flex-wrap">{m.attachments.map((a:string,i:number)=><a key={i} href={a} target="_blank" rel="noreferrer"><img src={a} className="h-16 w-16 rounded object-cover border" alt="att" /></a>)}</div>}
                </div>
              ))}
            </div>
            {selected.status!=='closed' && (
              <div className="mt-4 flex gap-2">
                <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Yanıt yaz..." className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm" onKeyDown={e=>e.key==='Enter' && handleReply()} />
                <button onClick={handleReply} disabled={replySending || !reply.trim()} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Gönder</button>
                <button onClick={handleClose} className="rounded-lg border border-zinc-300 px-3 py-2 text-xs">Kapat Talebi</button>
              </div>
            )}
            {selected.status==='closed' && <p className="mt-3 text-xs text-zinc-500">Bu talep kapatıldı.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
