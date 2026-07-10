'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

interface BlogPost {
  id: number
  title: string
  slug: string
  meta_title: string | null
  meta_description: string | null
  created_at: string
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .getPublicBlog('platform')
      .then((data) => {
        if (active) setPosts(data)
      })
      .catch(() => {
        if (active) setPosts([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Blog</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
            E-ticaret ipuçları, AI trendleri ve daha fazlası.
          </p>
        </div>

        <div className="mt-16">
          {loading ? (
            <p className="text-center text-sm text-zinc-400">Yükleniyor...</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-sm text-zinc-400">Henüz blog yazısı yok.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-zinc-200 p-6 transition hover:shadow-lg"
                >
                  <h2 className="text-xl font-semibold text-zinc-900">{post.title}</h2>
                  {post.meta_description && (
                    <p className="mt-2 text-sm text-zinc-600">{post.meta_description}</p>
                  )}
                  <p className="mt-4 text-xs text-zinc-400">
                    {new Date(post.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
