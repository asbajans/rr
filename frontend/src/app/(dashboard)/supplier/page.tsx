'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api, API_BASE } from '@/lib/api-client'
import { CardSkeleton, EmptyState } from '@/components/ui/skeleton'
import { Building2, Truck, Wallet, PackageCheck, XCircle, ArrowUpRight, CheckCircle2, RefreshCw, Pencil, FileText, ExternalLink, Upload } from 'lucide-react'

type Tab = 'profile' | 'orders' | 'settlements'

const docFields = [
  { key: 'taxDocument', label: 'Vergi Levhası', required: true },
  { key: 'signatureDocument', label: 'İmza Sirküleri', required: true },
  { key: 'tradeRegistryDocument', label: 'Ticaret Sicil Gazetesi (varsa)', required: false },
] as const

const applyBadge = (s?: string) => {
  const map: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    submitted: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
  }
  return map[s || 'draft'] || 'bg-zinc-100 text-zinc-600'
}

const applyLabel = (s?: string) => {
  const map: Record<string, string> = {
    draft: 'Başvuru yok',
    submitted: 'Onay bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
  }
  return map[s || 'draft'] || s || '—'
}

function absUrl(url?: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_BASE}${url}`
}

const fmt = (n: number | string | null | undefined) =>
  n === null || n === undefined ? '—' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-zinc-100 text-zinc-600',
    confirmed: 'bg-blue-50 text-blue-700',
    accepted: 'bg-emerald-50 text-emerald-700',
    fulfilled: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-50 text-red-700',
    shipped: 'bg-indigo-50 text-indigo-700',
    delivered: 'bg-green-50 text-green-700',
    returned: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700',
    open: 'bg-zinc-100 text-zinc-600',
    requested: 'bg-amber-50 text-amber-700',
    paid: 'bg-emerald-50 text-emerald-700',
  }
  return map[s] || 'bg-zinc-100 text-zinc-600'
}

export default function SupplierPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  // Profile
  const [profile, setProfile] = useState<any>(null)
  const [profileForm, setProfileForm] = useState<any>({})
  const [editingProfile, setEditingProfile] = useState(false)

  // Application
  const [applicationForm, setApplicationForm] = useState<Record<string, { name: string; url: string } | null>>({
    taxDocument: null,
    signatureDocument: null,
    tradeRegistryDocument: null,
  })
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  // Orders
  const [orders, setOrders] = useState<any[]>([])
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotal, setOrdersTotal] = useState(0)

  // Settlements
  const [settlements, setSettlements] = useState<any[]>([])
  const [period, setPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [periodData, setPeriodData] = useState<any>(null)

  const loadProfile = useCallback(async () => {
    try {
      const r = await api.getSupplierProfile()
      setProfile(r.supplier)
      setProfileForm({
        name: r.supplier.name || '', email: r.supplier.email || '', phone: r.supplier.phone || '',
        taxId: r.supplier.taxId || '', bankName: r.supplier.bankName || '', iban: r.supplier.iban || '',
        bankOwner: r.supplier.bankOwner || '', commissionRate: Number(r.supplier.commissionRate || 0),
        payoutMethod: r.supplier.payoutMethod || 'bank',
      })
      const docs = r.supplier.applicationDocuments || {}
      const docUrl = (url?: string) => url ? { name: url.split('/').pop() || 'Dosya', url } : null
      setApplicationForm({
        taxDocument: docUrl(docs.taxDocument),
        signatureDocument: docUrl(docs.signatureDocument),
        tradeRegistryDocument: docUrl(docs.tradeRegistryDocument),
      })
    } catch { /* ignore */ }
  }, [])

  const loadOrders = useCallback(async () => {
    const r = await api.getSupplierOrders({ page: ordersPage, limit: 20 })
    setOrders(r.orders)
    setOrdersTotal(r.pagination.total)
  }, [ordersPage])

  const loadSettlements = useCallback(async () => {
    const r = await api.getSupplierSettlements({ page: 1, limit: 50 })
    setSettlements(r.settlements)
  }, [])

  const loadPeriod = useCallback(async () => {
    try {
      const r = await api.getSupplierSettlementPeriod(period)
      setPeriodData(r)
    } catch { setPeriodData(null) }
  }, [period])

  useEffect(() => { setLoading(true); Promise.all([loadProfile()]).finally(() => setLoading(false)) }, [loadProfile])

  useEffect(() => {
    if (tab === 'orders') loadOrders().catch(() => {})
    if (tab === 'settlements') { loadSettlements(); loadPeriod() }
  }, [tab, loadOrders, loadSettlements, loadPeriod])

  async function saveProfile() {
    setSaving(true); setMessage('')
    try {
      const r = await api.updateSupplierProfile(profileForm)
      setProfile(r.supplier)
      setMessage('Profil güncellendi')
      setEditingProfile(false)
    } catch (err: any) { setMessage(err.message || 'Hata') }
    finally { setSaving(false) }
  }

  async function uploadDoc(key: string, file: File) {
    setUploadingDoc(key); setMessage('')
    try {
      const uploaded = await api.uploadImage(file)
      setApplicationForm((prev) => ({ ...prev, [key]: { name: file.name, url: uploaded.url } }))
    } catch (err: any) { setMessage(err.message || 'Yükleme hatası') }
    finally { setUploadingDoc(null) }
  }

  async function submitApplication() {
    const missing = docFields.filter((d) => d.required && !applicationForm[d.key]?.url)
    if (missing.length > 0) {
      setMessage(`Zorunlu belge: ${missing.map((d) => d.label).join(', ')}`)
      return
    }
    setApplying(true); setMessage('')
    try {
      await api.applySupplierApplication({
        taxDocument: applicationForm.taxDocument?.url,
        signatureDocument: applicationForm.signatureDocument?.url,
        tradeRegistryDocument: applicationForm.tradeRegistryDocument?.url,
      })
      setMessage('Başvuru gönderildi')
      loadProfile()
    } catch (err: any) { setMessage(err.message || 'Başvuru gönderilemedi') }
    finally { setApplying(false) }
  }

  async function runAction(fn: () => Promise<any>, okMsg: string) {
    setSaving(true); setMessage('')
    try { await fn(); setMessage(okMsg); loadOrders() }
    catch (err: any) { setMessage(err.message || 'Hata') }
    finally { setSaving(false) }
  }

  async function requestSettlement() {
    setSaving(true); setMessage('')
    try {
      await api.requestSupplierSettlement(period)
      setMessage('Hakediş talebi gönderildi')
      loadSettlements(); loadPeriod()
    } catch (err: any) { setMessage(err.message || 'Hata') }
    finally { setSaving(false) }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tedarikçi Paneli</h1>
          <p className="mt-1 text-sm text-zinc-600">Gelen siparişleri onayla, kargola ve hakedişlerini takip et.</p>
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1">
        {([
          { key: 'profile', label: 'Profil', icon: Building2 },
          { key: 'orders', label: 'Gelen Siparişler', icon: Truck },
          { key: 'settlements', label: 'Hakedişler', icon: Wallet },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium ${tab === t.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {message && <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      {loading ? <div className="mt-8"><CardSkeleton count={3} /></div> : (
        <>
          {tab === 'profile' && (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-1">
                <h2 className="text-sm font-semibold text-zinc-900">Mağaza Profili</h2>
                <p className="mt-1 text-xs text-zinc-500">Tedarikçi olarak görünen bilgilerin.</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Başvuru</dt>
                    <dd><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${applyBadge(profile?.applicationStatus)}`}>{applyLabel(profile?.applicationStatus)}</span></dd>
                  </div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Sözleşme</dt><dd className="capitalize font-medium text-zinc-900">{profile?.contractStatus || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Komisyon</dt><dd className="font-medium text-zinc-900">%{fmt(profile?.commissionRate)}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">Ödeme</dt><dd className="capitalize font-medium text-zinc-900">{profile?.payoutMethod || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="text-zinc-500">IBAN</dt><dd className="font-medium text-zinc-900 font-mono text-xs">{profile?.iban || '—'}</dd></div>
                </dl>
                {profile?.rejectionNote && (
                  <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{profile.rejectionNote}</p>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
                {!editingProfile ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-zinc-900">Profil Bilgileri</h2>
                      <button onClick={() => setEditingProfile(true)}
                        className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                        <Pencil className="h-3 w-3" /> Profil Düzenle
                      </button>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                      {([
                        { k: 'name', label: 'Ad / Firma' },
                        { k: 'email', label: 'E-posta' },
                        { k: 'phone', label: 'Telefon' },
                        { k: 'taxId', label: 'Vergi No' },
                        { k: 'bankName', label: 'Banka' },
                        { k: 'iban', label: 'IBAN' },
                        { k: 'bankOwner', label: 'IBAN Sahibi' },
                      ] as const).map((f) => (
                        <div key={f.k} className="flex justify-between">
                          <dt className="text-zinc-500">{f.label}</dt>
                          <dd className="font-medium text-zinc-900">{profileForm[f.k] || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-zinc-900">Profil Düzenle</h2>
                      <button onClick={() => setEditingProfile(false)} className="text-xs text-zinc-500 hover:text-zinc-700">İptal</button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {([
                        { k: 'name', label: 'Ad / Firma' },
                        { k: 'email', label: 'E-posta' },
                        { k: 'phone', label: 'Telefon' },
                        { k: 'taxId', label: 'Vergi No' },
                        { k: 'bankName', label: 'Banka' },
                        { k: 'iban', label: 'IBAN' },
                        { k: 'bankOwner', label: 'IBAN Sahibi' },
                      ] as const).map((f) => (
                        <div key={f.k}>
                          <label className="block text-xs font-medium text-zinc-700">{f.label}</label>
                          <input value={profileForm[f.k] ?? ''} onChange={e => setProfileForm({ ...profileForm, [f.k]: e.target.value })}
                            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700">Komisyon (%)</label>
                        <input type="number" min={0} max={100} value={profileForm.commissionRate}
                          onChange={e => setProfileForm({ ...profileForm, commissionRate: Number(e.target.value) || 0 })}
                          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700">Ödeme Yöntemi</label>
                        <select value={profileForm.payoutMethod} onChange={e => setProfileForm({ ...profileForm, payoutMethod: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                          <option value="bank">Banka Havalesi</option>
                          <option value="manual">Manuel</option>
                        </select>
                      </div>
                    </div>
                    <button onClick={saveProfile} disabled={saving}
                      className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-3">
                <h2 className="text-sm font-semibold text-zinc-900">Onay Başvurusu</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {profile?.applicationStatus === 'approved'
                    ? 'Tedarikçi başvurunuz onaylandı.'
                    : profile?.applicationStatus === 'submitted'
                      ? 'Başvurunuz süper admin onayına gönderildi. Belgeleri güncelleyip yeniden gönderebilirsiniz.'
                      : profile?.applicationStatus === 'rejected'
                        ? 'Başvurunuz reddedildi. Belgeleri düzenleyip yeniden başvurun.'
                        : 'Vergi levhası, imza sirküleri ve varsa ticaret sicil gazetesini yükleyerek tedarikçi onayı için başvuru yapın.'}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {docFields.map((d) => {
                    const uploaded = applicationForm[d.key]
                    return (
                      <div key={d.key}>
                        <label className="block text-xs font-medium text-zinc-700">{d.label}{d.required ? ' *' : ''}</label>
                        <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-xs">
                          <span className={uploaded ? 'truncate font-medium text-emerald-700' : 'text-zinc-500'}>
                            {uploaded ? `✓ ${uploaded.name}` : uploadingDoc === d.key ? 'Yükleniyor...' : 'Dosya seç'}
                          </span>
                          <Upload className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <input type="file" accept="image/*,.pdf" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(d.key, f) }} />
                        </label>
                        {uploaded && (
                          <a href={absUrl(uploaded.url)} target="_blank" rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:text-sky-500">
                            <FileText className="h-3 w-3" /> Görüntüle <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={submitApplication} disabled={applying}
                  className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                  {applying ? 'Gönderiliyor...' : profile?.applicationStatus === 'submitted' ? 'Başvuruyu Güncelle' : profile?.applicationStatus === 'rejected' ? 'Yeniden Başvur' : 'Başvuruyu Gönder'}
                </button>
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white">
              {orders.length === 0 ? (
                <EmptyState icon={<PackageCheck className="h-6 w-6" />} title="Gelen sipariş yok"
                  description="Tedarikçi olduğunda B2B klon siparişleri burada görünür." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 text-sm">
                    <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                      <tr>
                        <th className="px-4 py-3">Sipariş</th>
                        <th className="px-4 py-3">Tutar</th>
                        <th className="px-4 py-3">Kazanç</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="px-4 py-3">Takip</th>
                        <th className="px-4 py-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900">{o.order_number || o.orderNumber}</div>
                            <div className="text-xs text-zinc-400">{o.marketplace} · {new Date(o.createdAt || o.created_at).toLocaleDateString('tr-TR')}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-600">{fmt(o.totalAmount)} {o.currency || 'TRY'}</td>
                          <td className="px-4 py-3 font-medium text-emerald-700">{fmt(o.supplierEarnings ?? (Number(o.totalAmount || 0) - Number(o.commissionAmount || 0)))}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge(o.supplierStatus || o.status)}`}>
                              {o.supplierStatus || o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500">{o.trackingNumber || o.tracking_number || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {(o.supplierStatus === 'pending' || !o.supplierStatus) && (
                              <div className="flex justify-end gap-1">
                                <button onClick={() => runAction(() => api.supplierAcceptOrder(o.id), 'Sipariş onaylandı')} disabled={saving}
                                  className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                                  <CheckCircle2 className="h-3 w-3" /> Onayla
                                </button>
                                <button onClick={() => runAction(() => api.supplierRejectOrder(o.id), 'Sipariş reddedildi')} disabled={saving}
                                  className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50">
                                  <XCircle className="h-3 w-3" /> Reddet
                                </button>
                              </div>
                            )}
                            {(o.supplierStatus === 'accepted' || o.supplierStatus === 'pending') && (
                              <button onClick={() => {
                                const tn = prompt('Kargo takip numarası:')
                                if (tn) runAction(() => api.supplierShipOrder(o.id, tn), 'Kargolandı')
                              }} disabled={saving}
                                className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                                <Truck className="h-3 w-3" /> Kargola
                              </button>
                            )}
                            {o.supplierStatus === 'fulfilled' && (
                              <button onClick={() => runAction(() => api.supplierReturnOrder(o.id), 'İade alındı')} disabled={saving}
                                className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                                <ArrowUpRight className="h-3 w-3" /> İade Al
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ordersTotal > 20 && (
                <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
                  <span>{ordersTotal} sipariş</span>
                  <div className="flex gap-1">
                    <button onClick={() => setOrdersPage(p => Math.max(1, p - 1))} className="rounded border px-2 py-1">Önceki</button>
                    <button onClick={() => setOrdersPage(p => p + 1)} className="rounded border px-2 py-1">Sonraki</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'settlements' && (
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Dönem Hakedişi</h2>
                  <div className="flex gap-2">
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                    <button onClick={loadPeriod} className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-600 hover:bg-zinc-50"><RefreshCw className="h-4 w-4" /></button>
                  </div>
                </div>

                {periodData && (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-zinc-50 p-3"><div className="text-[10px] uppercase text-zinc-500">Toplam</div><div className="mt-1 text-lg font-bold text-zinc-900">{fmt(periodData.computation.totalAmount)} ₺</div></div>
                      <div className="rounded-lg bg-zinc-50 p-3"><div className="text-[10px] uppercase text-zinc-500">Komisyon</div><div className="mt-1 text-lg font-bold text-zinc-600">{fmt(periodData.computation.commissionAmount)} ₺</div></div>
                      <div className="rounded-lg bg-emerald-50 p-3"><div className="text-[10px] uppercase text-emerald-600">Net Kazanç</div><div className="mt-1 text-lg font-bold text-emerald-700">{fmt(periodData.computation.netAmount)} ₺</div></div>
                    </div>

                    {periodData.computation.orderCount === 0 ? (
                      <p className="mt-4 text-sm text-zinc-500">Bu dönemde kargolanmış sipariş yok.</p>
                    ) : (
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full divide-y divide-zinc-100 text-sm">
                          <thead className="text-left text-xs uppercase text-zinc-500">
                            <tr><th className="px-3 py-2">Sipariş</th><th className="px-3 py-2">Toplam</th><th className="px-3 py-2">Komisyon</th><th className="px-3 py-2">Net</th></tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {periodData.lines.map((l: any) => (
                              <tr key={l.id}>
                                <td className="px-3 py-2 text-zinc-700">{l.orderNumber}</td>
                                <td className="px-3 py-2">{fmt(l.totalAmount)}</td>
                                <td className="px-3 py-2">{fmt(l.commissionAmount)}</td>
                                <td className="px-3 py-2 font-medium text-emerald-700">{fmt(l.netAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="mt-5 flex items-center gap-3">
                      {periodData.settlement?.status === 'requested' ? (
                        <>
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Talep edildi</span>
                          <button onClick={() => runAction(() => api.cancelSupplierSettlement(periodData.settlement.id), 'Talep iptal edildi')} disabled={saving}
                            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">İptal Et</button>
                        </>
                      ) : periodData.settlement?.status === 'paid' ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Ödendi{periodData.settlement.payoutRef ? ` · ${periodData.settlement.payoutRef}` : ''}
                        </span>
                      ) : (
                        <button onClick={requestSettlement} disabled={saving || periodData.computation.orderCount === 0}
                          className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                          {saving ? 'Gönderiliyor...' : 'Hakediş Talep Et'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-zinc-900">Ödeme Geçmişi</h2>
                <div className="mt-3 space-y-2">
                  {settlements.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                      <div>
                        <div className="text-xs font-medium text-zinc-900">{s.period}</div>
                        <div className="text-[10px] text-zinc-500">{s.orderCount} sipariş</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-emerald-700">{fmt(s.netAmount)} ₺</div>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${statusBadge(s.status)}`}>{s.status}</span>
                      </div>
                    </div>
                  ))}
                  {settlements.length === 0 && <p className="text-sm text-zinc-500">Henüz ödeme kaydı yok.</p>}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
