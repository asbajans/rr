'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'

export default function StoreCustomerAccountPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [register, setRegister] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.customerMe(siteCode).then((r) => { setCustomer(r.customer); return api.customerOrders(siteCode) }).then((r) => setOrders(r.orders || [])).catch(() => setCustomer(null))
  useEffect(() => { load() }, [siteCode])

  async function submit(e: FormEvent) {
    e.preventDefault(); setError('')
    try {
      const result = register ? await api.customerRegister(siteCode, { email, password, name }) : await api.customerLogin(siteCode, { email, password })
      api.setCustomerToken(result.accessToken); setCustomer(result.customer); setOrders([])
      api.customerOrders(siteCode).then((r) => setOrders(r.orders || []))
    } catch (err: any) { setError(err.message || 'İşlem başarısız') }
  }

  if (!customer) return <main className="mx-auto max-w-md px-4 py-12"><h1 className="text-2xl font-bold">{register ? 'Hesap oluştur' : 'Müşteri girişi'}</h1><form onSubmit={submit} className="mt-6 space-y-4"><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta" className="w-full rounded border p-3" /><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" className="w-full rounded border p-3" />{register && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad soyad" className="w-full rounded border p-3" />} {error && <p className="text-sm text-red-600">{error}</p>}<button className="w-full rounded bg-indigo-600 p-3 font-medium text-white">{register ? 'Kayıt ol' : 'Giriş yap'}</button></form><button onClick={() => setRegister(!register)} className="mt-4 text-sm text-indigo-600">{register ? 'Zaten hesabım var' : 'Yeni hesap oluştur'}</button></main>

  return <main className="mx-auto max-w-4xl px-4 py-12"><div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Hesabım</h1><p className="text-sm text-zinc-500">{customer.name} · {customer.email}</p></div><button onClick={() => { api.setCustomerToken(null); setCustomer(null) }} className="text-sm text-red-600">Çıkış yap</button></div><section className="mt-8"><h2 className="text-lg font-semibold">Siparişlerim</h2>{orders.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Henüz siparişiniz yok.</p> : <div className="mt-3 space-y-3">{orders.map((o) => <div key={o.id} className="rounded border p-4"><div className="flex justify-between"><span className="font-medium">{o.orderNumber}</span><span>{o.status}</span></div><p className="mt-1 text-sm text-zinc-500">{o.totalAmount} {o.currency}</p></div>)}</div>}</section></main>
}
