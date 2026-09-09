'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Plus, Pencil, Trash2, Search, Sparkles } from 'lucide-react'

export default function SuperBlogsPage(){
  const [posts,setPosts]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState<any>({ title:'', slug:'', excerpt:'', content:'', coverImage:'', status:'draft', seo_title:'', seo_description:'', cta_title:'', cta_subtitle:'', cta_url:'/register' })
  const [editingId,setEditingId]=useState<number|null>(null)
  const [message,setMessage]=useState('')
  // bulk
  const [showBulk,setShowBulk]=useState(false)
  const [bulkTopics,setBulkTopics]=useState('')
  const [bulkKeywords,setBulkKeywords]=useState('')
  const [bulkNotes,setBulkNotes]=useState('')
  const [bulkScheduleMode,setBulkScheduleMode]=useState<'draft'|'scheduled'|'publish_now'>('scheduled')
  const [bulkStartAt,setBulkStartAt]=useState<string>(()=> new Date(Date.now()+60*60*1000).toISOString().slice(0,16))
  const [bulkIntervalDays,setBulkIntervalDays]=useState(1)
  const [bulkGenerating,setBulkGenerating]=useState(false)
  const [bulkJob,setBulkJob]=useState<any>(null)

  const load=async()=>{
    setLoading(true)
    try{
      const r=await api.getSaasBlogs({ search: search||undefined } as any)
      setPosts(r.posts||[])
    }catch(e:any){ setMessage(e.message)}
    finally{ setLoading(false)}
  }
  useEffect(()=>{ load() },[])

  function openNew(){ setForm({ title:'', slug:'', excerpt:'', content:'', coverImage:'', status:'draft', seo_title:'', seo_description:'', cta_title:'', cta_subtitle:'', cta_url:'/register' }); setEditingId(null); setShowForm(true)}
  function openEdit(p:any){ setForm({ title:p.title, slug:p.slug, excerpt:p.excerpt||'', content:p.content||'', coverImage:p.coverImage||'', status:p.status||'draft', seo_title:p.seo?.metaTitle||'', seo_description:p.seo?.metaDescription||'', cta_title:p.ctaTitle||'', cta_subtitle:p.ctaSubtitle||'', cta_url:p.ctaUrl||'/register' }); setEditingId(p.id); setShowForm(true)}

  async function save(){
    try{
      const body:any={
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        coverImage: form.coverImage,
        status: form.status,
        ctaTitle: form.cta_title,
        ctaSubtitle: form.cta_subtitle,
        ctaUrl: form.cta_url,
        seo:{ metaTitle: form.seo_title, metaDescription: form.seo_description },
      }
      if(editingId) await api.updateSaasBlog(editingId, body)
      else await api.createSaasBlog(body)
      setShowForm(false); load(); setMessage('Kaydedildi')
    }catch(e:any){ setMessage(e.message)}
  }
  async function remove(id:number){
    if(!confirm('Sil?')) return
    await api.deleteSaasBlog(id); load()
  }

  async function handleBulkGenerate(){
    if(!bulkTopics.trim()){ setMessage('En az 1 konu girin (her satır bir konu)'); return }
    setBulkGenerating(true); setMessage('')
    try{
      const res=await api.bulkGenerateSaasBlogs({ topics: bulkTopics, keywords: bulkKeywords.split(',').map(k=>k.trim()).filter(Boolean), notes: bulkNotes||undefined, scheduleMode: bulkScheduleMode, startAt: bulkStartAt? new Date(bulkStartAt).toISOString():undefined, intervalDays: bulkIntervalDays })
      setBulkJob(res); setMessage(`${res.total} konu kuyruğa alındı — ${res.requiredCredits} kredi`)
      const jobId=res.jobId
      const iv=setInterval(async()=>{
        try{
          const j=await api.getSaasBulkBlogJob(jobId)
          setBulkJob(j.job)
          if(j.job.pending===0){ clearInterval(iv); load() }
        }catch{}
      },3000)
    }catch(e:any){ setMessage(e.message||'Bulk hata') }
    finally{ setBulkGenerating(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Landing Blog (Platform)</h1>
          <p className="text-sm text-zinc-400">rahatio.com.tr/blog sayfasında yayınlanır, SEO ve CTA ile.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=> setShowBulk(v=>!v)} className="flex items-center gap-1 rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-200"><Sparkles className="h-4 w-4" /> Toplu AI Üretim</button>
          <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"><Plus className="h-4 w-4" /> Yeni Yazı</button>
        </div>
      </div>
      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-amber-400">{message}</div>}
      {showBulk && (
        <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <h3 className="text-sm font-semibold text-indigo-200">Toplu AI Üretim — Konuları alt alta yazın</h3>
          <p className="text-xs text-indigo-200/70">Her satır bir blog konusu, belirlenen aralıkta otomatik yayınlanır. Sadece süperadmin.</p>
          <textarea value={bulkTopics} onChange={e=> setBulkTopics(e.target.value)} placeholder={"Altın takı bakım rehberi\nKışın cilt bakımı ipuçları\nE-ticarette kargo optimizasyonu"} rows={5} className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500" />
          <input value={bulkKeywords} onChange={e=> setBulkKeywords(e.target.value)} placeholder="Ortak anahtar kelimeler (virgülle)" className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
          <textarea value={bulkNotes} onChange={e=> setBulkNotes(e.target.value)} placeholder="Satıcı notu (ortak)" rows={2} className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <select value={bulkScheduleMode} onChange={e=> setBulkScheduleMode(e.target.value as any)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white">
              <option value="scheduled">Zamanlanmış (aralıklı yayın)</option>
              <option value="draft">Taslak</option>
              <option value="publish_now">Hemen Yayınla</option>
            </select>
            <input type="datetime-local" value={bulkStartAt} onChange={e=> setBulkStartAt(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white [color-scheme:dark]" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Aralık</span>
              <input type="number" min={1} max={30} value={bulkIntervalDays} onChange={e=> setBulkIntervalDays(Number(e.target.value))} className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-white" />
              <span className="text-xs text-zinc-400">gün</span>
            </div>
          </div>
          <button onClick={handleBulkGenerate} disabled={bulkGenerating} className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Sparkles className="h-4 w-4" /> {bulkGenerating?'Kuyruğa alınıyor...':'Toplu Üret ve Zamanla'}</button>
          {bulkJob && (
            <div className="mt-3 rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
              <p>Job {bulkJob.jobId||bulkJob.id}: {bulkJob.done}/{bulkJob.total} bitti, {bulkJob.failed} hatalı, {bulkJob.pending} bekliyor</p>
              {bulkJob.topics?.map((t:any,i:number)=> <div key={i} className="flex justify-between border-b border-zinc-800 py-1"><span className="truncate">{t.topic}</span><span className={t.status==='done'?'text-emerald-400': t.status==='failed'?'text-red-400':'text-zinc-400'}>{t.status}</span></div>)}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Ara..." className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white" />
        </div>
        <button onClick={load} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300">Ara</button>
      </div>
      {loading? <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p> : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-zinc-800 text-xs uppercase text-zinc-400"><th className="px-3 py-2">Başlık</th><th className="px-3 py-2">Durum</th><th className="px-3 py-2">Oluşturulma</th><th className="px-3 py-2 text-right">İşlem</th></tr></thead>
            <tbody>
              {posts.map(p=>(
                <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                  <td className="px-3 py-3 text-white"><div className="font-medium">{p.title}</div><div className="text-xs text-zinc-500">/{p.slug}</div></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${p.status==='published'?'bg-emerald-500/15 text-emerald-400':'bg-zinc-700 text-zinc-300'}`}>{p.status}</span></td>
                  <td className="px-3 py-3 text-xs text-zinc-400">{p.createdAt? new Date(p.createdAt).toLocaleDateString('tr-TR'):''}</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-1"><button onClick={()=> openEdit(p)} className="p-1 text-zinc-400 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={()=> remove(p.id)} className="p-1 text-zinc-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
              {posts.length===0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-zinc-500">Yazı yok</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={()=> setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-zinc-900 p-6" onClick={e=> e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-white">{editingId?'Düzenle':'Yeni Yazı'}</h2>
            <div className="mt-4 grid gap-3">
              <input value={form.title} onChange={e=> setForm({...form, title:e.target.value})} placeholder="Başlık" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input value={form.slug} onChange={e=> setForm({...form, slug:e.target.value})} placeholder="slug" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input value={form.coverImage} onChange={e=> setForm({...form, coverImage:e.target.value})} placeholder="Kapak görseli URL" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <textarea value={form.excerpt} onChange={e=> setForm({...form, excerpt:e.target.value})} placeholder="Özet" rows={2} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <textarea value={form.content} onChange={e=> setForm({...form, content:e.target.value})} placeholder="İçerik HTML" rows={8} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.status} onChange={e=> setForm({...form, status:e.target.value})} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"><option value="draft">Taslak</option><option value="scheduled">Zamanlanmış</option><option value="published">Yayında</option><option value="archived">Arşiv</option></select>
                <input value={form.cta_url} onChange={e=> setForm({...form, cta_url:e.target.value})} placeholder="CTA URL /register" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <input value={form.cta_title} onChange={e=> setForm({...form, cta_title:e.target.value})} placeholder="CTA Başlık" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input value={form.cta_subtitle} onChange={e=> setForm({...form, cta_subtitle:e.target.value})} placeholder="CTA Alt metin" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input value={form.seo_title} onChange={e=> setForm({...form, seo_title:e.target.value})} placeholder="SEO Başlık (60)" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <input value={form.seo_description} onChange={e=> setForm({...form, seo_description:e.target.value})} placeholder="SEO Açıklama (160)" className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
            </div>
            <div className="mt-6 flex gap-2"><button onClick={save} className="flex-1 rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-900">Kaydet</button><button onClick={()=> setShowForm(false)} className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400">İptal</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
