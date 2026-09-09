import Link from 'next/link'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog — Rahatio | E-ticaret, Pazaryeri ve AI Rehberleri',
  description: 'E-ticaret, pazaryeri entegrasyonları, B2B ve AI ile ürün yönetimi hakkında güncel rehberler, ipuçları ve başarı hikayeleri.',
  openGraph: {
    title: 'Rahatio Blog — E-ticaret ve Pazaryeri Rehberleri',
    description: 'E-ticaret ipuçları, AI trendleri ve pazaryeri başarı rehberleri.',
    url: 'https://rahatio.com.tr/blog',
    type: 'website',
  },
  alternates: { canonical: 'https://rahatio.com.tr/blog' },
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

async function fetchPosts() {
  try {
    const res = await fetch(`${API_BASE}/api/store/platform/blogs?limit=50`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.posts || []) as any[]
  } catch { return [] }
}

export default async function BlogListPage() {
  const posts = await fetchPosts()

  return (
    <div className="landing min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium tracking-wide text-[var(--foreground)]/70">Blog</span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
            E-ticaret ve <span className="text-gradient">Pazaryeri</span> Rehberleri
          </h1>
          <p className="mt-4 text-lg text-[var(--foreground)]/60">
            Fotoğraftan ilana, B2B tedarikten pazaryeri satışına kadar işinizi büyütecek rehberler.
          </p>
        </div>

        <div className="mt-12">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-12 text-center">
              <p className="text-sm text-[var(--foreground)]/50">Henüz blog yazısı yok. Yakında burada olacağız.</p>
              <Link href="/register" className="mt-6 inline-flex items-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-black hover:opacity-90">Hemen Başla →</Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post:any) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden hover:shadow-glow transition">
                  {post.coverImage || post.cover_image ? (
                    <div className="aspect-[16/9] overflow-hidden bg-[var(--surface)]">
                      <img src={post.coverImage || post.cover_image} alt={post.title} className="h-full w-full object-cover group-hover:scale-105 transition duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20" />
                  )}
                  <div className="p-6">
                    <h2 className="line-clamp-2 text-lg font-semibold leading-tight group-hover:text-[var(--primary)] transition">{post.title}</h2>
                    {post.excerpt && <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]/60">{post.excerpt}</p>}
                    <div className="mt-4 flex items-center gap-3 text-xs text-[var(--foreground)]/40">
                      <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('tr-TR') : ''}</span>
                      {post.viewCount != null && <span>• {post.viewCount} görüntüleme</span>}
                      {post.seo?.readingTime && <span>• {post.seo.readingTime} dk</span>}
                    </div>
                    {post.tags?.length >0 && <div className="mt-3 flex flex-wrap gap-1.5">{post.tags.slice(0,3).map((t:string)=> <span key={t} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-medium">{t}</span>)}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-glow opacity-40 pointer-events-none" />
          <div className="relative">
            <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Mağazanızı bugün büyütmeye başlayın</h3>
            <p className="mt-2 text-[var(--foreground)]/60">Fotoğraf yükleyin, AI ilanınızı oluştursun, tüm pazaryerlerinde satışa başlayın.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/register" className="rounded-full bg-[var(--primary)] px-8 py-3 text-sm font-semibold text-black hover:opacity-90">Ücretsiz Dene</Link>
              <Link href="/pricing" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-8 py-3 text-sm font-semibold hover:bg-[var(--card)]">Fiyatları Gör</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
