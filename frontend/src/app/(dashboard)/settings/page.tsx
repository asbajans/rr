'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Key, Plus, Trash2, Copy, Download, Globe, Server, Bell, Sparkles, Star, Tag, Loader2, ShieldCheck, CheckCircle2, XCircle, Lock, ExternalLink, Upload, Settings as SettingsIcon, AlertCircle, Info } from 'lucide-react'
import Link from 'next/link'

function VercelHostingPanel() {
  const [active, setActive] = useState<'zip' | 'token'>('zip')
  // --- shared ---
  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [manualDomain, setManualDomain] = useState('')
  const [mappingSaving, setMappingSaving] = useState(false)
  const [mappingMsg, setMappingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // --- token flow ---
  const [token, setToken] = useState('')
  const [teamId, setTeamId] = useState('')
  const [vercelCfg, setVercelCfg] = useState<{ hasToken: boolean; maskedToken: string | null; teamId: string | null } | null>(null)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployMsg, setDeployMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [deployment, setDeployment] = useState<any>(null)
  // --- domain (token flow) ---
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [domainState, setDomainState] = useState<{ domain: string | null; verified: boolean; url?: string | null; verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }> } | null>(null)

  useEffect(() => {
    api.getSettings().then(s => { if (s.site_url) setSiteUrlInput(s.site_url); if (s.domain) setManualDomain(s.domain); if (s.domain) setDomain(s.domain); }).catch(()=>{})
    api.getVercelConfig().then(setVercelCfg).catch(()=>{})
    api.getSiteDomain().then(d=> { setDomainState({ domain: d.domain, verified: d.verified, url: d.url ?? undefined, verification: d.verification }); if (d.domain) setDomain(d.domain) }).catch(()=>{})
  }, [])

  const handleManualSave = async () => {
    setMappingSaving(true); setMappingMsg(null)
    try {
      const r = await api.saveSiteMapping({ siteUrl: siteUrlInput.trim() || null, domain: manualDomain.trim().toLowerCase() || null })
      setMappingMsg({ type: 'success', text: `Kaydedildi — Site: ${r.siteUrl || '-'} | Domain: ${r.domain || '-'}` })
    } catch (e:any) { setMappingMsg({ type: 'error', text: e?.message || 'Kaydedilemedi' }) }
    finally { setMappingSaving(false) }
  }

  const handleSaveToken = async () => {
    if (!token.trim()) { setTokenMsg({ type: 'error', text: 'Token girin' }); return }
    setSavingToken(true); setTokenMsg(null)
    try {
      const r = await api.saveVercelConfig(token.trim(), teamId.trim() || null)
      setVercelCfg(r); setToken(''); setTokenMsg({ type: 'success', text: 'Token kaydedildi ve doğrulandı ✅' })
    } catch (e:any) { setTokenMsg({ type: 'error', text: e?.message || 'Token kaydedilemedi' }) }
    finally { setSavingToken(false) }
  }
  const handleClearToken = async () => {
    setSavingToken(true)
    try { await api.clearVercelConfig(); setVercelCfg({ hasToken: false, maskedToken: null, teamId: null }); setTokenMsg({ type: 'success', text: 'Token silindi' }) } catch (e:any){ setTokenMsg({ type:'error', text:e.message}) } finally{ setSavingToken(false)}
  }
  const handleDeploy = async () => {
    setDeploying(true); setDeployMsg(null)
    try {
      const r = await api.deployManagedSite('Vercel otomatik deploy')
      setDeployment(r.deployment); setDeployMsg({ type: r.deployment.providerStatus === 'pending' ? 'info' : 'success', text: r.deployment.providerStatus === 'pending' ? `Deploy başlatıldı (pending) — ID ${r.deployment.id}. Durum polling...` : `Deploy hazır: ${r.deployment.providerUrl}` })
      if (r.deployment.providerStatus === 'pending' && r.deployment.id) {
        let tries=0; const poll=setInterval(async()=>{ tries++; try{ const s=await api.getSiteDeploymentStatus(r.deployment.id); setDeployment(s.deployment); if(s.deployment.providerStatus!=='pending' || tries>20){ clearInterval(poll); setDeployMsg({ type: s.deployment.providerStatus==='ready'?'success':'error', text: s.deployment.providerStatus==='ready'? `Deploy hazır: ${s.deployment.providerUrl}` : `Durum: ${s.deployment.providerStatus} ${s.deployment.providerError||''}`})} }catch{ clearInterval(poll)} },4000)
      }
    } catch(e:any){ setDeployMsg({ type:'error', text:e?.message||'Deploy başarısız'}) } finally{ setDeploying(false)}
  }
  const handleAdd = async () => {
    const d = domain.trim().toLowerCase(); if (!d) return
    setLoading(true); setMsg(null)
    try { const r = await api.addSiteDomain(d); setDomainState({ domain: r.domain, verified: r.verified, url: r.url ?? undefined, verification: r.verification }); setMsg({ type:'success', text:'Domain eklendi. Vercel DNS doğrulamasını yap.'}) } catch(err:any){ setMsg({ type:'error', text:err?.message||'Domain eklenemedi'})} finally{ setLoading(false)}
  }
  const handleVerify = async () => {
    setLoading(true); setMsg(null)
    try { const r = await api.verifySiteDomain(); setDomainState(p=> p?{ ...p, verified:r.verified}:null); setMsg({ type:r.verified?'success':'error', text:r.verified?'Domain doğrulandı!':'Doğrulama bekliyor — DNS yayılımını bekle'}) } catch(err:any){ setMsg({ type:'error', text:err?.message||'Doğrulama yapılamadı'})} finally{ setLoading(false)}
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Tab switch */}
      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <button onClick={()=>setActive('zip')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${active==='zip'?'bg-white shadow text-zinc-900':'text-zinc-600 hover:text-zinc-900'}`}><Download className="mr-1 inline h-4 w-4"/>ZIP ile (Kendi Hesabın)</button>
        <button onClick={()=>setActive('token')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${active==='token'?'bg-white shadow text-zinc-900':'text-zinc-600 hover:text-zinc-900'}`}><Key className="mr-1 inline h-4 w-4"/>Token ile Otomatik</button>
      </div>

      {active==='zip' && (
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"/>
            <p className="text-sm text-zinc-700">Mağazanı <b>kendi Vercel hesabında</b> host et. ZIP'i indir, <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">vercel.com/new <ExternalLink className="h-3 w-3"/></a> üzerinden import et. Domainin ve faturan tamamen sende olur.</p>
          </div>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">1</span><div><b>ZIP'i indir</b> — mağazana özel API anahtarı ve HMAC config enjekte edilmiş.<br/><Button size="sm" className="mt-2" onClick={()=>api.downloadSlaveVercel()}><Download className="mr-1 h-3 w-3"/>Vercel ZIP İndir</Button></div></li>
            <li className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">2</span><div><b>Vercel'e yükle</b> — <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">vercel.com/new</a> → <i>Add New Project → Browse</i> → indirdiğin ZIP'i seç → <b>Deploy</b>. <span className="text-zinc-500">(~30 sn)</span><br/><a href="https://vercel.com/docs/getting-started" target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700">Vercel docs <ExternalLink className="h-3 w-3"/></a></div></li>
            <li className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">3</span><div><b>Domain ekle (opsiyonel)</b> — Vercel Dashboard → Project → <b>Settings → Domains</b> → kendi domainini ekle (örn. <code className="rounded bg-zinc-100 px-1">magaza.com.tr</code>). Vercel sana DNS kayıtlarını (CNAME / A) gösterecek — domain sağlayıcında ekle.</div></li>
            <li className="flex gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">4</span><div><b>Kontrol & Kaydet</b> — Vercel'in verdiği <code className="rounded bg-zinc-100 px-1">https://xxx.vercel.app</code> URL'ini ve eklediysen custom domaini aşağıya yapıştır, kaydet. Sistem mağazanı bu URL/domain üzerinden çözecek.</div></li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="block text-xs font-medium text-zinc-700">Vercel URL (https://xxx.vercel.app)</label><input type="text" value={siteUrlInput} onChange={e=>setSiteUrlInput(e.target.value)} placeholder="https://rahatio-xxx.vercel.app" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/></div>
            <div><label className="block text-xs font-medium text-zinc-700">Custom Domain (opsiyonel)</label><input type="text" value={manualDomain} onChange={e=>setManualDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g,''))} placeholder="magaza.com.tr" className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/></div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleManualSave} disabled={mappingSaving}>{mappingSaving?'Kaydediliyor...':'Kaydet & Eşleştir'}</Button>
            {siteUrlInput && <a href={siteUrlInput.startsWith('http')?siteUrlInput:`https://${siteUrlInput}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"><ExternalLink className="h-3 w-3"/>Test Et</a>}
          </div>
          {mappingMsg && <p className={`text-sm ${mappingMsg.type==='success'?'text-green-600':'text-red-600'}`}>{mappingMsg.text}</p>}
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="mr-1 inline h-3 w-3"/>Kontrol: Kaydettikten sonra <code className="rounded bg-white px-1">/{manualDomain || siteUrlInput || 'domain'}</code> storefront'unu yeni sekmede açıp ürünlerin geldiğini doğrula. Olmazsa Vercel logs → Runtime Logs kontrol et.</div>
        </div>
      )}

      {active==='token' && (
        <div className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-start gap-2">
            <SettingsIcon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"/>
            <p className="text-sm text-zinc-700">Vercel <b>kişisel tokenın</b> ile biz senin hesabına otomatik deploy edelim. Token sende kalır, dilediğinde silebilirsin. <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">vercel.com/account/tokens <ExternalLink className="h-3 w-3"/></a> → <b>Create Token</b> (scope: team seçiliyse Team ID de gir).</p>
          </div>

          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <label className="block text-xs font-medium text-zinc-700">Vercel Token <span className="font-normal text-zinc-500">(vercel_xxx)</span></label>
            <div className="flex gap-2">
              <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder={vercelCfg?.hasToken ? `Kayıtlı: ${vercelCfg.maskedToken}` : 'vercel_xxx...'} className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
              <Button size="sm" onClick={handleSaveToken} disabled={savingToken || !token.trim()}>{savingToken?'Doğrulanıyor...':'Kaydet & Doğrula'}</Button>
            </div>
            <div className="flex gap-2">
              <input type="text" value={teamId} onChange={e=>setTeamId(e.target.value)} placeholder="Team ID (opsiyonel, team kullanıyorsan)" className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
              {vercelCfg?.teamId && <span className="shrink-0 rounded bg-white px-2 py-1 text-xs text-zinc-600">Kayıtlı team: {vercelCfg.teamId}</span>}
            </div>
            {vercelCfg?.hasToken && <div className="flex items-center gap-2 text-xs text-green-700"><CheckCircle2 className="h-3 w-3"/>Kayıtlı token: {vercelCfg.maskedToken} <button onClick={handleClearToken} className="text-red-600 hover:underline">Sil</button></div>}
            {tokenMsg && <p className={`text-sm ${tokenMsg.type==='success'?'text-green-600':'text-red-600'}`}>{tokenMsg.text}</p>}
            <p className="text-xs text-zinc-500">Token oluştururken <b>Expiration: No Expiration</b> + scope: projenin ait olduğu Team seç. Token asla loglanmaz, sadece senin mağazana bağlı saklanır.</p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <h4 className="text-sm font-semibold text-zinc-900">1. Vercel'e Deploy Et</h4>
            <p className="mt-1 text-xs text-zinc-600">Token kayıtlıysa tek tıkla senin hesabında <code>rahatio-{`{siteCode}`}</code> projesi oluşturulur.</p>
            <Button size="sm" className="mt-3" onClick={handleDeploy} disabled={deploying || !vercelCfg?.hasToken}><Upload className="mr-1 h-3 w-3"/>{deploying?'Deploy ediliyor...':'Vercel’e Deploy Et'}</Button>
            {!vercelCfg?.hasToken && <p className="mt-2 text-xs text-amber-600">Önce token kaydet.</p>}
            {deployMsg && <p className={`mt-2 text-sm ${deployMsg.type==='success'?'text-green-600': deployMsg.type==='error'?'text-red-600':'text-indigo-600'}`}>{deployMsg.text}</p>}
            {deployment?.providerUrl && <a href={deployment.providerUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"><ExternalLink className="h-3 w-3"/>{deployment.providerUrl}</a>}
          </div>

          <div className="rounded-lg border border-zinc-200 p-4">
            <h4 className="text-sm font-semibold text-zinc-900">2. Custom Domain Ekle (opsiyonel)</h4>
            <div className="mt-2 flex gap-2">
              <input type="text" value={domain} onChange={e=>setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g,''))} placeholder="magaza.com.tr" className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/>
              <Button size="sm" onClick={handleAdd} disabled={loading || !domain.trim() || !deployment?.providerProjectId}>Ekle</Button>
              <Button size="sm" variant="outline" onClick={handleVerify} disabled={loading}>Doğrula</Button>
            </div>
            {!deployment?.providerProjectId && <p className="mt-2 text-xs text-zinc-500">Önce deploy etmelisin — proje ID ondan sonra oluşur.</p>}
            {msg && <p className={`mt-2 text-sm ${msg.type==='success'?'text-green-600':'text-red-600'}`}>{msg.text}</p>}
            {domainState?.verification && domainState.verification.length>0 && <div className="mt-3 rounded bg-zinc-50 p-3 text-xs"><p className="font-medium text-zinc-900">DNS kayıtları:</p>{domainState.verification.map((v,i)=><div key={i} className="font-mono">{v.type}: {v.domain} → {v.value} {v.reason?`(${v.reason})`:''}</div>)}</div>}
            {domainState?.verified && domainState.url && <a href={domainState.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"><Globe className="h-3.5 w-3.5"/>{domainState.url}</a>}
          </div>

          <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
            <p className="font-medium text-white"> Kontrol listesi (her iki yöntem için):</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Vercel Dashboard → Project → <b>Deployments</b> → son deployment <span className="text-emerald-400">Ready</span> mi?</li>
              <li>Project → <b>Settings → Domains</b> → domain <span className="text-emerald-400">Valid</span> mi? Değilse DNS’i ekle ve <b>Refresh</b> + bizde <b>Doğrula</b> butonuna bas.</li>
              <li>Mağaza ayarla → <code>siteUrl</code> Vercel URL’in, <code>domain</code> custom domainin ile eşleşmeli — yoksa API slave ile konuşamaz.</li>
              <li>Test: <code>https://senin-domain/api/health</code> → <code>status: ok</code> dönmeli.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { user, store, productLimit } = useAuth()
  const [storeSettings, setStoreSettings] = useState<Store | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [siteStatus, setSiteStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyPlain, setNewKeyPlain] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [aiCategories, setAiCategories] = useState<any[]>([])
  const [defaultAiCategoryId, setDefaultAiCategoryId] = useState<number | null>(null)
  const [aiCatLoading, setAiCatLoading] = useState(true)
  const [newCatName, setNewCatName] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [catCreating, setCatCreating] = useState(false)
  const [catGenerating, setCatGenerating] = useState<number | null>(null)
  const [catDeleting, setCatDeleting] = useState<number | null>(null)

  // Change password (self)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')

  const loadAiCategories = async () => {
    try {
      const r = await api.listAiCategories()
      setAiCategories(r.categories)
      setDefaultAiCategoryId(r.defaultCategoryId)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        setStoreSettings(s)
        setName(s.name)
        setEmail(s.email ?? '')
        setSiteCode(s.site_code ?? s.siteCode ?? '')
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    api.getAdminApiKeys()
      .then(setApiKeys)
      .catch(() => {})
      .finally(() => setKeysLoading(false))
  }, [])

  useEffect(() => {
    setAiCatLoading(true)
    loadAiCategories().finally(() => setAiCatLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!siteCode.trim()) {
      setSiteStatus('idle')
      return
    }
    const saved = storeSettings?.site_code ?? ''
    const timer = setTimeout(() => {
      const normalized = siteCode.trim().toLowerCase()
      if (!/^[a-z0-9-]{2,50}$/.test(normalized)) {
        setSiteStatus('invalid')
        return
      }
      if (normalized === saved.toLowerCase()) {
        setSiteStatus('available')
        return
      }
      setSiteStatus('checking')
      api.checkSiteCode(normalized)
        .then((r) => setSiteStatus(r.available ? 'available' : 'taken'))
        .catch(() => setSiteStatus('idle'))
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])

  if (!user) return null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const payload: any = { name, email }
      const current = (storeSettings?.site_code ?? '').toLowerCase()
      const next = siteCode.trim().toLowerCase()
      if (next && next !== current) payload.siteCode = next
      const updated = await api.updateSettings(payload)
      setStoreSettings(updated)
      setSiteCode(updated.site_code ?? next)
      setMessage('Ayarlar kaydedildi.')
    } catch (err) {
      const anyErr = err as any
      setMessage(anyErr?.message || 'Hata oluştu')
      if (anyErr?.status === 409) setSiteStatus('taken')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setNewKeyPlain('')
    try {
      const res = await api.createAdminApiKey({ name: newKeyName })
      setNewKeyPlain(res.plain_text)
      setApiKeys((prev) => [...prev, res.api_key])
      setNewKeyName('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'API anahtarı oluşturulamadı')
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteKey(id: number) {
    setDeleting(id)
    try {
      await api.deleteAdminApiKey(id)
      setApiKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setDeleting(null)
    }
  }

  async function handleCreateCategory() {
    if (!newCatName.trim()) return
    setCatCreating(true)
    try {
      await api.createAiCategory({ name: newCatName.trim(), autoGenerate })
      setNewCatName('')
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Kategori oluşturulamadı')
    } finally {
      setCatCreating(false)
    }
  }

  async function handleRegenerateAttributes(id: number) {
    setCatGenerating(id)
    try {
      await api.regenerateAiCategoryAttributes(id)
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Özellikler üretilemedi')
    } finally {
      setCatGenerating(null)
    }
  }

  async function handleSetDefault(id: number | null) {
    try {
      await api.setDefaultAiCategory(id)
      setDefaultAiCategoryId(id)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Varsayılan ayarlanamadı')
    }
  }

  async function handleDeleteCategory(id: number) {
    setCatDeleting(id)
    try {
      await api.deleteAiCategory(id)
      await loadAiCategories()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Silinemedi')
    } finally {
      setCatDeleting(null)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg('')
    setPwError('')
    if (!newPassword || newPassword.length < 8) {
      setPwError('Yeni şifre en az 8 karakter olmalı')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Yeni şifre ve tekrarı uyuşmuyor')
      return
    }
    setPwSaving(true)
    try {
      const res = await api.changePassword(currentPassword || undefined, newPassword)
      setPwMsg(res.message || 'Şifre başarıyla güncellendi')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Şifre değiştirilemedi')
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ayarlar</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza ayarlarını yönet.</p>
      <div className="mt-8 space-y-8">
          <div className="rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Profil</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p><span className="font-medium text-zinc-900">Ad:</span> {user.name}</p>
            <p><span className="font-medium text-zinc-900">E-posta:</span> {user.email}</p>
            <p><span className="font-medium text-zinc-900">AI Kredisi:</span> {user.ai_credits}</p>
          </div>
        </div>

        {store && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Plan</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p><span className="font-medium text-zinc-900">Plan:</span> {store.plan?.name ?? '—'}</p>
              <p><span className="font-medium text-zinc-900">Yayınlama:</span> {store.plan?.hosting === 'vercel' ? 'Vercel (Slave)' : store.plan?.hosting === 'custom' ? 'Kendi Sunucu' : 'Rahatio'}</p>
              <p><span className="font-medium text-zinc-900">Ürün Limiti:</span> {(store.plan?.product_limit ?? -1) < 0 ? 'Sınırsız' : store.plan?.product_limit ?? '-'}</p>
              <p><span className="font-medium text-zinc-900">AI Kredisi / Ay:</span> {store.plan?.ai_credits ?? '-'}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Şifre Değiştir</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Hesap şifrenizi güncelleyin. Google ile giriş yaptıysanız mevcut şifreyi boş bırakabilirsiniz.</p>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Mevcut Şifre</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Mevcut şifreniz (Google hesabı için boş bırakın)"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Yeni Şifre</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 8 karakter"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Yeni Şifre (Tekrar)</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Yeni şifreyi tekrar girin"
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            {pwError && <p className="text-sm text-red-600">{pwError}</p>}
            {pwMsg && <p className="text-sm text-green-600">{pwMsg}</p>}
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
            </Button>
          </form>
        </div>

        <Link href="/settings/notifications"
          className="flex items-center gap-3 rounded-xl border border-zinc-200 p-6 hover:bg-zinc-50 transition">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
            <Bell className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Bildirim Ayarları</h2>
            <p className="text-sm text-zinc-600">Email (SMTP) ve SMS (Twilio) ayarlarını yapılandırın</p>
          </div>
        </Link>

        {storeSettings && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Mağaza Ayarları</h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Mağaza Adı</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">İletişim E-postası</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-900">Mağaza Adresi</label>
                <div className="mt-1 flex items-stretch rounded-lg border border-zinc-300 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="flex items-center whitespace-nowrap rounded-l-lg bg-zinc-100 px-3 text-sm text-zinc-500">rahatio.com.tr/stores/</span>
                  <input
                    type="text"
                    value={siteCode}
                    onChange={(e) => setSiteCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="magaza-adin"
                    maxLength={50}
                    className="w-full rounded-r-lg px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {siteStatus === 'checking' && <span className="text-zinc-400">Kontrol ediliyor...</span>}
                  {siteStatus === 'available' && <span className="text-green-600">✓ Bu adres kullanılabilir.</span>}
                  {siteStatus === 'taken' && <span className="text-red-600">Bu adres başka bir mağaza tarafından kullanılıyor. Lütfen başka bir adres seçin.</span>}
                  {siteStatus === 'invalid' && <span className="text-red-600">Sadece küçük harf, rakam ve tire (-) kullanın (2-50 karakter).</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3">
                <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500">Mağaza Siten</p>
                  <a
                    href={storeSettings.domain ? `https://${storeSettings.domain}` : `https://rahatio.com.tr/stores/${siteCode}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block truncate text-sm text-indigo-600 hover:underline"
                  >
                    {storeSettings.domain ?? `rahatio.com.tr/stores/${siteCode}`}
                  </a>
                </div>
              </div>
              {message && <p className={`text-sm ${message.includes('kaydedildi') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving || siteStatus === 'taken' || siteStatus === 'invalid'}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </form>
          </div>
        )}

        {/* Vercel Hosting — decentralized: ZIP veya token */}
        {storeSettings && (storeSettings.plan?.hosting ?? store?.plan?.hosting) === 'vercel' && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-zinc-500" />
              <h2 className="text-lg font-semibold text-zinc-900">Vercel Yayınlama</h2>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Kendi hesabın</span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">
              Mağazanı kendi Vercel hesabında yayınla — iki yoldan birini seç. Domain ve fatura tamamen sende.
            </p>
            <VercelHostingPanel />
          </div>
        )}

        {/* Site URL (her hosting için) */}
        {storeSettings && (
          <div className="rounded-xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Site URL</h2>
            <div className="mt-4">
              <a
                href={storeSettings.domain ? `https://${storeSettings.domain}` : `https://rahatio.com.tr/stores/${siteCode}`}
                target="_blank" rel="noopener noreferrer"
                className="block truncate text-sm text-indigo-600 hover:underline"
              >
                {storeSettings.domain ?? `rahatio.com.tr/stores/${siteCode}`}
              </a>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">API Anahtarları</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Mağazana bağlanmak için API anahtarlarını yönet.</p>

          <div className="mt-4 flex items-center gap-2">
            <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Anahtar adı" maxLength={255}
              className="block w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <Button size="sm" onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              <Plus className="mr-1 h-3 w-3" />{creating ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>

          {newKeyPlain && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-medium text-green-700">Anahtar oluşturuldu! Bir kez gösterilir, kopyala:</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2 py-1 text-sm text-green-800">{newKeyPlain}</code>
                <button onClick={() => navigator.clipboard.writeText(newKeyPlain)}
                  className="rounded p-1 text-green-600 hover:bg-green-100">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {keysLoading && <p className="mt-3 text-sm text-zinc-400">Yükleniyor...</p>}
          {!keysLoading && apiKeys.length === 0 && (
            <p className="mt-3 text-sm text-zinc-400">Henüz API anahtarı oluşturulmamış.</p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">AI Kategorileri</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Ürün oluştururken AI'ın yönlendirileceği kategoriler. Her kategoriye özel özellik şeması otomatik üretilir; AI görseli analiz ederken ve başlık/açıklama yazarken bu şemayı kullanır. Varsayılan kategori, ürün oluşturma ekranında önceden seçili gelir.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-zinc-900">Yeni Kategori</label>
              <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                placeholder="örn. Oto Yedek Parça, Bebek Giyim..."
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-zinc-600">
              <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300" />
              Özellikleri AI ile otomatik üret (2 kredi)
            </label>
            <Button size="sm" onClick={handleCreateCategory} disabled={catCreating || !newCatName.trim()}>
              <Plus className="mr-1 h-3 w-3" />{catCreating ? 'Oluşturuluyor...' : 'Oluştur'}
            </Button>
          </div>

          {aiCatLoading && <p className="mt-4 text-sm text-zinc-400">Yükleniyor...</p>}
          {!aiCatLoading && aiCategories.length === 0 && (
            <p className="mt-4 text-sm text-zinc-400">Henüz kategori yok. Yukarıdan bir kategori oluştur.</p>
          )}
          {!aiCatLoading && aiCategories.length > 0 && (
            <div className="mt-4 space-y-3">
              {aiCategories.map((cat) => {
                const attrs = Array.isArray(cat.aiAttributes) ? cat.aiAttributes : []
                return (
                  <div key={cat.id} className={`rounded-lg border px-4 py-3 ${cat.isDefault ? 'border-indigo-300 bg-indigo-50/50' : 'border-zinc-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900">{cat.name}</span>
                        {cat.builtin && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Hazır</span>}
                        {cat.isDefault && (
                          <span className="flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                            <Star className="h-3 w-3" />Varsayılan
                          </span>
                        )}
                        <span className="text-xs text-zinc-400">{attrs.length} özellik</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!cat.isDefault && (
                          <button onClick={() => handleSetDefault(cat.id)}
                            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                            Varsayılan Yap
                          </button>
                        )}
                        {cat.builtin && <button onClick={() => handleSetDefault(null)}
                          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                          Varsayılan Kaldır
                        </button>}
                        <button onClick={() => handleRegenerateAttributes(cat.id)} disabled={catGenerating === cat.id}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
                          {catGenerating === cat.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-violet-500" />}
                          Özellik Üret
                        </button>
                        {!cat.builtin && (
                          <button onClick={() => handleDeleteCategory(cat.id)} disabled={catDeleting === cat.id}
                            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {attrs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {attrs.map((a: any, i: number) => (
                          <span key={i} title={a.description || a.name}
                            className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                            {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Slave Node</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Mağazanı kendi sunucunda çalıştırmak için slave yazılımını indir.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <Server className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">PHP (Paylaşımlı Hosting)</h3>
              <p className="mt-1 text-xs text-zinc-500">
                cPanel, FTP veya herhangi bir PHP hosting için tek dosya.
                İndir → FTP'ye yükle → Çalışmaya başla.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => api.downloadSlavePhp()}
                disabled={apiKeys.length === 0}
              >
                <Download className="mr-1 h-3 w-3" />İndir (PHP)
              </Button>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Globe className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">Vercel (Serverless)</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Vercel'e tek tıkla deploy. Ücretsiz, otomatik ölçeklenir.
                GitHub bağla veya ZIP yükle.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => api.downloadSlaveVercel()}
                disabled={apiKeys.length === 0}
              >
                <Download className="mr-1 h-3 w-3" />İndir (Vercel ZIP)
              </Button>
            </div>
          </div>
          {apiKeys.length === 0 && (
            <p className="mt-3 text-xs text-amber-600">Önce bir API anahtarı oluşturmalısın.</p>
          )}
          {!keysLoading && apiKeys.length > 0 && (
            <div className="mt-3 space-y-2">
              {apiKeys.map((ak) => (
                <div key={ak.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{ak.name}</p>
                    <p className="text-xs text-zinc-400">
                      {ak.last_used_at ? `Son: ${new Date(ak.last_used_at).toLocaleDateString('tr-TR')}` : 'Hiç kullanılmadı'}
                      {' · '}ID: {ak.id}
                    </p>
                  </div>
                  <button onClick={() => handleDeleteKey(ak.id)} disabled={deleting === ak.id}
                    className="rounded p-1 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Tehlikeli Bölge</h2>
          </div>
          <p className="mt-1 text-sm text-red-700">
            Hesabınızı ve verilerinizi silme talebi. Bu işlem 3 ayrı onayla hesabınızı pasife alır; tekrar giriş yapamazsınız.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/deletemyaccount">
              <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <Trash2 className="mr-1 h-3 w-3" /> Hesabımı Sil — deletemyaccount
              </Button>
            </Link>
            <span className="text-xs text-red-600">rahatio.com.tr/deletemyaccount</span>
          </div>
          <p className="mt-2 text-xs text-red-600">
            KVKK m.11 / Gizlilik Politikası kapsamında silme hakkınız. Talebiniz derhâl işlenir; yasal saklama süresi (fatura/VUK) sonunda veriler silinir.
          </p>
        </div>
      </div>
    </div>
  )
}
