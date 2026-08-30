'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { ArrowLeft, Package, ShoppingCart, Coins, Plug, ExternalLink } from 'lucide-react'

export default function SuperUserDetailPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminUser(params.id)
      .then(setData)
      .catch(e => setError(e.message || 'Yüklenemedi'))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <p className="text-sm text-zinc-500 p-8">Yükleniyor...</p>
  if (error) return <div className="p-8"><p className="text-sm text-red-400">{error}</p><button onClick={() => router.push('/users')} className="mt-4 text-sm text-zinc-400 underline">Geri dön</button></div>
  if (!data) return null

  const { user, store, stats, recent } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/users')} className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name} <span className="text-sm font-normal text-zinc-500">#{user.id}</span></h1>
          <p className="text-sm text-zinc-400">{user.email} · {user.role} · {user.isActive ? 'Aktif' : 'Pasif'} · {user.aiCredits} kredi</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white">Kullanıcı Bilgisi</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
          <div><span className="text-zinc-500">E-posta:</span> <span className="text-white">{user.email}</span></div>
          <div><span className="text-zinc-500">Rol:</span> <span className="text-white">{user.role}</span> · AI kredisi: <span className="text-white">{user.aiCredits}</span></div>
          <div><span className="text-zinc-500">Mağaza:</span> {store ? <Link href={`/stores/${store.id}`} className="text-indigo-400 hover:text-indigo-300">{store.name} ({store.siteCode})</Link> : <span className="text-zinc-500">-</span>}</div>
          <div><span className="text-zinc-500">Kayıt:</span> <span className="text-white">{new Date(user.createdAt).toLocaleString('tr-TR')}</span></div>
          {store && <div className="md:col-span-2"><span className="text-zinc-500">Plan:</span> <span className="text-white">{(store.plan as any)?.name ?? '-'}</span> · Domain: <span className="text-white">{store.domain || '-'}</span> · Site URL: <span className="text-white">{store.siteUrl || '-'}</span></div>}
        </div>
      </div>

      {store && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Ürünler', value: `${stats.activeProducts}/${stats.totalProducts}`, icon: Package },
              { label: 'Siparişler', value: stats.totalOrders, icon: ShoppingCart },
              { label: 'Entegrasyon', value: `${stats.activeIntegrations}/${stats.totalIntegrations}`, icon: Plug },
              { label: 'AI Kullanım', value: stats.aiUsageCount, icon: Coins },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-2 text-xs text-zinc-500"><c.icon className="h-4 w-4" /> {c.label}</div>
                <div className="mt-1 text-xl font-bold text-white">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-xs">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div><span className="text-zinc-500">Toplam ciro:</span> <span className="text-white">{Number(stats.totalRevenue).toLocaleString('tr-TR')} ₺</span></div>
              <div><span className="text-zinc-500">Bekleyen sipariş:</span> <span className="text-white">{stats.pendingOrders}</span></div>
              <div><span className="text-zinc-500">Harcanan kredi:</span> <span className="text-white">{stats.aiCreditsUsed}</span> (store) / kullanıcı: {stats.userAiUsageCount} kullanım</div>
              <div><span className="text-zinc-500">Kredi log:</span> <span className="text-white">{stats.creditLogsCount}</span> (kullanıcı: {stats.userCreditLogsCount})</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h4 className="text-sm font-semibold text-white">Entegrasyonlar</h4>
              <div className="mt-2 space-y-1">
                {(recent.integrations || []).length === 0 && <p className="text-zinc-500">Yok</p>}
                {(recent.integrations || []).map((i: any) => (
                  <div key={i.id} className="flex justify-between rounded bg-zinc-800 px-3 py-1.5"><span className="text-white">{i.marketplace}</span><span className={i.isActive ? 'text-green-400' : 'text-zinc-500'}>{i.isActive ? 'Aktif' : 'Pasif'}</span></div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-white">Son Kredi Logları</h3>
              <div className="mt-3 max-h-64 overflow-auto space-y-1">
                {(recent.creditLogs || []).length === 0 && <p className="text-xs text-zinc-500">Yok</p>}
                {(recent.creditLogs || []).map((l: any) => (
                  <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 flex justify-between text-xs">
                    <span className="text-zinc-300">{l.action}/{l.module}</span>
                    <span className={l.amount < 0 ? 'text-red-400' : 'text-green-400'}>{l.amount}</span>
                    <span className="text-zinc-500">{new Date(l.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="text-sm font-semibold text-white">Son AI Logları</h3>
              <div className="mt-3 max-h-64 overflow-auto space-y-1">
                {(recent.aiLogs || []).length === 0 && <p className="text-xs text-zinc-500">Yok</p>}
                {(recent.aiLogs || []).map((l: any) => (
                  <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 flex justify-between text-xs">
                    <span className="text-zinc-300">{l.creditsUsed} kredi · user:{l.userId}</span>
                    <span className="text-zinc-500">{new Date(l.createdAt).toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-semibold text-white">Son Entegrasyon Logları</h3>
            <div className="mt-3 max-h-64 overflow-auto space-y-1">
              {(recent.integrationLogs || []).length === 0 && <p className="text-xs text-zinc-500">Yok</p>}
              {(recent.integrationLogs || []).map((l: any) => (
                <div key={l.id} className="rounded bg-zinc-800 px-3 py-2 text-xs">
                  <div className="flex justify-between"><span className="text-white">{l.platform} {l.method} {l.endpoint}</span><span className={l.isSuccess ? 'text-green-400' : 'text-red-400'}>{l.isSuccess ? 'OK' : 'FAIL'}</span></div>
                  {l.errorMessage && <div className="text-red-400 mt-1">{l.errorMessage}</div>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
