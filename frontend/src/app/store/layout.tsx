'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { type ReactNode, useState, useEffect } from 'react'
import { CartProvider, useCart } from '@/lib/cart'
import { ShoppingCart, MapPin } from 'lucide-react'
import AiChat from '@/components/store/AiChat'
import { api } from '@/lib/api-client'

function StoreHeader({ siteCode }: { siteCode: string }) {
  const { totalItems } = useCart()
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/store/${siteCode}`} className="text-xl font-bold tracking-tight text-zinc-900">
          Rahatio
        </Link>
        <nav className="flex items-center gap-4">
          <Link href={`/store/${siteCode}/locations`} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <MapPin className="h-4 w-4" /> Mağazalar
          </Link>
          <Link href={`/store/${siteCode}/cart`} className="relative flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
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
  const [storeName, setStoreName] = useState('')

  useEffect(() => {
    if (siteCode) {
      api.getStoreFront(siteCode).then(r => setStoreName(r.store?.name || '')).catch(() => {})
    }
  }, [siteCode])

  return (
    <CartProvider siteCode={siteCode}>
      <div className="min-h-screen bg-white">
        <StoreHeader siteCode={siteCode} />
        <main>{children}</main>
        {siteCode && <AiChat siteCode={siteCode} storeName={storeName} />}
      </div>
    </CartProvider>
  )
}
