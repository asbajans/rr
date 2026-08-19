'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api-client'
import { storeBase } from '@/lib/store-path'
import type { BlogPost } from '@/lib/types'

export default function StoreBlogPostPage() {
  const { siteCode, slug } = useParams<{ siteCode: string; slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [storeName, setStoreName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getStoreFront(siteCode).then((r: any) => setStoreName(r.store?.name ?? '')).catch(() => {})
    api.getStoreBlog(siteCode, slug)
      .then(p => { setPost(p); setLoading(false) })
      .catch((err: any) => { setError(err.message); setLoading(false) })
  }, [siteCode, slug])

  useEffect(() => {
    if (!post) return
    const seoTitle = (post.meta?.seo_title as string) || post.title
    const seoDesc = (post.meta?.seo_description as string) || post.excerpt || ''
    document.title = `${seoTitle} — ${storeName || 'Mağaza'}`

    const upsertMeta = (attr: string, key: string, content: string) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    upsertMeta('name', 'description', seoDesc)
    upsertMeta('property', 'og:title', seoTitle)
    upsertMeta('property', 'og:description', seoDesc)
    upsertMeta('property', 'og:type', 'article')
    upsertMeta('property', 'og:url', window.location.href)
    if (post.cover_image) upsertMeta('property', 'og:image', post.cover_image)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', seoTitle)
    upsertMeta('name', 'twitter:description', seoDesc)

    let ld = document.getElementById('blog-jsonld')
    if (!ld) {
      ld = document.createElement('script')
      ld.setAttribute('type', 'application/ld+json')
      ld.id = 'blog-jsonld'
      document.head.appendChild(ld)
    }
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: seoDesc,
      image: post.cover_image || undefined,
      datePublished: post.published_at || post.created_at,
      author: { '@type': 'Organization', name: storeName || 'Mağaza' },
    })
  }, [post, storeName])

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-zinc-400">Yükleniyor...</div>
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error || 'Blog yazısı bulunamadı.'}</p>
        <Link href={`${storeBase(siteCode)}/blog`} className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">Bloga Dön</Link>
      </div>
    )
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href={`${storeBase(siteCode)}/blog`} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-4 w-4" /> Blog
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl">{post.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        {post.published_at && (
          <time dateTime={post.published_at}>
            {new Date(post.published_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        )}
        {post.author && <span>{post.author}</span>}
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {post.tags.slice(0, 5).map(tag => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">{tag}</span>
            ))}
          </span>
        )}
      </div>

      {post.cover_image && (
        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-zinc-100">
          <img src={post.cover_image} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}

      {post.excerpt && <p className="mt-6 text-lg font-medium text-zinc-700">{post.excerpt}</p>}

      {post.content && (
        <div
          className="mt-6 space-y-4 text-base leading-relaxed text-zinc-700 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-zinc-900"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      )}
    </article>
  )
}