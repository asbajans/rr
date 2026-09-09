import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { BlogViewTracker } from '@/components/blog/tracker'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'
const PLATFORM_ORIGIN = 'https://rahatio.com.tr'

function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null
  let d = String(domain).trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')
  if (!d || d === 'rahatio.com.tr' || d.endsWith('.rahatio.com.tr')) return null
  if (d === 'localhost' || d.endsWith('.localhost')) return null
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(d)) return null
  return d
}

async function fetchStore(siteCode: string) {
  try {
    const res = await fetch(`${API_BASE}/api/store/${siteCode}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return data?.store ?? data
  } catch { return null }
}

async function fetchPost(siteCode: string, slug: string) {
  try {
    const res = await fetch(`${API_BASE}/api/store/${siteCode}/blogs/${slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.post || data) as any
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ siteCode: string; slug: string }> }): Promise<Metadata> {
  const { siteCode, slug } = await params
  const [post, store] = await Promise.all([fetchPost(siteCode, slug), fetchStore(siteCode)])
  if (!post) return {}
  const seo = post.seo || {}
  const title = seo.metaTitle || post.title
  const description = seo.metaDescription || post.excerpt || post.title
  const domain = store ? normalizeDomain(store.domain || store.siteUrl) : null
  const canonical = domain ? `https://${domain}/blog/${post.slug}` : `${PLATFORM_ORIGIN}/stores/${siteCode}/blog/${post.slug}`
  const ogImage = post.coverImage || post.cover_image || `https://rahatio.com.tr/og-image.png`
  return {
    title: `${title} — ${store?.name || 'Mağaza'}`,
    description: description?.slice(0, 160),
    keywords: seo.keywords || post.tags || [],
    alternates: { canonical },
    openGraph: {
      title,
      description: description?.slice(0, 160),
      url: canonical,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      images: [{ url: ogImage }],
      siteName: store?.name || 'Rahatio Mağaza',
    },
    twitter: { card: 'summary_large_image', title, description: description?.slice(0, 160), images: [ogImage] },
    robots: { index: true, follow: true },
  }
}

export default async function StoreBlogPostPage({ params }: { params: Promise<{ siteCode: string; slug: string }> }) {
  const { siteCode, slug } = await params
  const [post, store] = await Promise.all([fetchPost(siteCode, slug), fetchStore(siteCode)])
  if (!post) notFound()

  const seo = (post as any).seo || {}
  const storeName = store?.name || 'Mağaza'
  const domain = store ? normalizeDomain(store.domain || store.siteUrl) : null
  const canonical = domain ? `https://${domain}/blog/${post.slug}` : `${PLATFORM_ORIGIN}/stores/${siteCode}/blog/${post.slug}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: seo.metaDescription || post.excerpt,
    image: post.coverImage || (post as any).cover_image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Organization', name: storeName },
    publisher: { '@type': 'Organization', name: storeName, logo: { '@type': 'ImageObject', url: `${PLATFORM_ORIGIN}/logo.jpeg` } },
    mainEntityOfPage: canonical,
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: storeName, item: domain ? `https://${domain}` : `${PLATFORM_ORIGIN}/stores/${siteCode}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: domain ? `https://${domain}/blog` : `${PLATFORM_ORIGIN}/stores/${siteCode}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  }
  const faqLd = seo.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: seo.faq.map((f:any)=> ({ '@type':'Question', name: f.q || f.question, acceptedAnswer:{ '@type':'Answer', text: f.a || f.answer } }))
  } : null

  const ctaTitle = (post as any).ctaTitle || 'Mağazayı keşfet'
  const ctaSubtitle = (post as any).ctaSubtitle || 'Ürünlerimizi inceleyin ve fırsatları kaçırmayın.'
  const ctaUrl = (post as any).ctaUrl || (domain ? `https://${domain}` : `${PLATFORM_ORIGIN}/stores/${siteCode}`)

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <BlogViewTracker slug={String(slug)} siteCode={String(siteCode)} blogPostId={post.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <Link href={domain ? `https://${domain}/blog` as any : `/stores/${siteCode}/blog` as any} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        ← Blog
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-zinc-900 sm:text-4xl">{post.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
        {post.publishedAt && (
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>
        )}
        {post.author && <span>{post.author}</span>}
        {seo.readingTime && <span>• {seo.readingTime} dk okuma</span>}
        {post.viewCount != null && <span>• {post.viewCount} görüntüleme</span>}
        {Array.isArray(post.tags) && post.tags.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {post.tags.slice(0, 5).map((tag:string) => (
              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">{tag}</span>
            ))}
          </span>
        )}
      </div>

      {(post.coverImage || (post as any).cover_image) && (
        <div className="mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-zinc-100">
          <img src={post.coverImage || (post as any).cover_image} alt={post.title} className="h-full w-full object-cover" />
        </div>
      )}

      {post.excerpt && <p className="mt-6 text-lg font-medium text-zinc-700">{post.excerpt}</p>}

      <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-900">{ctaTitle}</p>
          <p className="text-sm text-zinc-600">{ctaSubtitle}</p>
        </div>
        <Link href={ctaUrl as any} className="shrink-0 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">İncele →</Link>
      </div>

      {post.content && (
        <div
          className="mt-6 space-y-4 text-base leading-relaxed text-zinc-700 [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-zinc-900 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:font-semibold [&_strong]:text-zinc-900"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      )}

      {seo.faq?.length >0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-zinc-900">Sıkça Sorulan Sorular</h2>
          <div className="mt-4 space-y-3">
            {seo.faq.map((f:any, i:number)=> (
              <details key={i} className="rounded-xl border border-zinc-200 bg-white p-4">
                <summary className="font-medium cursor-pointer text-zinc-900">{f.q || f.question}</summary>
                <p className="mt-2 text-sm text-zinc-600">{f.a || f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <h3 className="font-semibold text-zinc-900">{storeName} — daha fazlası</h3>
        <p className="mt-1 text-sm text-zinc-600">Tüm ürünleri ve kampanyaları keşfet.</p>
        <Link href={domain ? `https://${domain}` as any : `/stores/${siteCode}` as any} className="mt-4 inline-flex rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">Mağazaya Git</Link>
      </div>
    </article>
  )
}
