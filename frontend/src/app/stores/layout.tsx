'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { type ReactNode, useState, useEffect } from 'react'
import { CartProvider, useCart } from '@/lib/cart'
import { ShoppingCart, MapPin, UserRound, Menu, X, Newspaper } from 'lucide-react'
import AiChat from '@/components/store/AiChat'
import WhatsAppButton from '@/components/store/WhatsAppButton'
import PixelInjector from '@/components/store/PixelInjector'
import StoreThemeInjector from '@/components/store/StoreTheme'
import { StoreMenuBar, StoreFooterMenus } from '@/components/store/StoreMenuBar'
import { api } from '@/lib/api-client'
import type { StoreMenu, StoreMenuItem } from '@/lib/types'

function itemUrl(item: StoreMenuItem, siteCode: string, pageSlugs: Map<number, string>): string {
  if (item.page_id && pageSlugs.has(item.page_id)) {
    return `/stores/${siteCode}/pages/${pageSlugs.get(item.page_id)}`
  }
  if (item.url) return item.url
  return '#'
}

function MobileMenu({ siteCode, open, onClose }: { siteCode: string; open: boolean; onClose: () => void }) {
  const [menus, setMenus] = useState<StoreMenu[]>([])
  const [pageSlugs, setPageSlugs] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (!open || !siteCode) return
    let active = true
    api.getStoreMenus(siteCode).then(ms => {
      if (!active) return
      setMenus(ms.filter(m => m.location === 'header'))
      return api.getStorePages(siteCode).then((pages: any[]) => {
        if (!active) return
        const map = new Map<number, string>()
        pages.forEach((p: any) => { if (p?.id && p?.slug) map.set(p.id, p.slug) })
        setPageSlugs(map)
      })
    }).catch(() => {})
    return () => { active = false }
  }, [siteCode, open])

  const items = menus.flatMap(m => Array.isArray(m.items) ? (m.items as StoreMenuItem[]) : [])

  return (
    <div className={`lg:hidden ${open ? 'block' : 'hidden'} border-t border-zinc-200 bg-white`}>
      <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4 sm:px-6">
        {items.map(item => (
          <div key={item.id}>
            <Link
              href={itemUrl(item, siteCode, pageSlugs)}
              onClick={onClose}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {item.label}
            </Link>
            {(item.children?.length ?? 0) > 0 && (
              <div className="ml-3 space-y-0.5 border-l border-zinc-100 pl-3">
                {(item.children ?? []).map(child => (
                  <Link
                    key={child.id}
                    href={itemUrl(child, siteCode, pageSlugs)}
                    onClick={onClose}
                    className="block rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="mt-2 border-t border-zinc-100 pt-3">
          <Link href={`/stores/${siteCode}/blog`} onClick={onClose} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <Newspaper className="h-4 w-4 text-zinc-400" /> Blog
          </Link>
          <Link href={`/stores/${siteCode}/locations`} onClick={onClose} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <MapPin className="h-4 w-4 text-zinc-400" /> Mağazalar
          </Link>
          <Link href={`/stores/${siteCode}/account`} onClick={onClose} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <UserRound className="h-4 w-4 text-zinc-400" /> Hesabım
          </Link>
          <Link href={`/stores/${siteCode}/cart`} onClick={onClose} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            <ShoppingCart className="h-4 w-4 text-zinc-400" /> Sepet
          </Link>
        </div>
      </nav>
    </div>
  )
}

function StoreHeader({ siteCode }: { siteCode: string }) {
  const { totalItems } = useCart()
  const [storeName, setStoreName] = useState('')
  const [theme, setTheme] = useState<any>({})
  const [menuOpen, setMenuOpen] = useState(false)

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
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden"
            aria-label="Menü"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href={`/stores/${siteCode}`} className="flex shrink-0 items-center gap-2">
            {theme.logo_url ? (
              <img src={theme.logo_url} alt={storeName || 'Mağaza'} className="h-9 w-auto object-contain" />
            ) : (
              <span className="truncate text-xl font-bold tracking-tight text-zinc-900">{storeName || 'Rahatio'}</span>
            )}
          </Link>
        </div>
        <div className="hidden lg:block">
          <StoreMenuBar siteCode={siteCode} location="header" />
        </div>
        <nav className="flex shrink-0 items-center gap-3 lg:gap-4">
          <Link href={`/stores/${siteCode}/blog`} className="hidden items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:flex">
            <Newspaper className="h-4 w-4" /> Blog
          </Link>
          <Link href={`/stores/${siteCode}/locations`} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <MapPin className="h-4 w-4" />
            <span className="hidden lg:inline">Mağazalar</span>
          </Link>
          <Link href={`/stores/${siteCode}/account`} className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <UserRound className="h-4 w-4" />
            <span className="hidden lg:inline">Hesabım</span>
          </Link>
          <Link href={`/stores/${siteCode}/cart`} className="relative flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden lg:inline">Sepet</span>
            {totalItems > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-semibold text-white">{totalItems}</span>}
          </Link>
        </nav>
      </div>
      <MobileMenu siteCode={siteCode} open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}

function StoreUnpublished() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col items-center px-4 py-32 text-center sm:px-6 lg:px-8">
      <div className="text-5xl">🚧</div>
      <h1 className="mt-4 text-xl font-bold text-zinc-900">Bu mağaza henüz yayında değil</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Mağaza sahibi siteyi henüz yayınlamadı. Lütfen daha sonra tekrar deneyin.
      </p>
      <Link href="/" className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-500">Ana Sayfaya Dön</Link>
    </div>
  )
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  const params = useParams()
  const siteCode = params?.siteCode as string
  const [published, setPublished] = useState(true)

  useEffect(() => {
    if (!siteCode) return
    api.getStoreFront(siteCode).then((r: any) => {
      const store = r?.store ?? r ?? {}
      setPublished(store.published !== false)
    }).catch(() => setPublished(false))
  }, [siteCode])

  if (!published) {
    return (
      <div className="min-h-screen bg-white">
        <StoreUnpublished />
      </div>
    )
  }

  return (
    <CartProvider siteCode={siteCode}>
      <div data-storefront className="min-h-screen bg-white">
        <StoreThemeInjector siteCode={siteCode} />
        <StoreHeader siteCode={siteCode} />
        <main>{children}</main>
        <footer className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <StoreFooterMenus siteCode={siteCode} />
            <p className="mt-8 text-center text-xs text-zinc-400">© {new Date().getFullYear()} Rahatio. Tüm hakları saklıdır.</p>
          </div>
        </footer>
        {siteCode && <AiChat siteCode={siteCode} />}
        {siteCode && <WhatsAppButton siteCode={siteCode} />}
      </div>
      {siteCode && <PixelInjector siteCode={siteCode} />}
    </CartProvider>
  )
}
