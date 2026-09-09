import type { MetadataRoute } from 'next'

const PLATFORM_ORIGIN = 'https://rahatio.com.tr'

const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'GoogleOther',
  'GoogleOther-Image',
  'GoogleOther-Video',
  'CCBot',
  'FacebookBot',
  'Bytespider',
  'Applebot',
  'Applebot-Extended',
  'anthropic-ai',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'img2dataset',
]

export default function robots(): MetadataRoute.Robots {
  const sitemap = `${PLATFORM_ORIGIN}/sitemap.xml`
  // Panel + superadmin private paths — must not be indexed. Public storefronts (/stores/[siteCode]) stay allowed via Allow.
  const privatePaths = [
    '/api/',
    '/_next/',
    '/admin',
    '/dashboard',
    '/settings',
    '/settings/',
    '/billing',
    '/blog-posts',
    '/products',
    '/products/',
    '/categories',
    '/brands',
    '/variations',
    '/stocks',
    '/feeds',
    '/orders',
    '/customers',
    '/b2b',
    '/b2b/',
    '/marketplaces',
    '/marketplaces/',
    '/integrations',
    '/site-builder',
    '/site-publish',
    '/pages',
    '/menus',
    '/pixels',
    '/payment',
    '/locations',
    '/shipping',
    '/ai',
    '/ai/',
    '/credits',
    '/support',
    '/supplier',
    '/supplier/',
    '/super',
    '/super/',
    '/plans',
    '/saas-coupons',
    '/blogs', // superadmin /blogs (platform blog admin), public is /blog singular
    '/credit-packs',
    '/users',
    '/stores$', // block exact /stores (superadmin list) but allow /stores/[siteCode] via Allow
    '/stores?', // block /stores?* query variants
  ]
  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: ['/', '/stores/', '/blog/', '/blog', '/pricing', '/features', '/sitemap.xml', '/llms.txt'],
      disallow: privatePaths,
    },
  ]
  for (const bot of AI_CRAWLERS) {
    // AI crawlers: same disallow for private, but explicitly allow public
    rules.push({ userAgent: bot, allow: ['/', '/stores/', '/blog/', '/sitemap.xml', '/llms.txt'], disallow: privatePaths })
  }
  return {
    rules,
    sitemap,
    host: PLATFORM_ORIGIN,
  }
}
