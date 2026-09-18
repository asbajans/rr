'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Globe, Plus, Trash2, RefreshCw, Copy, Check, AlertTriangle, Server } from 'lucide-react'

type Props = { domain: string }

export default function DnsManager({ domain }: Props) {
  const [zone, setZone] = useState<{ zoneId: string | null; zoneStatus: string; nameServers: string[] | null } | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ type: 'CNAME', name: '', content: '', ttl: 3600, proxied: false })

  const loadZone = async () => {
    try {
      const z = await api.getDomainZone(domain)
      setZone(z)
      return z
    } catch (e: any) {
      setMsg(e.message)
      return null
    }
  }

  const loadRecords = async () => {
    try {
      const r = await api.listDomainDns(domain)
      setRecords(r.records || [])
      setMsg(null)
    } catch (e: any) {
      if (e.message?.includes('NO_ZONE') || e.message?.includes('Zone yok')) {
        setRecords([])
      } else setMsg(e.message)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadZone().then((z) => {
      if (z?.zoneId) loadRecords().finally(() => setLoading(false))
      else setLoading(false)
    })
  }, [domain])

  const handleCreateZone = async () => {
    setCreating(true); setMsg(null)
    try {
      const z = await api.createDomainZone(domain)
      setZone(z)
      setMsg(`Zone oluşturuldu — NS: ${z.nameServers?.join(', ')}`)
      await loadRecords()
    } catch (e: any) { setMsg(e.message) } finally { setCreating(false) }
  }

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content.trim()) { setMsg('Ad ve değer gerekli'); return }
    setCreating(true)
    try {
      await api.createDomainDns(domain, { ...form, name: form.name.trim(), content: form.content.trim() })
      setForm({ type: 'CNAME', name: '', content: '', ttl: 3600, proxied: false })
      await loadRecords()
      setMsg('Kayıt eklendi')
    } catch (e: any) { setMsg(e.message) } finally { setCreating(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Kayıt silinsin mi?')) return
    try { await api.deleteDomainDns(domain, id); await loadRecords() } catch (e: any) { setMsg(e.message) }
  }

  if (loading) return <p className="text-sm text-zinc-400">Yükleniyor...</p>

  // No zone yet — show NS transfer option + CNAME-only option
  if (!zone?.zoneId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-zinc-900">Seçenek 1: Hızlı (NS taşımadan)</h4>
          <p className="mt-1 text-xs text-zinc-600">Mevcut DNS sağlayıcınızda (metunic) sadece <code className="rounded bg-zinc-100 px-1 font-mono">www CNAME → customers.rahatio.com.tr</code> ekleyin ve <code>@ → www</code> yönlendirme yapın. Panelden başka ayar gerekmez.</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <h4 className="text-sm font-semibold text-zinc-900">Seçenek 2: DNS’i bize taşıyın (tam kontrol)</h4>
          <p className="mt-1 text-xs text-zinc-600">Tüm DNS’i panelden yönetmek (mail MX, TXT, alt domainler) için NS’i Cloudflare’e taşıyın. Aşağıdan zone oluşturun, verilen NS’leri metunic’teki NS kayıtlarıyla değiştirin.</p>
          <Button size="sm" className="mt-3" onClick={handleCreateZone} disabled={creating}>{creating ? 'Oluşturuluyor...' : 'Zone Oluştur (NS al)'}</Button>
          {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <p className="font-medium">Zone aktif: {zone.zoneId.slice(0, 8)}... | NS: {zone.nameServers?.join(', ')}</p>
        <p className="mt-1 text-[11px] text-emerald-700">DNS artık buradan yönetiliyor. Aşağıdan A/CNAME/MX/TXT ekleyebilirsiniz. SaaS CNAME (`customers`) sistem tarafından korunur.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-900"><Server className="h-4 w-4" />Kayıt Ekle</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded-lg border border-zinc-300 px-2 py-2 text-sm">
            <option>CNAME</option><option>A</option><option>TXT</option><option>MX</option><option>AAAA</option>
          </select>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ad (www, @, mail)" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          <input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Değer" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={handleCreate} disabled={creating}><Plus className="mr-1 h-3 w-3" />Ekle</Button>
          <Button size="sm" variant="outline" onClick={loadRecords}><RefreshCw className="mr-1 h-3 w-3" />Yenile</Button>
        </div>
        {msg && <p className="mt-2 text-xs text-zinc-600">{msg}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr><th className="px-3 py-2">Tür</th><th className="px-3 py-2">Ad</th><th className="px-3 py-2">Değer</th><th className="px-3 py-2">TTL</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {records.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-400">Kayıt yok</td></tr> :
              records.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.type}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{r.content}</td>
                  <td className="px-3 py-2 text-xs">{r.ttl}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => handleDelete(r.id)} className="rounded p-1 text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
