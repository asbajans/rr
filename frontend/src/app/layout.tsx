import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rahatio — AI Destekli E-Ticaret Platformu',
  description: 'Shopify benzeri e-ticaret altyapısı, AI ile ürün görseli düzenleme, pazaryeri entegrasyonu.',
  openGraph: {
    title: 'Rahatio — AI Destekli E-Ticaret Platformu',
    description: 'AI destekli ürün yönetimi ve pazaryeri entegrasyonu.',
    url: 'https://rahatio.com.tr',
    siteName: 'Rahatio',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-white">{children}</body>
    </html>
  )
}
