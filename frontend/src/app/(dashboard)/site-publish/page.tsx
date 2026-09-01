'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { ApiKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Globe, Download, Server, Rocket, Link2, ExternalLink, Key, Upload, Settings as SettingsIcon, AlertCircle, Info, CheckCircle2, Trash2, Plus, ShieldCheck, Loader2, XCircle, RefreshCw, Package } from 'lucide-react'

function DomainManager() {
  const [domains, setDomains] = useState<Array<{ domain: string; verified: boolean; method?: string | null; addedAt?: string; lastCheckedAt?: string | null }>>([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ type:'success'|'error'; text:string }|null>(null)
  const [verifying, setVerifying] = useState<string | null>(null)

  const load = async () => {
    try { const r = await api.getSiteDomains(); setDomains(r.domains || []) } catch {}
  }
  useEffect(()=>{ load() }, [])

  const handleAdd = async () => {
    const d = input.trim().toLowerCase().replace(/\.$/,'').replace(/^www\./,'')
    if (!d) return
    if (domains.length >=5) { setMsg({type:'error', text:'En fazla 5 domain ekleyebilirsiniz'}); return }
    setAdding(true); setMsg(null)
    try {
      const r = await api.addSiteDomainMulti(d)
      setDomains(r.domains || [])
      setInput('')
      setMsg({type:'success', text:'Domain eklendi — şimdi doğrulayın'})
    } catch(e:any){ setMsg({type:'error', text:e?.message||'Eklenemedi'}) } finally{ setAdding(false) }
  }
  const handleRemove = async (domain:string) => {
    if (!confirm(`${domain} silinsin mi?`)) return
    try { const r=await api.removeSiteDomain(domain); setDomains(r.domains||[]) } catch(e:any){ setMsg({type:'error', text:e.message}) }
  }
  const handleVerify = async (domain:string) => {
    setVerifying(domain); setMsg(null)
    try {
      const r=await api.verifySiteDomainMulti(domain)
      setDomains(r.domains||[])
      setMsg({type: r.verified?'success':'error', text: r.verified ? `${domain} doğrulandı ✅ (${r.method||'ok'})` : `${domain} doğrulanamadı — DNS/health kontrol edin`})
    } catch(e:any){ setMsg({type:'error', text:e.message})} finally{ setVerifying(null)}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0"/>
        <p>En fazla <b>5</b> domain ekleyebilirsin. Domaini <b>önce ekle, sonra doğrula</b> — doğrulama, kullandığın yayın yöntemine göre yapılır (Vercel → Vercel DNS, PHP → <code>/health</code> sağlık kontrolü). Her domain ayrı doğrulanır.</p>
      </div>

      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g,''))} placeholder="ornek-magaza.com.tr" className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); handleAdd() } }}/>
        <Button size="sm" onClick={handleAdd} disabled={adding || !input.trim() || domains.length>=5}><Plus className="mr-1 h-3 w-3"/>{adding?'Ekleniyor...':'Ekle'}</Button>
      </div>
      {domains.length>=5 && <p className="text-xs text-amber-600">Limit doldu (5/5). Birini silerek yeni ekleyebilirsin.</p>}

      {domains.length===0 ? (
        <p className="text-sm text-zinc-500">Henüz domain yok. Yukarıdan ekle.</p>
      ) : (
        <div className="space-y-2">
          {domains.map(d=>(
            <div key={d.domain} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${d.verified ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-zinc-500"/>
                  <span className="font-mono text-sm font-medium text-zinc-900">{d.domain}</span>
                  {d.verified ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3"/>Doğrulandı</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><XCircle className="h-3 w-3"/>Bekliyor</span>}
                  {d.method && <span className="rounded bg-white px-1.5 py-0.5 text-xs text-zinc-500">{d.method}</span>}
                </div>
                {d.lastCheckedAt && <p className="mt-1 text-xs text-zinc-500">Son kontrol: {new Date(d.lastCheckedAt).toLocaleString('tr-TR')}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant={d.verified ? 'outline' : 'primary'} onClick={()=>handleVerify(d.domain)} disabled={verifying===d.domain}>
                  {verifying===d.domain ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <ShieldCheck className="mr-1 h-3 w-3"/>}
                  {d.verified ? 'Tekrar Doğrula' : 'Doğrula'}
                </Button>
                <button onClick={()=>handleRemove(d.domain)} className="rounded p-1.5 text-zinc-400 hover:bg-white hover:text-red-600"><Trash2 className="h-4 w-4"/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className={`text-sm ${msg.type==='success'?'text-emerald-600':'text-red-600'}`}>{msg.text}</p>}
      <div className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
        <p className="font-medium text-white">Doğrulama nasıl çalışır?</p>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          <li><b>Vercel</b> kullanıyorsan: Domaini yukarı ekle → Vercel Dashboard → Project → Settings → Domains’e aynı domaini ekle → DNS’i ver → burada <b>Doğrula</b>’ya bas (Vercel API’si kontrol eder).</li>
          <li><b>PHP (kendi sunucun)</b> kullanıyorsan: Domaini ekle → hostingine ZIP’teki <code>index.php</code>+<code>.htaccess</code>’i at → domain <code>https://domain/health</code> → <code>{"`{status:ok, store:siteCode}`"}</code> dönmeli → <b>Doğrula</b> (health kontrol).</li>
          <li>Eklemeden <b>doğrulama yapılamaz</b>. Her domain tek tek doğrulanır.</li>
        </ul>
      </div>
    </div>
  )
}

function PhpControl() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [health, setHealth] = useState<{ ok:boolean; msg:string; detail?:any }|null>(null)
  const [checking, setChecking] = useState(false)
  const [products, setProducts] = useState<{ total:number; synced_at:string|null }|null>(null)
  const [domains, setDomains] = useState<string[]>([])

  useEffect(()=>{
    api.getAdminApiKeys().then(setApiKeys).catch(()=>{})
    api.getSiteDomains().then(r=> setDomains((r.domains||[]).map(d=>d.domain))).catch(()=>{})
  }, [])

  const handleCheck = async () => {
    setChecking(true); setHealth(null)
    try {
      const r = await api.getSiteDomains()
      const list = r.domains||[]
      if (!list.length) { setHealth({ok:false, msg:'Önce Domain Yönetimi’nden domain ekle'}); return }
      // Check primary or first domain's health via backend proxy? For now do direct fetch to first domain's health via backend verify endpoint to avoid CORS
      // Use verify endpoint as health check proxy
      const target = list.find(d=>d.verified)?.domain || list[0].domain
      const v = await api.verifySiteDomainMulti(target)
      if (v.verified) setHealth({ok:true, msg:`${target} → doğrulanmış (method: ${v.method})`, detail: v.detail})
      else setHealth({ok:false, msg:`${target} doğrulanamadı`, detail: v.detail})
      // Also fetch product count via public store front
      try {
        const s = await api.getSettings()
        const siteCode = s.site_code || (s as any).siteCode
        if (siteCode) {
          const prod = await fetch(`https://api.rahatio.com.tr/api/store/${siteCode}`).then(r=>r.json()).catch(()=>null)
          if (prod && typeof prod.total === 'number') setProducts({ total: prod.total, synced_at: null })
        }
      } catch {}
    } catch(e:any){ setHealth({ok:false, msg:e.message}) } finally{ setChecking(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-medium text-zinc-900">PHP ile Yayınla — sadece kendi hostingin</h3>
        <p className="mt-1 text-sm text-zinc-600">ZIP’i indir, hostingine at, domaini yukarıdan ekleyip doğrula. Aşağıdaki kontroller satıcı paneline özeldir, son kullanıcı görmez.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={()=>api.downloadSlavePhp()} disabled={apiKeys.length===0}><Download className="mr-1 h-3 w-3"/>İndir (PHP ZIP)</Button>
          <Button size="sm" variant="outline" onClick={handleCheck} disabled={checking}><RefreshCw className={`mr-1 h-3 w-3 ${checking?'animate-spin':''}`}/>{checking?'Kontrol ediliyor...':'Bağlantıyı Test Et'}</Button>
        </div>
        {apiKeys.length===0 && <p className="mt-2 text-xs text-amber-600">Önce Ayarlar → API Anahtarları’ndan anahtar oluştur.</p>}
        <details className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs">
          <summary className="cursor-pointer font-medium">ZIP içinde ne var & nasıl kurulur?</summary>
          <p className="mt-2">ZIP: <code>index.php</code> + <code>.htaccess</code> + <code>README.txt</code>. ZIP’i aç → <code>public_html</code>’e yükle → <code>https://domain/health</code> → {"`{status:ok}`"} görmelisin. Ürünler 5 dk’da senkronize olur.</p>
          <pre className="mt-2 overflow-auto rounded bg-zinc-900 p-2 font-mono text-[11px] text-zinc-100">{`RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [QSA,L]`}</pre>
        </details>
      </div>

      {health && (
        <div className={`rounded-lg border p-3 text-sm ${health.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <div className="flex items-center gap-2">{health.ok ? <CheckCircle2 className="h-4 w-4"/> : <XCircle className="h-4 w-4"/>}<span className="font-medium">{health.msg}</span></div>
          {health.detail && <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-xs text-zinc-600">{JSON.stringify(health.detail,null,2)}</pre>}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
        <div className="flex items-center gap-2"><Package className="h-4 w-4"/><span className="font-medium">Kontrol listesi (satıcı)</span></div>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li><code>/health</code> → <code>status:ok</code> ve <code>store: siteCode</code> eşleşmeli</li>
          <li><code>/sitemap.xml</code> Search Console’a ekle</li>
          <li>Ürünler gelmiyorsa: Mağazada ürün var mı (isActive) ve <code>products</code> tablosunda <code>storeId</code> doğru mu kontrol et</li>
        </ul>
      </div>
    </div>
  )
}

function VercelHostingPanel() {
  const [active, setActive] = useState<'zip' | 'token'>('zip')
  const [token, setToken] = useState('')
  const [teamId, setTeamId] = useState('')
  const [vercelCfg, setVercelCfg] = useState<{ hasToken: boolean; maskedToken: string | null; teamId: string | null } | null>(null)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [deploying, setDeploying] = useState(false)
  const [deployMsg, setDeployMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [deployment, setDeployment] = useState<any>(null)

  useEffect(()=>{ api.getVercelConfig().then(setVercelCfg).catch(()=>{}) }, [])

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

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <button onClick={()=>setActive('zip')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${active==='zip'?'bg-white shadow text-zinc-900':'text-zinc-600 hover:text-zinc-900'}`}><Download className="mr-1 inline h-4 w-4"/>ZIP ile</button>
        <button onClick={()=>setActive('token')} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${active==='token'?'bg-white shadow text-zinc-900':'text-zinc-600 hover:text-zinc-900'}`}><Key className="mr-1 inline h-4 w-4"/>Token ile Otomatik</button>
      </div>

      {active==='zip' && (
        <div className="space-y-4 rounded-xl border bg-white p-5 text-sm">
          <p><b>ZIP’i indir</b> → <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">vercel.com/new</a> → Browse ZIP → Deploy. Sonra <b>Domain Yönetimi</b>’nden domain ekleyip doğrula.</p>
          <Button size="sm" onClick={()=>api.downloadSlaveVercel()}><Download className="mr-1 h-3 w-3"/>Vercel ZIP İndir</Button>
          <p className="text-xs text-zinc-500">ZIP: <code>api/index.js</code> + <code>vercel.json</code> + <code>package.json</code>. Domain eklemeden doğrulama yapılamaz.</p>
        </div>
      )}

      {active==='token' && (
        <div className="space-y-4 rounded-xl border bg-white p-5">
          <p className="text-sm"><a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">vercel.com/account/tokens</a> → Create Token → buraya yapıştır.</p>
          <div className="flex gap-2">
            <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder={vercelCfg?.hasToken ? `Kayıtlı: ${vercelCfg.maskedToken}` : 'vercel_xxx...'} className="block w-full rounded-lg border px-3 py-2 text-sm"/>
            <Button size="sm" onClick={handleSaveToken} disabled={savingToken || !token.trim()}>{savingToken?'Doğrulanıyor...':'Kaydet'}</Button>
          </div>
          <div className="flex gap-2">
            <input type="text" value={teamId} onChange={e=>setTeamId(e.target.value)} placeholder="Team ID (opsiyonel)" className="block w-full rounded-lg border px-3 py-2 text-sm"/>
            {vercelCfg?.teamId && <span className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-xs">{vercelCfg.teamId}</span>}
          </div>
          {vercelCfg?.hasToken && <div className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-3 w-3"/>Kayıtlı: {vercelCfg.maskedToken} <button onClick={handleClearToken} className="text-red-600 hover:underline">Sil</button></div>}
          {tokenMsg && <p className={`text-sm ${tokenMsg.type==='success'?'text-emerald-600':'text-red-600'}`}>{tokenMsg.text}</p>}
          <Button size="sm" onClick={handleDeploy} disabled={deploying || !vercelCfg?.hasToken}><Upload className="mr-1 h-3 w-3"/>{deploying?'Deploy ediliyor...':'Vercel’e Deploy Et'}</Button>
          {deployMsg && <p className={`text-sm ${deployMsg.type==='success'?'text-emerald-600': deployMsg.type==='error'?'text-red-600':'text-indigo-600'}`}>{deployMsg.text}</p>}
          {deployment?.providerUrl && <a href={deployment.providerUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">{deployment.providerUrl}</a>}
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

  useEffect(() => {
    api.getSettings().then(s => { setStoreSettings(s); setSiteCode(s.site_code ?? s.siteCode ?? '') }).catch(()=>{})
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
      <p className="mt-1 text-sm text-zinc-600">Mağaza adresini yönet, domainlerini ekle/doğrula ve Vercel veya kendi sunucunda yayınla.</p>

      <div className="mt-8 space-y-8">
        {/* 1. Mağaza Adresi */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Mağaza Adresi</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">rahatio.com.tr/stores/...</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Rahatio üzerindeki adresin. Domain bağlasan da bu adres yedek kalır.</p>
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
                  {siteStatus==='available' && <span className="text-green-600">✓ Kullanılabilir</span>}
                  {siteStatus==='taken' && <span className="text-red-600">Başka mağaza kullanıyor</span>}
                  {siteStatus==='invalid' && <span className="text-red-600">2-50 karakter, a-z 0-9 -</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-3">
                <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500">Aktif Site</p>
                  <a href={storeSettings.domain ? `https://${storeSettings.domain}` : `https://rahatio.com.tr/stores/${siteCode}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-indigo-600 hover:underline">
                    {storeSettings.domain ?? `rahatio.com.tr/stores/${siteCode}`}
                  </a>
                </div>
              </div>
              {message && <p className={`text-sm ${message.includes('güncellendi')?'text-green-600':'text-red-600'}`}>{message}</p>}
              <Button type="submit" disabled={saving || siteStatus==='taken' || siteStatus==='invalid'}>{saving?'Kaydediliyor...':'Adresi Kaydet'}</Button>
            </form>
          ) : <p className="mt-4 text-sm text-zinc-400">Yükleniyor...</p>}
        </div>

        {/* 2. Domain Yönetimi */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Domain Yönetimi</h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">max 5</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Kendi domainlerini ekle, her birini ayrı doğrula. Doğrulama, yayın yöntemine göre otomatik seçilir.</p>
          <div className="mt-4">
            <DomainManager />
          </div>
        </div>

        {/* 3. Vercel Yayınlama */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Vercel ile Yayınla</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Kendi hesabın</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Vercel hesabında yayınla — domainleri yukarıdan yönet, burada deploy et.</p>
          {!isVercelPlan ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Vercel için planını yükselt. Mevcut: <b>{store?.plan?.hosting ?? storeSettings?.plan?.hosting ?? 'rahatio'}</b>. <a href="/billing" className="text-indigo-700 hover:underline">Planlara git →</a>
            </div>
          ) : <div className="mt-4"><VercelHostingPanel /></div>}
        </div>

        {/* 4. PHP - Kendi Sunucunda */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">PHP ile Kendi Sunucunda</h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">cPanel uyumlu</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">Paylaşımlı hosting için. İndir, yükle, domaini yukarıdan doğrula.</p>
          <div className="mt-4">
            <PhpControl />
          </div>
        </div>
      </div>
    </div>
  )
}
