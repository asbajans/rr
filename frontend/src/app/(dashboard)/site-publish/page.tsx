'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Globe, Download, Server, Rocket, Link2, ExternalLink, Key, Upload, Settings as SettingsIcon, AlertCircle, Info, CheckCircle2, Trash2 } from 'lucide-react'

// ── VercelHostingPanel — extracted from settings (supports both ZIP & Token flows) ──
function VercelHostingPanel() {
  const [active, setActive] = useState<'zip' | 'token'>('zip')
  const [siteUrlInput, setSiteUrlInput] = useState('')
  const [manualDomain, setManualDomain] = useState('')
  const [mappingSaving, setMappingSaving] = useState(false)
  const [mappingMsg, setMappingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [token, setToken] = useState('')
  const [teamId, setTeamId] = useState('')
  const [vercelCfg, setVercelCfg] = useState<{ hasToken: boolean; maskedToken: string | null; teamId: string | null } | null>(null)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployMsg, setDeployMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [deployment, setDeployment] = useState<any>(null)
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
    <div className="space-y-6">
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
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="mr-1 inline h-3 w-3"/>Kontrol: Kaydettikten sonra storefront'unu yeni sekmede açıp ürünlerin geldiğini doğrula. Olmazsa Vercel logs → Runtime Logs kontrol et.</div>
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
            <p className="mt-1 text-xs text-zinc-600">Token kayıtlıysa tek tıkla senin hesabında <code>rahatio-{'{siteCode}'}</code> projesi oluşturulur.</p>
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

export default function SitePublishPage() {
  const { user, store } = useAuth()
  const [storeSettings, setStoreSettings] = useState<any>(null)
  const [siteCode, setSiteCode] = useState('')
  const [siteStatus, setSiteStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)

  useEffect(() => {
    api.getSettings().then(s => { setStoreSettings(s); setSiteCode(s.site_code ?? s.siteCode ?? '') }).catch(()=>{})
    api.getAdminApiKeys().then(setApiKeys).catch(()=>{}).finally(()=> setKeysLoading(false))
  }, [])

  useEffect(() => {
    if (!siteCode.trim()) { setSiteStatus('idle'); return }
    const saved = storeSettings?.site_code ?? ''
    const timer = setTimeout(() => {
      const normalized = siteCode.trim().toLowerCase()
      if (!/^[a-z0-9-]{2,50}$/.test(normalized)) { setSiteStatus('invalid'); return }
      if (normalized === saved.toLowerCase()) { setSiteStatus('available'); return }
      setSiteStatus('checking')
      api.checkSiteCode(normalized).then(r => setSiteStatus(r.available ? 'available' : 'taken')).catch(()=> setSiteStatus('idle'))
    }, 400)
    return () => clearTimeout(timer)
  }, [siteCode, storeSettings])

  if (!user) return null

  const handleSaveSiteCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setMessage('')
    try {
      const current = (storeSettings?.site_code ?? '').toLowerCase()
      const next = siteCode.trim().toLowerCase()
      const payload: any = {}
      if (next && next !== current) payload.siteCode = next
      if (!Object.keys(payload).length) { setMessage('Değişiklik yok.'); return }
      const updated = await api.updateSettings(payload)
      setStoreSettings(updated); setSiteCode(updated.site_code ?? next); setMessage('Mağaza adresi güncellendi.')
    } catch (err:any) { setMessage(err?.message || 'Hata oluştu'); if (err?.status===409) setSiteStatus('taken') }
    finally { setSaving(false) }
  }

  const isVercelPlan = (storeSettings?.plan?.hosting ?? store?.plan?.hosting) === 'vercel'

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Site Yayın</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza adresini yönet, Vercel’de veya kendi sunucunda yayınla, domain bağla.</p>

      <div className="mt-8 space-y-8">
        {/* Mağaza Adresi */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Mağaza Adresi</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">rahatio.com.tr/stores/...</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Rahatio üzerindeki mağaza URL&apos;in. Harf, rakam ve tire kullanabilirsin. Domain bağlarsan bu adres yedek olarak kalır.</p>
          {storeSettings ? (
            <form onSubmit={handleSaveSiteCode} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-900">Mağaza kodu</label>
                <div className="mt-1 flex items-stretch rounded-lg border border-zinc-300 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="flex items-center whitespace-nowrap rounded-l-lg bg-zinc-100 px-3 text-sm text-zinc-500">rahatio.com.tr/stores/</span>
                  <input type="text" value={siteCode} onChange={e=>setSiteCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} placeholder="magaza-adin" maxLength={50} className="w-full rounded-r-lg px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  {siteStatus==='checking' && <span className="text-zinc-400">Kontrol ediliyor...</span>}
                  {siteStatus==='available' && <span className="text-green-600">✓ Bu adres kullanılabilir.</span>}
                  {siteStatus==='taken' && <span className="text-red-600">Bu adres başka bir mağaza tarafından kullanılıyor.</span>}
                  {siteStatus==='invalid' && <span className="text-red-600">Sadece küçük harf, rakam ve tire (2-50).</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3">
                <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500">Aktif Site</p>
                  <a href={storeSettings.domain ? `https://${storeSettings.domain}` : `https://rahatio.com.tr/stores/${siteCode}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-600 hover:underline">
                    {storeSettings.domain ?? `rahatio.com.tr/stores/${siteCode}`}
                  </a>
                  {storeSettings.domain && <p className="text-xs text-zinc-500">Yedek: rahatio.com.tr/stores/{siteCode}</p>}
                </div>
              </div>
              {message && <p className={`text-sm ${message.includes('güncellendi')?'text-green-600':'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving || siteStatus==='taken' || siteStatus==='invalid'}>{saving?'Kaydediliyor...':'Adresi Kaydet'}</Button>
            </form>
          ) : <p className="mt-4 text-sm text-zinc-400">Yükleniyor...</p>}
        </div>

        {/* Vercel Yayınlama */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Vercel Yayınlama</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Kendi hesabın</span>
          </div>
          {!isVercelPlan ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Vercel ile yayınlamak için planını Vercel destekleyen bir pakete yükselt. Mevcut yayınlama: <b>{store?.plan?.hosting ?? storeSettings?.plan?.hosting ?? 'rahatio'}</b>.
              <div className="mt-2"><a href="/billing" className="text-indigo-700 hover:underline">Planlara git →</a></div>
            </div>
          ) : <VercelHostingPanel />}
        </div>

        {/* Slave / Kendi Sunucunda */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Kendi Sunucunda Çalıştır (Slave)</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Mağazanı paylaşımlı hosting (cPanel) veya Vercel’e ZIP olarak kendi hesabında çalıştır — artık vitrin HTML olarak direkt gelir.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-4">
              <Server className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">PHP (Paylaşımlı Hosting)</h3>
              <p className="mt-1 text-xs text-zinc-500">cPanel/FTP tek dosya (<code className="rounded bg-zinc-100 px-1">index.php</code>). İndir → kök dizine <b>index.php</b> olarak yükle → <b>.htaccess</b> ekle → vitrin hazır.</p>
              <Button size="sm" className="mt-3" onClick={()=>api.downloadSlavePhp()} disabled={apiKeys.length===0}><Download className="mr-1 h-3 w-3"/>İndir (PHP ZIP)</Button>
              <details className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs">
                <summary className="cursor-pointer font-medium text-zinc-700">.htaccess nasıl eklenir?</summary>
                <p className="mt-2 text-zinc-600">Hosting köküne (index.php’nin yanına) <code className="rounded bg-white px-1">.htaccess</code> adında dosya oluştur, içine şunu yapıştır:</p>
                <pre className="mt-2 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-100">{`RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]`}</pre>
                <p className="mt-2 text-zinc-500">Olmazsa ürün detay linkleri <code className="rounded bg-white px-1">/index.php?product=ID</code> şeklinde de çalışır. <code className="rounded bg-white px-1">/health</code> → JSON sağlık kontrolü.</p>
              </details>
            </div>
            <div className="rounded-lg border border-zinc-200 p-4">
              <Globe className="h-6 w-6 text-zinc-500" />
              <h3 className="mt-2 font-medium text-zinc-900">Vercel (Serverless ZIP)</h3>
              <p className="mt-1 text-xs text-zinc-500">Yukarıdaki Vercel panelindeki ZIP ile aynı. Manuel yüklemek için veya yeni düzeltmeyi almak için tekrar indir.</p>
              <Button size="sm" className="mt-3" onClick={()=>api.downloadSlaveVercel()} disabled={apiKeys.length===0}><Download className="mr-1 h-3 w-3"/>İndir (Vercel ZIP)</Button>
              <p className="mt-2 text-[11px] text-zinc-500">ZIP artık <code>/</code> → HTML vitrin, <code>/health</code> → JSON, <code>{'/product/{id}'}</code> → detay sayfası içerir.</p>
            </div>
          </div>
          {apiKeys.length===0 && !keysLoading && <p className="mt-3 text-xs text-amber-600">Önce <a href="/settings" className="underline">Ayarlar → API Anahtarları</a>ndan bir anahtar oluşturmalısın.</p>}
          {keysLoading && <p className="mt-3 text-xs text-zinc-400">Yükleniyor...</p>}
        </div>
      </div>
    </div>
  )
}
