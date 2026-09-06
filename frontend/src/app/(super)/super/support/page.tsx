'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { LifeBuoy, Bug, Lightbulb, Search, Filter, Clock, CheckCircle, XCircle, AlertCircle, Eye, Send } from 'lucide-react'

const CATS: Record<string, { label: string; icon: any; cls: string }> = {
  bug: { label: 'Hata', icon: Bug, cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  support: { label: 'Destek', icon: LifeBuoy, cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  feedback: { label: 'Geri Bildirim', icon: Lightbulb, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}
const STAT: Record<string, { label: string; cls: string; icon: any }> = {
  open: { label: 'Açık', cls: 'bg-zinc-800 text-zinc-200 border-zinc-700', icon: AlertCircle },
  pending: { label: 'Beklemede', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Clock },
  resolved: { label: 'Çözüldü', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle },
  closed: { label: 'Kapandı', cls: 'bg-zinc-800 text-zinc-500 border-zinc-800', icon: XCircle },
}

export default function SuperSupportPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any|null>(null)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const r = await api.getSuperSupportTickets({ page, limit: 20, status: filterStatus||undefined, category: filterCat||undefined, search: search||undefined } as any)
      setTickets(r.tickets); setTotal(r.total)
    } catch (e:any){ setError(e.message)}
    finally { setLoading(false)}
  }
  useEffect(()=>{ load() }, [page, filterStatus, filterCat])
  const doSearch = ()=>{ setPage(1); load() }

  const openDetail = async (code: string) => {
    try {
      const r = await api.getSuperSupportTicket(code)
      setSelected(r.ticket)
    } catch (e:any){ setError(e.message)}
  }

  const handleStatus = async (code:string, status:string) => {
    try {
      await api.updateSuperSupportTicket(code, { status })
      if (selected?.code===code) {
        const r = await api.getSuperSupportTicket(code); setSelected(r.ticket)
      }
      await load()
    } catch (e:any){ setError(e.message)}
  }

  const handleReply = async () => {
    if (!selected || !reply.trim()) return
    setSending(true)
    try {
      await api.replySuperSupportTicket(selected.code, reply.trim())
      setReply('')
      const r = await api.getSuperSupportTicket(selected.code); setSelected(r.ticket)
      await load()
    } catch (e:any){ setError(e.message)}
    finally { setSending(false)}
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-indigo-400" /> Destek Talepleri</h1>
        <p className="text-sm text-zinc-400">Her bildirime özel kod atanır — gelen bildirimlerde kod mutlaka görünür.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value); setPage(1)}} className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200">
            <option value="">Tüm Durumlar</option>
            <option value="open">Açık</option>
            <option value="pending">Beklemede</option>
            <option value="resolved">Çözüldü</option>
            <option value="closed">Kapandı</option>
          </select>
          <select value={filterCat} onChange={e=>{setFilterCat(e.target.value); setPage(1)}} className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200">
            <option value="">Tüm Kategoriler</option>
            <option value="bug">Hata</option>
            <option value="support">Destek</option>
            <option value="feedback">Geri Bildirim</option>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Kod / konu ara" className="bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 outline-none" />
          </div>
          <button onClick={doSearch} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-zinc-900">Ara</button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-400 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Kod</th>
                <th className="px-3 py-2 text-left">Mağaza</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-left">Konu</th>
                <th className="px-3 py-2 text-left">Durum</th>
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading && <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-500">Yükleniyor...</td></tr>}
              {!loading && tickets.length===0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-500">Kayıt yok</td></tr>}
              {!loading && tickets.map((tk:any)=>{
                const cat = CATS[tk.category] || CATS.support
                const st = STAT[tk.status] || STAT.open
                return (
                  <tr key={tk.id} className="hover:bg-zinc-800/40">
                    <td className="px-3 py-2 font-mono text-xs font-bold text-white">{tk.code}</td>
                    <td className="px-3 py-2 text-zinc-300">{tk.store?.name || `#${tk.storeId}`} <span className="text-zinc-500 text-xs">({tk.store?.siteCode})</span></td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cat.cls}`}><cat.icon className="h-3 w-3" /> {cat.label}</span></td>
                    <td className="px-3 py-2 text-zinc-200 max-w-[280px] truncate">{tk.subject}</td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${st.cls}`}><st.icon className="h-3 w-3" /> {st.label}</span></td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{new Date(tk.createdAt).toLocaleString('tr-TR')}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={()=>openDetail(tk.code)} className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 flex items-center gap-1 ml-auto"><Eye className="h-3 w-3" /> Gör</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {total>20 && (
          <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-sm text-zinc-400">
            <span>Toplam {total}</span>
            <div className="flex gap-1">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">Önceki</button>
              <span className="px-2 py-1">Sayfa {page}</span>
              <button disabled={tickets.length<20} onClick={()=>setPage(p=>p+1)} className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40">Sonraki</button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setSelected(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl bg-zinc-900 border border-zinc-800 p-5" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-white">{selected.code}</p>
                <h3 className="text-base font-semibold text-white">{selected.subject}</h3>
                <p className="text-xs text-zinc-400">{selected.store?.name} ({selected.store?.siteCode}) · {selected.user?.email} · {selected.category} · {selected.status} · {new Date(selected.createdAt).toLocaleString('tr-TR')}</p>
              </div>
              <button onClick={()=>setSelected(null)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">Kapat</button>
            </div>
            <div className="mt-3">
              <label className="text-xs text-zinc-400">Durum değiştir</label>
              <div className="mt-1 flex gap-1 flex-wrap">
                {(['open','pending','resolved','closed'] as const).map(s=>(
                  <button key={s} onClick={()=>handleStatus(selected.code, s)} className={`rounded-full px-3 py-1 text-xs border ${selected.status===s? 'bg-white text-zinc-900 border-white' : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-zinc-800 p-3 text-sm text-zinc-200 whitespace-pre-wrap border border-zinc-700">{selected.message}</div>
            {selected.screenshots?.length>0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {selected.screenshots.map((u:string,i:number)=><a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} className="h-20 w-20 rounded object-cover border border-zinc-700" alt={`ss ${i}`} /></a>)}
              </div>
            )}
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-semibold text-white">Yanıtlar</h4>
              {(selected.messages||[]).length===0 && <p className="text-xs text-zinc-500">Henüz yanıt yok.</p>}
              {(selected.messages||[]).map((m:any)=>(
                <div key={m.id} className={`rounded-lg p-3 text-sm border ${m.senderType==='superadmin'?'bg-indigo-950 border-indigo-800 text-indigo-100':'bg-zinc-800 border-zinc-700 text-zinc-200'}`}>
                  <p className="text-xs opacity-70">{m.senderType==='superadmin'?'Süperadmin':'Satıcı'} · {new Date(m.createdAt).toLocaleString('tr-TR')}</p>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            {selected.status!=='closed' && (
              <div className="mt-4 flex gap-2">
                <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Yanıt yaz..." className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500" onKeyDown={e=>e.key==='Enter'&&handleReply()} />
                <button onClick={handleReply} disabled={sending || !reply.trim()} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 flex items-center gap-1"><Send className="h-4 w-4" /> Gönder</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
