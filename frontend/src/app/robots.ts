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
  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/', '/admin', '/dashboard', '/settings'],
    },
  ]
  for (const bot of AI_CRAWLERS) {
    rules.push({ userAgent: bot, allow: '/' })
  }
  return {
    rules,
    sitemap,
    host: PLATFORM_ORIGIN,
  }
}
