'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import { storeBase } from '@/lib/store-path'
import { PageBlocks } from '@/components/store/PageBlocks'

function pageTitle(p: any): string {
  const t = p?.title
  if (!t) return ''
  if (typeof t === 'string') return t
  if (typeof t === 'object') return t.tr ?? t.en ?? ''
  return ''
}

export default function StorePageView() {
  const { siteCode, slug } = useParams<{ siteCode: string; slug: string }>()
  const [page, setPage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!siteCode || !slug) return
    setLoading(true)
    setError('')
    api.getStorePage(siteCode, slug)
      .then(setPage)
      .catch(err => setError(err.message || 'Sayfa bulunamadı'))
      .finally(() => setLoading(false))
  }, [siteCode, slug])

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-500">Yükleniyor...</div>

  if (error || !page) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Sayfa bulunamadı</h1>
        <p className="mt-2 text-zinc-500">{error}</p>
        <Link href={storeBase(siteCode)} className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Mağazaya Dön
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href={storeBase(siteCode)} className="hover:text-zinc-900">Ana Sayfa</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900">{pageTitle(page)}</span>
      </nav>
      {pageTitle(page) && <h1 className="mb-8 text-3xl font-bold text-zinc-900">{pageTitle(page)}</h1>}
      <PageBlocks siteCode={siteCode} blocks={Array.isArray(page.content) ? page.content : []} />
    </div>
  )
}
