'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { ArrowLeft, User, Mail, Phone, ShoppingCart, DollarSign } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  returned: 'bg-orange-100 text-orange-700',
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.getCustomer(Number(id)).then(res => {
      setCustomer(res.customer)
      setOrders(res.orders)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-zinc-400">Yükleniyor...</p></div>
  if (!customer) return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-zinc-400">Müşteri bulunamadı</p></div>

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <button onClick={() => router.push('/customers')} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Müşterilere Dön
      </button>

      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
          <User className="h-8 w-8 text-zinc-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {customer.email}</span>
            {customer.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {customer.phone}</span>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Toplam Sipariş</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-white"><ShoppingCart className="h-5 w-5" /> {orders.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Toplam Harcama</p>
          <p className="mt-1 flex items-center gap-1 text-xl font-bold text-emerald-400"><DollarSign className="h-5 w-5" /> {orders.reduce((s: number, o: any) => s + Number(o.totalAmount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500">Kayıt Tarihi</p>
          <p className="mt-1 text-xl font-bold text-white">{new Date(customer.createdAt).toLocaleDateString('tr-TR')}</p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white">Sipariş Geçmişi</h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Henüz sipariş yok</p>
        ) : (
          <div className="mt-3 table-scroll">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="pb-3 font-medium">Sipariş No</th>
                  <th className="pb-3 font-medium">Tarih</th>
                  <th className="pb-3 font-medium">Durum</th>
                  <th className="pb-3 font-medium">Ödeme</th>
                  <th className="pb-3 font-medium text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                    <td className="py-3 font-mono text-xs text-white">{o.orderNumber}</td>
                    <td className="py-3 text-zinc-300">{new Date(o.createdAt).toLocaleDateString('tr-TR')}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] || 'bg-zinc-800 text-zinc-400'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-300">{o.paymentStatus || '—'}</td>
                    <td className="py-3 text-right font-medium text-white">{Number(o.totalAmount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
