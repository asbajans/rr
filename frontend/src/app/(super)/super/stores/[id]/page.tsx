'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { ArrowLeft, Package, ShoppingCart, Coins, Plug, Users, TrendingUp, AlertTriangle, Clock, ExternalLink } from 'lucide-react'

export default function SuperStoreDetailPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminStore(params.id)
      .then(setData)
      .catch(e => setError(e.message || 'Yüklenemedi'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <p className="text-sm text-zinc-500 p-8">Yükleniyor...</p>
  if (error) return <div className="p-8"><p className="text-sm text-red-400">{error}</p><button onClick={() => router.push('/stores')} className="mt-4 text-sm text-zinc-400 underline">Geri dön</button></div>
  if (!data) return null

  const { store, stats, recent } = data

  const cards = [
    { label: 'Ürünler', value: `${stats.activeProducts} / ${stats.totalProducts}`, icon: Package, sub: `Aktif / Toplam · Düşük stok: ${stats.lowStockCount}` },
    { label: 'Siparişler', value: stats.totalOrders, icon: ShoppingCart, sub: `Bekleyen: ${stats.pendingOrders} · Ciro: ${Number(stats.totalRevenue).toLocaleString('tr-TR')} ₺` },
    { label: 'Entegrasyonlar', value: `${stats.activeIntegrations} / ${stats.totalIntegrations}`, icon: Plug, sub: 'Aktif / Toplam pazaryeri' },
    { label: 'Kullanıcılar', value: stats.totalUsers, icon: Users, sub: 'Mağaza kullanıcı sayısı' },
    { label: 'AI Kullanımı', value: stats.aiUsageCount, icon: Coins, sub: `Harcanan kredi: ${stats.aiCreditsUsed}` },
    { label: 'Kredi Log', value: stats.creditLogsCount, icon: TrendingUp, sub: 'Toplam kredi hareketi' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/stores')} className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">{store.name} <span className="text-sm font-normal text-zinc-500">#{store.id}</span></h1>
          <p className="text-sm text-zinc-400">{store.siteCode} · {store.email} · Plan: {(store.plan as any)?.name ?? '-'}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a href={store.siteUrl ?? `https://rahatio.com.tr/stores/${store.siteCode}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"><ExternalLink className="h-3 w-3" /> Siteye git</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500"><c.icon className="h-4 w-4" /> {c.label}</div>
            <div className="mt-1 text-2xl font-bold text-white">{c.value}</div>
            <div className="text-xs text-zinc-500">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white">Mağaza Bilgisi</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
          <div><span className="text-zinc-500">Durum:</span> <span className={store.isActive ? 'text-green-400' : 'text-red-400'}>{store.isActive ? 'Aktif' : 'Pasif'}</span> · Yayın: {store.published ? 'Evet' : 'Hayır'}</div>
          <div><span className="text-zinc-500">Domain:</span> <span className="text-white">{store.domain || '-'}</span> · Site URL: <span className="text-white">{store.siteUrl || '-'}</span></div>
          <div><span className="text-zinc-500">Plan:</span> <span className="text-white">{(store.plan as any)?.name ?? '-'}</span> ({(store.plan as any)?.slug ?? '-'}) · {Number((store.plan as any)?.price ?? 0)} {(store.plan as any)?.currency ?? 'TRY'}</div>
          <div><span className="text-zinc-500">Oluşturulma:</span> <span className="text-white">{new Date(store.createdAt).toLocaleString('tr-TR')}</span></div>
          <div className="md:col-span-2"><span className="text-zinc-500">Kullanıcılar:</span> {(store.users || []).map((u: any) => `${u.name} (${u.email} · ${u.role} · ${u.aiCredits} kredi)`).join(' | ') || '-'}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Plug className="h-4 w-4" /> Entegrasyonlar</h3>
          <div className="mt-3 space-y-2">
            {(recent.integrations || []).length === 0 && <p className="text-xs text-zinc-500">Entegrasyon yok</p>}
            {(recent.integrations || []).map((i: any) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2 text-xs">
                <span className="text-white">{i.marketplace}</span>
                <span className={i.isActive ? 'text-green-400' : 'text-zinc-500'}>{i.isActive ? 'Aktif' : 'Pasif'}</span>
                <span className="text-zinc-500">{i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString('tr-TR') : 'hiç sync yok'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Package className="h-4 w-4" /> Son Ürünler</h3>
          <div className="mt-3 space-y-1">
            {(recent.products || []).length === 0 && <p className="text-xs text-zinc-500">Ürün yok</p>}
            {(recent.products || []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-zinc-800 px-3 py-2 text-xs">
                <span className="text-white truncate max-w-[160px]">{p.title}</span>
                <span className="text-zinc-400">{p.sku}</span>
                <span className={p.isActive ? 'text-green-400' : 'text-zinc-500'}>{p.isActive ? 'Aktif' : 'Pasif'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Son Siparişler</h3>
        <div className="mt-3 space-y-1">
          {(recent.orders || []).length === 0 && <p className="text-xs text-zinc-500">Sipariş yok</p>}
          {(recent.orders || []).map((o: any) => (
            <div key={o.id} className="flex items-center justify-between rounded bg-zinc-800 px-3 py-2 text-xs">
              <span className="text-white">{o.orderNumber}</span>
              <span className="text-zinc-400">{o.marketplace}</span>
              <span className="text-zinc-400">{o.status}</span>
              <span className="text-white">{Number(o.totalAmount).toLocaleString('tr-TR')} {o.currency}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="h-4 w-4" /> Son Kredi Logları</h3>
          <div className="mt-3 max-h-64 overflow-auto space-y-1">
            {(recent.creditLogs || []).length === 0 && <p className="text-xs text-zinc-500">Log yok</p>}
            {(recent.creditLogs || []).map((l: any) => (
              <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 text-xs flex justify-between">
                <span className="text-zinc-300">{l.action} · {l.module}</span>
                <span className={l.amount < 0 ? 'text-red-400' : 'text-green-400'}>{l.amount > 0 ? '+' : ''}{l.amount} → {l.balanceAfter}</span>
                <span className="text-zinc-500">{new Date(l.createdAt).toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Coins className="h-4 w-4" /> Son AI Kullanımları</h3>
          <div className="mt-3 max-h-64 overflow-auto space-y-1">
            {(recent.aiLogs || []).length === 0 && <p className="text-xs text-zinc-500">Log yok</p>}
            {(recent.aiLogs || []).map((l: any) => (
              <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 text-xs flex justify-between">
                <span className="text-zinc-300">store:{l.storeId} user:{l.userId} · {l.creditsUsed} kredi</span>
                <span className="text-zinc-500">{new Date(l.createdAt).toLocaleString('tr-TR')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white">Son Entegrasyon Logları</h3>
        <div className="mt-3 max-h-64 overflow-auto space-y-1">
          {(recent.integrationLogs || []).length === 0 && <p className="text-xs text-zinc-500">Log yok</p>}
          {(recent.integrationLogs || []).map((l: any) => (
            <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 text-xs">
              <div className="flex justify-between"><span className="text-white">{l.platform} {l.method} {l.endpoint}</span><span className={l.isSuccess ? 'text-green-400' : 'text-red-400'}>{l.isSuccess ? 'OK' : 'FAIL'}</span></div>
              {l.errorMessage && <div className="text-red-400 mt-1">{l.errorMessage}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
