'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { BarChart3, Eye, Users, Store, CreditCard, TrendingUp, AlertTriangle, Calendar, MessageCircle, UserPlus, ShoppingBag } from 'lucide-react'

export default function SaasAnalyticsPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await api.getSaasAnalytics({ days })
      setData(r)
    } catch (e:any){ setError(e.message || 'Yüklenemedi') }
    finally { setLoading(false)}
  }
  useEffect(()=>{ load() }, [days])

  if (loading) return <div className="text-sm text-zinc-400">Yükleniyor...</div>
  if (error) return <div className="text-sm text-red-400">{error} <button onClick={load} className="underline">Tekrar dene</button></div>
  if (!data) return null

  const p = data.platform
  const u = data.users
  const st = data.stores
  const sub = data.subscriptions

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-400" /> SaaS Analitik</h1>
        <p className="text-sm text-zinc-400">rahatio.com.tr ziyareti, paket satışları, yenileme / churn.</p>
      </div>

      <div className="flex gap-2">
        {[7,30,90].map(d=>(
          <button key={d} onClick={()=>setDays(d)} className={`rounded-lg px-3 py-1 text-xs font-medium border ${days===d?'bg-white text-zinc-900 border-white':'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'}`}>Son {d} gün</button>
        ))}
        <span className="ml-2 text-xs text-zinc-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(data.from).toLocaleDateString('tr-TR')} - {new Date(data.to).toLocaleDateString('tr-TR')}</span>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 flex items-center gap-1"><Eye className="h-3 w-3" /> Platform Ziyareti</p>
          <p className="text-2xl font-bold text-white">{p.views.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-zinc-500">{p.uniqueVisitors.toLocaleString('tr-TR')} tekil</p>
        </div>
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-4">
          <p className="text-xs text-emerald-300 flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp Tıklaması</p>
          <p className="text-2xl font-bold text-white">{(p.whatsappClicks ?? 0).toLocaleString('tr-TR')}</p>
          <p className="text-xs text-zinc-500">+15054415616 · son {days} gün</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 flex items-center gap-1"><Users className="h-3 w-3" /> Kullanıcı</p>
          <p className="text-xl font-bold text-white">{u.total.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-emerald-400">+{u.new} son {days} gün</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 flex items-center gap-1"><Store className="h-3 w-3" /> Mağaza</p>
          <p className="text-xl font-bold text-white">{st.total.toLocaleString('tr-TR')}</p>
          <p className="text-xs text-emerald-400">+{st.new} son {days} gün</p>
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 flex items-center gap-1"><CreditCard className="h-3 w-3" /> Aktif Paket</p>
          <p className="text-xl font-bold text-white">{sub.active} / {sub.total}</p>
          <p className="text-xs text-zinc-500">Trial {sub.trialing} · İptal {sub.canceled}</p>
        </div>
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/20 p-4">
          <p className="text-xs text-amber-300 flex items-center gap-1"><UserPlus className="h-3 w-3" /> Üye Olma (Signup)</p>
          <p className="text-2xl font-bold text-white">{(p.signupEvents ?? 0).toLocaleString('tr-TR')}</p>
          <p className="text-xs text-zinc-500">{(p.signupEvents ?? 0) > 0 ? ((p.signupEvents / Math.max(1, p.views) * 100).toFixed(2) + '%') : '—'} dönüşüm · DB +{u.new}</p>
        </div>
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/20 p-4">
          <p className="text-xs text-emerald-300 flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Satın Alma (Purchase)</p>
          <p className="text-2xl font-bold text-white">{(p.purchaseEvents ?? 0).toLocaleString('tr-TR')}</p>
          <p className="text-xs text-zinc-500">{(p.purchaseEvents ?? 0) > 0 ? ((p.purchaseEvents / Math.max(1, p.views) * 100).toFixed(2) + '%') : '—'} dönüşüm</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400">WhatsApp Dönüşüm</p>
          <p className="text-lg font-bold text-white">{p.views > 0 ? (( (p.whatsappClicks ?? 0) / p.views * 100).toFixed(2)) : '0.00'}%</p>
          <p className="text-xs text-zinc-500">tıklama / ziyaret</p>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Dönüşüm Hunisi (Platform)</h3>
          <span className="text-xs text-zinc-500">Ziyaret → WhatsApp → Üye → Satın Alma</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-zinc-800 p-3"><p className="text-xs text-zinc-400">Ziyaret</p><p className="text-lg font-bold text-white">{p.views.toLocaleString('tr-TR')}</p><p className="text-[11px] text-zinc-500">100%</p></div>
          <div className="rounded-lg bg-emerald-950/30 border border-emerald-900/30 p-3"><p className="text-xs text-emerald-300">WhatsApp</p><p className="text-lg font-bold text-white">{(p.whatsappClicks ?? 0).toLocaleString('tr-TR')}</p><p className="text-[11px] text-zinc-500">{p.views>0?((p.whatsappClicks??0)/p.views*100).toFixed(1):'0'}%</p></div>
          <div className="rounded-lg bg-amber-950/20 border border-amber-900/30 p-3"><p className="text-xs text-amber-300">Üye</p><p className="text-lg font-bold text-white">{(p.signupEvents ?? 0).toLocaleString('tr-TR')}</p><p className="text-[11px] text-zinc-500">{p.views>0?((p.signupEvents??0)/p.views*100).toFixed(1):'0'}%</p></div>
          <div className="rounded-lg bg-indigo-950/30 border border-indigo-900/30 p-3"><p className="text-xs text-indigo-300">Satın Alma</p><p className="text-lg font-bold text-white">{(p.purchaseEvents ?? 0).toLocaleString('tr-TR')}</p><p className="text-[11px] text-zinc-500">{p.views>0?((p.purchaseEvents??0)/p.views*100).toFixed(1):'0'}%</p></div>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">Tüm adımlar GA4 / GTM (dataLayer) / Meta Pixel / TikTok Pixel / Google Ads üzerinden de tetiklenir. Pazarlama etiketlerini yönet → <a href="/super/marketing" className="text-indigo-400 hover:underline">Pazarlama & Takip</a></p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-900/40 bg-amber-950/30 p-4">
          <p className="text-xs text-amber-300 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Yenilememiş (Churn)</p>
          <p className="text-2xl font-bold text-white">{sub.churn}</p>
          <p className="text-xs text-zinc-400">7 gün önce süresi dolan iptaller</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400">Yakında Yenilenecek (7 gün)</p>
          <p className="text-2xl font-bold text-white">{sub.expiringSoon}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Tahmini Aylık Ciro</p>
          <p className="text-2xl font-bold text-white">{Number(sub.revenueEstimate).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>
          <p className="text-xs text-zinc-500">Aktif paket toplamı</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Paket Dağılımı</h3>
          <div className="space-y-1">
            {sub.planBreakdown?.length? sub.planBreakdown.map((pl:any)=>(
              <div key={pl.slug} className="flex items-center justify-between text-sm border-b border-zinc-800 py-1.5 last:border-0">
                <span className="text-zinc-300">{pl.name} <span className="text-zinc-500 text-xs">({pl.slug}) · {Number(pl.price).toLocaleString('tr-TR')}₺</span></span>
                <span className="font-bold text-white">{pl.cnt}</span>
              </div>
            )) : <p className="text-xs text-zinc-500">Veri yok</p>}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Platform Kaynakları</h3>
          <div className="space-y-1">
            {p.sources?.length? p.sources.map((s:any)=>(
              <div key={s.src} className="flex items-center justify-between text-sm border-b border-zinc-800 py-1.5 last:border-0">
                <span className="text-zinc-300">{s.src}</span>
                <span className="font-bold text-white">{s.c}</span>
              </div>
            )) : <p className="text-xs text-zinc-500">Veri yok</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Günlük Platform Ziyareti & Dönüşümler</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {p.series?.slice(-30).map((d:any)=>{
              const w = p.whatsappSeries?.find((x:any)=>x.date===d.date)
              const s = p.signupSeries?.find((x:any)=>x.date===d.date)
              const pu = p.purchaseSeries?.find((x:any)=>x.date===d.date)
              const wClicks = w?.clicks ?? 0
              const sCount = s?.count ?? 0
              const puCount = pu?.count ?? 0
              return (
                <div key={d.date} className="w-12 text-center">
                  <div className="flex justify-center items-end h-20 gap-0.5">
                    <div className="w-2.5 bg-indigo-500 rounded-t" style={{ height: `${Math.min(80, (d.views/ Math.max(1, Math.max(...p.series.map((x:any)=>x.views))))*80)}px` }} title={`Ziyaret ${d.views}`} />
                    <div className="w-2.5 bg-emerald-500 rounded-t" style={{ height: `${Math.min(80, (wClicks/ Math.max(1, Math.max(...(p.whatsappSeries||[]).map((x:any)=>x.clicks),1)))*60)}px` }} title={`WhatsApp ${wClicks}`} />
                    <div className="w-2.5 bg-amber-500 rounded-t" style={{ height: `${Math.min(80, (sCount/ Math.max(1, Math.max(...(p.signupSeries||[]).map((x:any)=>x.count),1)))*60)}px` }} title={`Üye ${sCount}`} />
                    <div className="w-2.5 bg-sky-500 rounded-t" style={{ height: `${Math.min(80, (puCount/ Math.max(1, Math.max(...(p.purchaseSeries||[]).map((x:any)=>x.count),1)))*60)}px` }} title={`Satış ${puCount}`} />
                  </div>
                  <p className="text-[9px] text-zinc-500 mt-1">{d.date.slice(5)}</p>
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2"><span className="inline-block h-2 w-2 bg-indigo-500 rounded mr-1" />Ziyaret <span className="inline-block h-2 w-2 bg-emerald-500 rounded ml-2 mr-1" />WhatsApp <span className="inline-block h-2 w-2 bg-amber-500 rounded ml-2 mr-1" />Üye <span className="inline-block h-2 w-2 bg-sky-500 rounded ml-2 mr-1" />Satın Alma</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">En Çok Ciro Yapan Mağazalar (son {days} gün)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left py-1">Mağaza</th><th className="text-right py-1">Sipariş</th><th className="text-right py-1">Ciro</th></tr></thead>
            <tbody className="divide-y divide-zinc-800">
              {sub.topStores?.length? sub.topStores.map((s:any)=>(
                <tr key={s.storeId}><td className="py-1.5 text-zinc-200">{s.name} <span className="text-zinc-500 text-xs">({s.siteCode})</span></td><td className="text-right text-zinc-300">{s.orders}</td><td className="text-right font-bold text-white">{Number(s.revenue).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</td></tr>
              )) : <tr><td colSpan={3} className="text-center text-zinc-500 py-4">Veri yok</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Büyüme (Yeni Kayıt)</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {data.growthSeries?.slice(-30).map((d:any)=>(
              <div key={d.date} className="w-10 text-center">
                <div className="flex flex-col items-center justify-end h-20 gap-0.5">
                  <div className="w-3 bg-emerald-500 rounded-t" style={{ height: `${Math.min(60, (d.newUsers/ Math.max(1, Math.max(...data.growthSeries.map((x:any)=>x.newUsers))))*60)}px` }} title={`Kullanıcı ${d.newUsers}`} />
                  <div className="w-3 bg-sky-500 rounded-t" style={{ height: `${Math.min(60, (d.newStores/ Math.max(1, Math.max(...data.growthSeries.map((x:any)=>x.newStores))))*60)}px` }} title={`Mağaza ${d.newStores}`} />
                </div>
                <p className="text-[9px] text-zinc-500 mt-1">{d.date.slice(5)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1"><span className="inline-block h-2 w-2 bg-emerald-500 rounded mr-1" />Kullanıcı <span className="inline-block h-2 w-2 bg-sky-500 rounded ml-2 mr-1" />Mağaza</p>
        </div>
      </div>
    </div>
  )
}
