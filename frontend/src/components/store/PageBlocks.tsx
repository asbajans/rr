'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

type Block = { id: string; type: string; content: Record<string, any> }

function textVal(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) return v.tr ?? v.en ?? v.es ?? ''
  return String(v)
}

function ProductGrid({ siteCode, categoryIds, limit }: { siteCode: string; categoryIds?: number[]; limit?: number }) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const categoryId = categoryIds?.[0]
  const catKey = JSON.stringify(categoryIds || [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api.getStoreProducts(siteCode, { limit: limit || 8, categoryId })
      .then(res => { if (active) setProducts(res.data.slice(0, limit || 8)) })
      .catch(() => { if (active) setProducts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [siteCode, categoryId, catKey, limit])

  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-100" />
  ))}</div>

  if (!products.length) return <p className="text-sm text-zinc-400">Bu kategoride ürün bulunamadı.</p>

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map(p => (
        <Link key={p.id} href={`/stores/${siteCode}/products/${p.id}`} className="group overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {p.images?.[0] && (
            <div className="aspect-square overflow-hidden">
              <img src={p.images[0]} alt={p.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            </div>
          )}
          <div className="p-3">
            <p className="truncate text-sm font-medium text-zinc-900">{p.label}</p>
            {typeof p.price === 'number' && (
              <p className="mt-1 text-sm font-semibold text-indigo-600">{p.price.toLocaleString('tr-TR')} ₺</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

export function PageBlocks({ siteCode, blocks }: { siteCode: string; blocks: Block[] }) {
  if (!blocks?.length) return null

  return (
    <div className="space-y-10">
      {blocks.map(block => {
        const c = block.content ?? {}
        switch (block.type) {
          case 'hero':
            return (
              <section key={block.id} className="relative overflow-hidden rounded-2xl py-16 px-6 text-center"
                style={c.backgroundImage ? { backgroundImage: `url(${c.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                <div className="relative z-10">
                  <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{textVal(c.heading)}</h1>
                  {c.subtitle && <p className="mx-auto mt-3 max-w-2xl text-zinc-600">{textVal(c.subtitle)}</p>}
                  {c.buttonText && (
                    <Link href={textVal(c.buttonUrl) || '#'}
                      className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                      {textVal(c.buttonText)}
                    </Link>
                  )}
                </div>
              </section>
            )
          case 'text':
            return (
              <section key={block.id} className="prose prose-zinc mx-auto max-w-3xl"
                dangerouslySetInnerHTML={{ __html: textVal(c.body) }} />
            )
          case 'image':
            return (
              <figure key={block.id} className="mx-auto max-w-4xl">
                {c.src && <img src={c.src} alt={textVal(c.alt)} className="w-full rounded-xl" />}
                {c.caption && <figcaption className="mt-2 text-center text-sm text-zinc-500">{textVal(c.caption)}</figcaption>}
              </figure>
            )
          case 'gallery':
            return (
              <div key={block.id} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {(Array.isArray(c.images) ? c.images : []).filter(Boolean).map((src: string, i: number) => (
                  <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
                ))}
              </div>
            )
          case 'products':
            return (
              <section key={block.id}>
                {c.title && <h2 className="mb-4 text-2xl font-semibold text-zinc-900">{textVal(c.title)}</h2>}
                <ProductGrid siteCode={siteCode} categoryIds={Array.isArray(c.categoryIds) ? c.categoryIds : []} limit={Number(c.limit) || 8} />
              </section>
            )
          case 'features':
            return (
              <section key={block.id}>
                {c.title && <h2 className="mb-6 text-center text-2xl font-semibold text-zinc-900">{textVal(c.title)}</h2>}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(Array.isArray(c.items) ? c.items : []).map((item: any, i: number) => (
                    <div key={i} className="rounded-xl border border-zinc-200 p-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
                      </div>
                      <h3 className="mt-3 font-semibold text-zinc-900">{textVal(item.title)}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{textVal(item.description)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )
          case 'cta':
            return (
              <section key={block.id} className="rounded-2xl bg-zinc-900 px-6 py-12 text-center">
                <h2 className="text-2xl font-semibold text-white">{textVal(c.heading)}</h2>
                {c.subtitle && <p className="mt-2 text-zinc-400">{textVal(c.subtitle)}</p>}
                {c.buttonText && (
                  <Link href={textVal(c.buttonUrl) || '#'}
                    className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                    {textVal(c.buttonText)}
                  </Link>
                )}
              </section>
            )
          case 'contact':
            return (
              <section key={block.id} className="mx-auto max-w-2xl rounded-2xl border border-zinc-200 p-8">
                <h2 className="text-xl font-semibold text-zinc-900">{textVal(c.title)}</h2>
                <div className="mt-4 space-y-2 text-sm text-zinc-600">
                  {c.email && <p>E-posta: {textVal(c.email)}</p>}
                  {c.phone && <p>Telefon: {textVal(c.phone)}</p>}
                  {c.address && <p>Adres: {textVal(c.address)}</p>}
                </div>
              </section>
            )
          case 'html':
            return (
              <div key={block.id} dangerouslySetInnerHTML={{ __html: textVal(c.html) }} />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
