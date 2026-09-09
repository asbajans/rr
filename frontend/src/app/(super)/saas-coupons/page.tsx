'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Plus, Pencil, Trash2, Ticket, Search } from 'lucide-react'

type CouponForm = {
  code: string
  discountType: 'percent'|'fixed'
  discountValue: string
  minimumAmount: string
  maxDiscount: string
  usageLimit: string
  perCustomerLimit: string
  startsAt: string
  endsAt: string
  isActive: boolean
  applicablePlanIds: string
  billingConstraint: string
}
const defaultForm: CouponForm = { code:'', discountType:'percent', discountValue:'10', minimumAmount:'0', maxDiscount:'', usageLimit:'', perCustomerLimit:'1', startsAt:'', endsAt:'', isActive:true, applicablePlanIds:'', billingConstraint:'first_cycle_only' }

export default function SaasCouponsPage(){
  const [coupons, setCoupons]=useState<any[]>([])
  const [loading, setLoading]=useState(true)
  const [search, setSearch]=useState('')
  const [showForm, setShowForm]=useState(false)
  const [editingId, setEditingId]=useState<number|null>(null)
  const [form, setForm]=useState<CouponForm>(defaultForm)
  const [message, setMessage]=useState('')
  const [plans, setPlans]=useState<any[]>([])

  const load = async()=>{
    setLoading(true)
    try{
      const r = await api.getSaasCoupons({ search: search||undefined } as any)
      setCoupons(r.coupons || r.data || [])
    }catch(e:any){ setMessage(e.message) }
    finally{ setLoading(false)}
  }
  useEffect(()=>{ load(); api.getAdminPlans().then(setPlans).catch(()=>{}) }, [])

  function openNew(){ setForm(defaultForm); setEditingId(null); setShowForm(true) }
  function openEdit(c:any){
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      minimumAmount: String(c.minimumAmount ?? 0),
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount):'',
      usageLimit: c.usageLimit != null ? String(c.usageLimit):'',
      perCustomerLimit: String(c.perCustomerLimit ?? 1),
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0,16):'',
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0,16):'',
      isActive: !!c.isActive,
      applicablePlanIds: Array.isArray(c.applicablePlanIds) ? c.applicablePlanIds.join(','):'',
      billingConstraint: c.billingConstraint || 'first_cycle_only',
    })
    setEditingId(c.id); setShowForm(true)
  }
  async function save(){
    setMessage('')
    try{
      const body:any = {
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        minimumAmount: form.minimumAmount? parseFloat(form.minimumAmount):0,
        maxDiscount: form.maxDiscount? parseFloat(form.maxDiscount): null,
        usageLimit: form.usageLimit? parseInt(form.usageLimit): null,
        perCustomerLimit: parseInt(form.perCustomerLimit||'1'),
        isActive: form.isActive,
        billingConstraint: form.billingConstraint,
      }
      if(form.startsAt) body.startsAt = new Date(form.startsAt).toISOString()
      if(form.endsAt) body.endsAt = new Date(form.endsAt).toISOString()
      if(form.applicablePlanIds.trim()){
        body.applicablePlanIds = form.applicablePlanIds.split(',').map(s=> parseInt(s.trim())).filter(n=> Number.isFinite(n))
      }
      if(editingId) await api.updateSaasCoupon(editingId, body)
      else await api.createSaasCoupon(body)
      setShowForm(false); load(); setMessage(editingId?'Güncellendi':'Oluşturuldu')
    }catch(e:any){ setMessage(e.message||'Hata') }
  }
  async function remove(id:number){
    if(!confirm('Silmek istediğine emin misin?')) return
    try{ await api.deleteSaasCoupon(id); load() }catch(e:any){ setMessage(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Ticket className="h-6 w-6" /> İndirim Kodları (SaaS)</h1>
          <p className="text-sm text-zinc-400">Paket satın alımda geçerli, tek seferlik indirim (sonraki ay tam fiyat).</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"><Plus className="h-4 w-4" /> Kod Ekle</button>
      </div>
      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-amber-400">{message}</div>}
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e=> setSearch(e.target.value)} onKeyDown={e=> e.key==='Enter' && load()} placeholder="Kod ara..." className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white" />
        </div>
        <button onClick={load} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Ara</button>
      </div>
      {loading ? <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p> : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-zinc-800 text-xs uppercase text-zinc-400"><th className="px-3 py-2">Kod</th><th className="px-3 py-2">İndirim</th><th className="px-3 py-2">Limit</th><th className="px-3 py-2">Tarih</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2 text-right">İşlem</th></tr></thead>
            <tbody>
              {coupons.map(c=>(
                <tr key={c.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                  <td className="px-3 py-3 font-mono text-white">{c.code}</td>
                  <td className="px-3 py-3 text-zinc-300">{c.discountType==='percent'? `%${c.discountValue}` : `${c.discountValue} ${c.currency||'TRY'}`} {c.maxDiscount? `(max ${c.maxDiscount})`:''}</td>
                  <td className="px-3 py-3 text-zinc-400">{c.usedCount ?? 0}/{c.usageLimit ?? '∞'} · müşteri başı {c.perCustomerLimit}</td>
                  <td className="px-3 py-3 text-xs text-zinc-500">{c.startsAt? new Date(c.startsAt).toLocaleDateString('tr-TR'):''} → {c.endsAt? new Date(c.endsAt).toLocaleDateString('tr-TR'):'∞'}</td>
                  <td className="px-3 py-3 text-xs text-zinc-400">{Array.isArray(c.applicablePlanIds) && c.applicablePlanIds.length ? c.applicablePlanIds.join(',') : 'Tümü'}</td>
                  <td className="px-3 py-3">{c.isActive ? <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">Aktif</span> : <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs">Pasif</span>}</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-1"><button onClick={()=>openEdit(c)} className="p-1 text-zinc-400 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={()=>remove(c.id)} className="p-1 text-zinc-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
              {coupons.length===0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-zinc-500">Kod yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=>setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-zinc-900 p-6" onClick={e=>e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">{editingId?'Kodu Düzenle':'Yeni Kod'}</h2>
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-zinc-400">Kod</label><input value={form.code} onChange={e=> setForm({...form, code: e.target.value.toUpperCase()})} placeholder="YAZ2026" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-mono text-white" /></div>
                <div><label className="text-xs text-zinc-400">Aktif</label><label className="mt-2 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.isActive} onChange={e=> setForm({...form, isActive: e.target.checked})} /> Aktif</label></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs text-zinc-400">Tip</label><select value={form.discountType} onChange={e=> setForm({...form, discountType: e.target.value as any})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"><option value="percent">Yüzde</option><option value="fixed">Sabit</option></select></div>
                <div><label className="text-xs text-zinc-400">Değer</label><input type="number" value={form.discountValue} onChange={e=> setForm({...form, discountValue: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
                <div><label className="text-xs text-zinc-400">Max İndirim</label><input type="number" value={form.maxDiscount} onChange={e=> setForm({...form, maxDiscount: e.target.value})} placeholder="opsiyonel" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-xs text-zinc-400">Min Tutar</label><input type="number" value={form.minimumAmount} onChange={e=> setForm({...form, minimumAmount: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
                <div><label className="text-xs text-zinc-400">Toplam Limit</label><input type="number" value={form.usageLimit} onChange={e=> setForm({...form, usageLimit: e.target.value})} placeholder="∞" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
                <div><label className="text-xs text-zinc-400">Müşteri Başı</label><input type="number" min={1} max={10} value={form.perCustomerLimit} onChange={e=> setForm({...form, perCustomerLimit: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-zinc-400">Başlangıç</label><input type="datetime-local" value={form.startsAt} onChange={e=> setForm({...form, startsAt: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark]" /></div>
                <div><label className="text-xs text-zinc-400">Bitiş</label><input type="datetime-local" value={form.endsAt} onChange={e=> setForm({...form, endsAt: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white [color-scheme:dark]" /></div>
              </div>
              <div><label className="text-xs text-zinc-400">Geçerli Planlar (ID virgülle, boş=Tümü) — Planlar: {plans.map(p=> `${p.id}:${p.name}`).join(', ')}</label><input value={form.applicablePlanIds} onChange={e=> setForm({...form, applicablePlanIds: e.target.value})} placeholder="örn 1,2" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /></div>
              <div><label className="text-xs text-zinc-400">Faturalandırma</label><select value={form.billingConstraint} onChange={e=> setForm({...form, billingConstraint: e.target.value})} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"><option value="first_cycle_only">Sadece ilk fatura</option><option value="once_per_customer">Müşteri başı 1 kez</option></select><p className="text-xs text-zinc-500">İndirim bir sefere mahsus uygulanır, sonraki ay tam fiyat çekilir.</p></div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={save} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-900">Kaydet</button>
              <button onClick={()=> setShowForm(false)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
