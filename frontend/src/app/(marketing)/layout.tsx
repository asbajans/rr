import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Rahatio — AI Product Management for Every Marketplace',
  description:
    'Snap a photo, let AI build the listing, and publish to every marketplace including N11 and Pazarama. E-commerce, B2B wholesale and legal dropshipping in one platform.',
  openGraph: {
    title: 'Rahatio — AI Product Management for Every Marketplace',
    description: 'AI product intelligence, omnichannel marketplace integrations, storefronts, B2B and compliant dropshipping.',
    url: 'https://rahatio.com.tr',
    siteName: 'Rahatio',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
