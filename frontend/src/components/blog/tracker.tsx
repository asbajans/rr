'use client'
import { useEffect } from 'react'
import { trackPlatform } from '@/lib/analytics'

export function BlogViewTracker({ slug, siteCode, blogPostId }: { slug: string; siteCode?: string; blogPostId?: number }) {
  useEffect(() => {
    try {
      // platform or store blog view - send to appropriate endpoint
      // we use sendBeacon via analytics lib
      const path = siteCode ? `/stores/${siteCode}/blog/${slug}` : `/blog/${slug}`
      trackPlatform({ path, eventType: 'blog_view' as any, metadata: { slug, blogPostId } } as any)
      // also try store-specific if siteCode
      if (siteCode) {
        const sid = localStorage.getItem('rahatio_sid') || ''
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.rahatio.com.tr'}/api/store/${siteCode}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'blog_view', path, sessionId: sid || undefined, metadata: { blogPostId, slug } }),
        }).catch(()=>{})
      }
    } catch {}
  }, [slug, siteCode, blogPostId])
  return null
}
