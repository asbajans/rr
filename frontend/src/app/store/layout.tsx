'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { type ReactNode } from 'react'
import { CartProvider, useCart } from '@/lib/cart'
import { ShoppingCart } from 'lucide-react'

function CartBadge() {
  const { totalItems } = useCart()
  if (totalItems === 0) return null
  return (
    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white">
      {totalItems > 9 ? '9+' : totalItems}
    </span>
  )
}

function StoreHeader({ siteCode }: { siteCode: string }) {
  const { totalItems } = useCart()
  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/store/${siteCode}`} className="text-xl font-bold tracking-tight text-zinc-900">
          Rahatio
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href={`/store/${siteCode}/cart`}
            className="relative flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
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
      </div>
    </CartProvider>
  )
}
