import Link from 'next/link'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogViewTracker } from '@/components/blog/tracker'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'

async function fetchPost(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/store/platform/blogs/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.post || data) as any
  } catch { return null }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await fetchPost(params.slug)
  if (!post) return {}
  const seo = post.seo || {}
  const title = seo.metaTitle || post.title
  const description = seo.metaDescription || post.excerpt || post.title
  const canonical = `https://rahatio.com.tr/blog/${post.slug}`
  const ogImage = post.coverImage || post.cover_image || 'https://rahatio.com.tr/og-image.png'
  return {
    title: `${title} | Rahatio Blog`,
    description: description?.slice(0, 160),
    keywords: seo.keywords || post.tags || [],
    alternates: { canonical },
    openGraph: {
      title,
      description: description?.slice(0, 160),
      url: canonical,
      type: 'article',
      publishedTime: post.publishedAt,
      images: [{ url: ogImage }],
      siteName: 'Rahatio',
    },
    twitter: { card: 'summary_large_image', title, description: description?.slice(0, 160), images: [ogImage] },
    robots: { index: true, follow: true },
  }
}

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
  const post = await fetchPost(params.slug)
  if (!post) notFound()

  const seo = post.seo || {}
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: seo.metaDescription || post.excerpt,
    image: post.coverImage || post.cover_image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Organization', name: 'Rahatio' },
    publisher: { '@type': 'Organization', name: 'Rahatio', logo: { '@type': 'ImageObject', url: 'https://rahatio.com.tr/logo.png' } },
    mainEntityOfPage: `https://rahatio.com.tr/blog/${post.slug}`,
  }
  const faqLd = seo.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faq.map((f:any)=> ({ '@type':'Question', name:f.q || f.question, acceptedAnswer:{ '@type':'Answer', text: f.a || f.answer } }))
  } : null
  const breadcrumbLd = {
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement: [
      { '@type':'ListItem', position:1, name:'Ana Sayfa', item:'https://rahatio.com.tr' },
      { '@type':'ListItem', position:2, name:'Blog', item:'https://rahatio.com.tr/blog' },
      { '@type':'ListItem', position:3, name: post.title },
    ]
  }

  const ctaTitle = post.ctaTitle || 'Rahatio ile satışa hemen başlayın'
  const ctaSubtitle = post.ctaSubtitle || 'Fotoğraf yükleyin, AI ilanınızı oluştursun, tüm pazaryerlerinde yayınlayın.'
  const ctaUrl = post.ctaUrl || '/register'

  return (
    <div className="landing min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <BlogViewTracker slug={post.slug} blogPostId={post.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/blog" className="text-sm text-[var(--foreground)]/50 hover:text-[var(--primary)]">← Blog’a dön</Link>
        <div className="mt-6">
          {post.tags?.length >0 && <div className="flex flex-wrap gap-2 mb-4">{post.tags.map((t:string)=> <span key={t} className="rounded-full bg-[var(--surface)] border border-[var(--border)] px-3 py-1 text-xs">{t}</span>)}</div>}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily:'var(--font-display)' }}>{post.title}</h1>
          {post.excerpt && <p className="mt-4 text-lg text-[var(--foreground)]/60 leading-relaxed">{post.excerpt}</p>}
          <div className="mt-4 flex items-center gap-3 text-xs text-[var(--foreground)]/40">
            <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('tr-TR', { year:'numeric', month:'long', day:'numeric' }) : ''}</span>
            {seo.readingTime && <span>• {seo.readingTime} dk okuma</span>}
            {post.viewCount != null && <span>• {post.viewCount} görüntüleme</span>}
          </div>
        </div>

        {post.coverImage || post.cover_image ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
            <img src={post.coverImage || post.cover_image} alt={post.title} className="w-full object-cover" />
          </div>
        ) : null}

        {/* CTA: hero altı */}
        <div className="mt-8 rounded-2xl border border-[var(--primary)]/20 bg-gradient-to-r from-[var(--primary)]/10 to-[var(--accent)]/10 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{ctaTitle}</p>
            <p className="text-sm text-[var(--foreground)]/60">{ctaSubtitle}</p>
          </div>
          <Link href={ctaUrl} className="shrink-0 rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-black hover:opacity-90">Hemen Başla →</Link>
        </div>

        <div className="prose prose-invert mt-8 max-w-none prose-headings:font-bold prose-a:text-[var(--primary)] prose-strong:text-[var(--foreground)]" dangerouslySetInnerHTML={{ __html: post.content || '' }} />

        {/* FAQ */}
        {seo.faq?.length >0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold" style={{ fontFamily:'var(--font-display)' }}>Sıkça Sorulan Sorular</h2>
            <div className="mt-4 space-y-3">
              {seo.faq.map((f:any, i:number)=> (
                <details key={i} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <summary className="font-medium cursor-pointer">{f.q || f.question}</summary>
                  <p className="mt-2 text-sm text-[var(--foreground)]/70">{f.a || f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Mid-article CTA */}
        <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center">
          <h3 className="font-semibold">Pazaryerlerinde satışa hazır mısınız?</h3>
          <p className="mt-1 text-sm text-[var(--foreground)]/60">Trendyol, Hepsiburada, N11, Pazarama, Amazon ve Etsy entegrasyonu tek platformda.</p>
          <Link href="/register" className="mt-4 inline-flex rounded-full bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-black">Ücretsiz Hesap Oluştur</Link>
        </div>

        {/* Final CTA */}
        <div className="mt-12 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-hero-glow opacity-30 pointer-events-none" />
          <div className="relative">
            <h3 className="text-2xl font-bold" style={{ fontFamily:'var(--font-display)' }}>Hemen başlayın</h3>
            <p className="mt-2 text-[var(--foreground)]/60">14 gün ücretsiz, kredi kartı gerekmez.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/register" className="rounded-full bg-[var(--primary)] px-8 py-3 text-sm font-semibold text-black">Ücretsiz Dene</Link>
              <Link href="/pricing" className="rounded-full border border-[var(--border)] px-8 py-3 text-sm font-semibold">Fiyatları Gör</Link>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
