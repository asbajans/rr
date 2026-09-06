'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { BarChart3, Eye, ShoppingCart, MousePointer, TrendingUp, Users } from 'lucide-react'

export default function SiteStatsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await api.getSellerAnalytics({ days })
      setData(r)
    } catch (e:any){ setError(e.message || 'Yüklenemedi') }
    finally { setLoading(false)}
  }
  useEffect(()=>{ load() }, [days])

  if (loading) return <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4"><p className="text-sm text-zinc-500">Yükleniyor...</p></div>
  if (error) return <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4"><p className="text-sm text-red-600">{error}</p><button onClick={load} className="mt-2 text-xs text-indigo-600">Tekrar dene</button></div>
  if (!data) return null
  const k = data.kpi
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 mt-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-600" /> Site İstatistiği</h3>
        <div className="flex gap-1">
          {[7,30,90].map(d=>(
            <button key={d} onClick={()=>setDays(d)} className={`rounded-lg px-3 py-1 text-xs font-medium border ${days===d?'bg-zinc-900 text-white border-zinc-900':'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'}`}>Son {d} gün</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1"><Eye className="h-3 w-3" /> Ziyaret</p>
          <p className="text-xl font-bold text-zinc-900">{k.pageViews.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-zinc-500">{k.uniqueVisitors.toLocaleString('tr-TR')} tekil</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Ürün Görüntüleme</p>
          <p className="text-xl font-bold text-zinc-900">{k.productViews.toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1"><MousePointer className="h-3 w-3" /> Sepete Ekle</p>
          <p className="text-xl font-bold text-zinc-900">{k.addToCarts.toLocaleString('tr-TR')}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Satış / Ciro</p>
          <p className="text-xl font-bold text-zinc-900">{k.purchases} / {Number(k.revenue).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
          <p className="text-xs text-zinc-500">Dönüşüm %{k.conversion}</p>
        </div>
      </div>

      {data.series?.length>0 && (
        <div>
          <h4 className="text-xs font-semibold text-zinc-700 mb-1">Günlük Seri</h4>
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {data.series.slice(-30).map((d:any)=>(
                <div key={d.date} className="w-10 text-center">
                  <div className="flex flex-col-reverse gap-0.5 h-24 justify-start items-center">
                    <div className="w-6 bg-indigo-600 rounded-t" style={{ height: `${Math.min(80, (d.page_view/ Math.max(1, Math.max(...data.series.map((x:any)=>x.page_view))))*80)}px` }} title={`Ziyaret ${d.page_view}`} />
                    <div className="w-6 bg-emerald-500 rounded-t" style={{ height: `${Math.min(80, (d.purchase/ Math.max(1, Math.max(...data.series.map((x:any)=>x.purchase))))*80)}px` }} title={`Satış ${d.purchase}`} />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">{d.date.slice(5)}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1"><span className="inline-block h-2 w-2 bg-indigo-600 rounded mr-1" />Ziyaret <span className="inline-block h-2 w-2 bg-emerald-500 rounded ml-2 mr-1" />Satış</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-zinc-700 mb-2">En Çok Görüntülenen Ürünler</h4>
          {data.topProducts?.length? data.topProducts.map((p:any)=>(
            <div key={p.productId} className="flex items-center gap-2 py-1.5 border-b border-zinc-100 last:border-0">
              {p.image? <img src={p.image} className="h-8 w-8 rounded object-cover border" alt={p.title} /> : <div className="h-8 w-8 rounded bg-zinc-100" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-900 truncate">{p.title}</p>
                <p className="text-[11px] text-zinc-500">{p.sku} · {p.views} görüntüleme</p>
              </div>
            </div>
          )) : <p className="text-xs text-zinc-500">Veri yok</p>}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-zinc-700 mb-2">Kaynaklar</h4>
          {data.sources?.length? data.sources.map((s:any)=>(
            <div key={s.src} className="flex items-center justify-between py-1 border-b border-zinc-100 last:border-0">
              <span className="text-xs text-zinc-700">{s.src}</span>
              <span className="text-xs font-medium text-zinc-900">{s.c} </span>
            </div>
          )) : <p className="text-xs text-zinc-500">Veri yok</p>}
        </div>
      </div>
    </div>
  )
}
