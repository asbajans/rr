'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Star, Check, X, Trash2, Search } from 'lucide-react'

function Stars({ v }: { v: number }) {
  return <span className="flex items-center">{[1,2,3,4,5].map(n=><Star key={n} className={`h-4 w-4 ${n<=v?'fill-amber-400 text-amber-400':'text-zinc-300'}`} />)}</span>
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await api.getReviews({ status: status||undefined, search: search||undefined, page, limit: 20 } as any)
      setReviews(r.reviews||[]); setTotal(r.total||0)
    } catch (e:any){ setError(e.message)}
    finally { setLoading(false)}
  }
  useEffect(()=>{ load() }, [status, page])
  const doSearch = ()=>{ setPage(1); load() }

  const act = async (id:number, newStatus:'approved'|'rejected')=>{
    try { await api.updateReviewStatus(id, newStatus); await load() } catch(e:any){ setError(e.message)}
  }
  const del = async (id:number)=>{
    if (!confirm('Silinsin mi?')) return
    try { await api.deleteReview(id); await load() } catch(e:any){ setError(e.message)}
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2"><Star className="h-6 w-6 text-amber-500" /> Ürün Yorumları</h1>
        <p className="text-sm text-zinc-600">Müşterilerinin ürünlerine yaptığı yorumları onayla veya reddet. Yorum yapmak için giriş şartı var (misafir yorum yazamaz).</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {[
            { k:'', l:'Tümü' },
            { k:'pending', l:'Beklemede' },
            { k:'approved', l:'Onaylı' },
            { k:'rejected', l:'Reddedildi' },
          ].map(s=>(
            <button key={s.k} onClick={()=>{setStatus(s.k); setPage(1)}} className={`rounded-full px-3 py-1.5 text-xs font-medium border ${status===s.k?'bg-zinc-900 text-white border-zinc-900':'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}>{s.l}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2">
            <Search className="h-4 w-4 text-zinc-400" />
            <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()} placeholder="Başlık / içerik ara" className="py-1.5 text-sm outline-none" />
          </div>
          <button onClick={doSearch} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white">Ara</button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500"><tr><th className="px-3 py-2 text-left">Ürün</th><th className="px-3 py-2 text-left">Müşteri</th><th className="px-3 py-2">Puan</th><th className="px-3 py-2 text-left">Yorum</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Tarih</th><th className="px-3 py-2 text-right">İşlem</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-500">Yükleniyor...</td></tr>}
              {!loading && reviews.length===0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-zinc-500">Yorum yok</td></tr>}
              {!loading && reviews.map((r:any)=>(
                <tr key={r.id} className="hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 max-w-[200px]">
                      {r.product?.images?.[0]? <img src={Array.isArray(r.product.images)? r.product.images[0] : r.product.images} className="h-8 w-8 rounded object-cover border" alt="" /> : <div className="h-8 w-8 rounded bg-zinc-100" />}
                      <div className="min-w-0"><p className="text-xs font-medium text-zinc-900 truncate">{r.product?.title || `#${r.productId}`}</p><p className="text-[11px] text-zinc-500">{r.product?.sku}</p></div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700">{r.customer?.name || `#${r.customerId}`} <br /><span className="text-zinc-500">{r.customer?.email}</span></td>
                  <td className="px-3 py-2"><Stars v={r.rating} /></td>
                  <td className="px-3 py-2 max-w-[320px]">
                    {r.title && <p className="text-xs font-medium text-zinc-900 truncate">{r.title}</p>}
                    <p className="text-xs text-zinc-600 line-clamp-2">{r.body || '-'}</p>
                  </td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${r.status==='approved'?'bg-green-50 text-green-700 border-green-200': r.status==='rejected'?'bg-red-50 text-red-700 border-red-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.status}</span></td>
                  <td className="px-3 py-2 text-xs text-zinc-500">{new Date(r.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      {r.status!=='approved' && <button onClick={()=>act(r.id,'approved')} className="rounded p-1.5 bg-green-600 text-white hover:bg-green-700" title="Onayla"><Check className="h-3 w-3" /></button>}
                      {r.status!=='rejected' && <button onClick={()=>act(r.id,'rejected')} className="rounded p-1.5 bg-zinc-200 hover:bg-zinc-300" title="Reddet"><X className="h-3 w-3" /></button>}
                      <button onClick={()=>del(r.id)} className="rounded p-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100" title="Sil"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total>20 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-sm text-zinc-500">
            <span>Toplam {total}</span>
            <div className="flex gap-1">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40">Önceki</button>
              <span className="px-2 py-1">Sayfa {page}</span>
              <button disabled={reviews.length<20} onClick={()=>setPage(p=>p+1)} className="rounded border border-zinc-300 px-2 py-1 disabled:opacity-40">Sonraki</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
