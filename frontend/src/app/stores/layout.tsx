'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { type ReactNode, useState, useEffect } from 'react'
import { CartProvider, useCart } from '@/lib/cart'
import { ShoppingCart, MapPin } from 'lucide-react'
import AiChat from '@/components/store/AiChat'
import PixelInjector from '@/components/store/PixelInjector'
import { StoreMenuBar, StoreFooterMenus } from '@/components/store/StoreMenuBar'
import { api } from '@/lib/api-client'

function StoreHeader({ siteCode }: { siteCode: string }) {
  const { totalItems } = useCart()
  const [storeName, setStoreName] = useState('')
  const [theme, setTheme] = useState<any>({})

  useEffect(() => {
    if (siteCode) {
      api.getStoreFront(siteCode).then((r: any) => {
        const store = r?.store ?? r ?? {}
        setStoreName(store.name || '')
        setTheme(store.theme ?? {})
      }).catch(() => {})
    }
  }, [siteCode])

  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={`/stores/${siteCode}`} className="flex shrink-0 items-center gap-2">
          {theme.logo_url ? (
            <img src={theme.logo_url} alt={storeName || 'Mağaza'} className="h-9 w-auto object-contain" />
          ) : (
            <span className="text-xl font-bold tracking-tight text-zinc-900">{storeName || 'Rahatio'}</span>
          )}
        </Link>
        <StoreMenuBar siteCode={siteCode} location="header" />
        <nav className="flex shrink-0 items-center gap-4">
          <Link href={`/stores/${siteCode}/locations`} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <MapPin className="h-4 w-4" /> Mağazalar
          </Link>
          <Link href={`/stores/${siteCode}/cart`} className="relative flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <ShoppingCart className="h-5 w-5" />
            Sepet{totalItems > 0 && ` (${totalItems})`}
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  const params = useParams()
  const siteCode = params?.siteCode as string

  return (
    <CartProvider siteCode={siteCode}>
      <div className="min-h-screen bg-white">
        <StoreHeader siteCode={siteCode} />
        <main>{children}</main>
        <footer className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <StoreFooterMenus siteCode={siteCode} />
            <p className="mt-8 text-center text-xs text-zinc-400">© {new Date().getFullYear()} Rahatio. Tüm hakları saklıdır.</p>
          </div>
        </footer>
        {siteCode && <AiChat siteCode={siteCode} />}
      </div>
      {siteCode && <PixelInjector siteCode={siteCode} />}
    </CartProvider>
  )
}
