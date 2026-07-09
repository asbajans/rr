'use client'

import { useState } from 'react'
import { api } from '@/lib/api-client'
import { Sparkles, Loader2, ImageUp } from 'lucide-react'

type AiTab = 'remove-bg' | 'analyze' | 'search' | 'recommend' | 'chat'

export default function SuperAiPage() {
  const [tab, setTab] = useState<AiTab>('remove-bg')
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  // Search
  const [query, setQuery] = useState('')
  const [productsText, setProductsText] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)

  // Chat
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([])
  const [chatReply, setChatReply] = useState('')

  async function handleRemoveBg() {
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('images', file)
      fd.append('action', 'remove-background')
      setResult(await api.processImage(fd))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleAnalyze() {
    if (!file) return
    setProcessing(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      setResult(await api.analyzeProduct(fd))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleSearch() {
    if (!query) return
    setProcessing(true)
    setError('')
    try {
      const products = productsText ? productsText.split('\n').filter(Boolean).map((l, i) => ({ id: String(i), label: l })) : []
      setSearchResult(await api.aiSearch(query, products))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleChat() {
    if (!chatMsg) return
    setProcessing(true)
    try {
      const res = await api.aiChat(chatMsg, chatHistory, { name: 'Test Store' })
      setChatHistory(prev => [...prev, { role: 'user', content: chatMsg }, { role: 'assistant', content: res.reply }])
      setChatReply(res.reply)
      setChatMsg('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const tabs: { key: AiTab; label: string }[] = [
    { key: 'remove-bg', label: 'Arka Plan Temizleme' },
    { key: 'analyze', label: 'Ürün Analizi' },
    { key: 'search', label: 'AI Arama' },
    { key: 'chat', label: 'AI Sohbet' },
  ]

  return (
    <div>
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">AI Yönetimi</h1>
          <p className="text-sm text-zinc-400">Süper admin AI araçlarını test et ve yönet.</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 border-b border-zinc-700">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-b-2 border-amber-400 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-900/50 p-3 text-sm text-red-400">{error}</div>}

      <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        {(tab === 'remove-bg' || tab === 'analyze') && (
          <div className="space-y-4">
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-500" />
            <button onClick={tab === 'remove-bg' ? handleRemoveBg : handleAnalyze}
              disabled={!file || processing}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50">
              {processing && <Loader2 className="h-4 w-4 animate-spin" />}
              {processing ? 'İşleniyor...' : tab === 'remove-bg' ? 'Arka Plan Temizle' : 'AI Analiz'}
            </button>
            {result && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-zinc-800 p-4 text-xs text-green-400">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === 'search' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400">Arama Sorgusu</label>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="örn. kırmızı elbise"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400">Ürün Listesi (her satıra bir ürün adı, opsiyonel)</label>
              <textarea value={productsText} onChange={e => setProductsText(e.target.value)} rows={4} placeholder="Ürün 1&#10;Ürün 2"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
            </div>
            <button onClick={handleSearch} disabled={!query || processing}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50">
              {processing ? 'Aranıyor...' : 'AI ile Ara'}
            </button>
            {searchResult && (
              <pre className="mt-4 rounded-lg bg-zinc-800 p-4 text-xs text-green-400">
                {JSON.stringify(searchResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg bg-zinc-800 p-4">
              {chatHistory.map((h, i) => (
                <div key={i} className={`text-sm ${h.role === 'user' ? 'text-indigo-400' : 'text-green-400'}`}>
                  <span className="font-medium">{h.role === 'user' ? 'Siz:' : 'AI:'}</span> {h.content}
                </div>
              ))}
              {chatHistory.length === 0 && <p className="text-xs text-zinc-500">Henüz mesaj yok.</p>}
            </div>
            <div className="flex gap-2">
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder="Mesaj yaz..."
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              <button onClick={handleChat} disabled={!chatMsg || processing}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50">
                Gönder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}