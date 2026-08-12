'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api-client'
import type { BlogPost } from '@/lib/types'

export default function StoreBlogPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [storeName, setStoreName] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchPosts = useCallback(async () => {
    try {
      const r = await api.getStoreBlogs(siteCode)
      setPosts(r.data)
      setTotal(r.total)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [siteCode])

  useEffect(() => {
    api.getStoreFront(siteCode).then((r: any) => setStoreName(r.store?.name ?? '')).catch(() => {})
    fetchPosts()
  }, [siteCode, fetchPosts])

  useEffect(() => {
    document.title = `Blog — ${storeName || 'Mağaza'}`
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', `${storeName || 'Mağaza'} blog yazıları — faydalı rehberler ve ürün ipuçları.`)
  }, [storeName])

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-zinc-400">Yükleniyor...</div>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={`/stores/${siteCode}`} className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-900">Mağazaya Dön</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-zinc-900">Blog</h1>
      <p className="mt-2 text-sm text-zinc-500">{total} yazı</p>

      {posts.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-zinc-500">Henüz blog yazısı bulunmuyor.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <Link
              key={post.id}
              href={`/stores/${siteCode}/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="aspect-[16/9] overflow-hidden bg-zinc-100">
                {post.cover_image ? (
                  <img src={post.cover_image} alt={post.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full items-center justify-center text-zinc-300">
                    <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-semibold text-zinc-900 group-hover:text-zinc-600">{post.title}</h3>
                {post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-zinc-500">{post.excerpt}</p>}
                <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                  {post.published_at && (
                    <time dateTime={post.published_at}>
                      {new Date(post.published_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </time>
                  )}
                  {post.author && <span>· {post.author}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}