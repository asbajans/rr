'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, Sparkles, Settings,
  Shield, LogOut, CreditCard, Handshake, Rss, FolderKanban,
  MapPin, Truck, FileText, Camera, Palette, MenuIcon,
  FolderTree, Tag, ChevronLeft, ChevronRight, X, Building2, GitMerge,
  Coins, Wand2, Newspaper, Users,
} from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { I18nProvider, useI18n, LanguageSwitcher } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import NotificationBell from '@/components/ui/notification-bell'

const navGroups = [
  {
    labelKey: 'groupAna',
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    ],
  },
  {
    labelKey: 'groupAi',
    items: [
      { href: '/ai/studio', labelKey: 'aiStudio', icon: Wand2 },
      { href: '/ai', labelKey: 'ai', icon: Sparkles },
    ],
  },
  {
    labelKey: 'groupProducts',
    items: [
      { href: '/products', labelKey: 'products', icon: Package },
      { href: '/products/merge', labelKey: 'merge', icon: GitMerge },
      { href: '/categories', labelKey: 'categories', icon: FolderTree },
      { href: '/brands', labelKey: 'brands', icon: Building2 },
      { href: '/variations', labelKey: 'variations', icon: FolderKanban },
      { href: '/feeds', labelKey: 'feeds', icon: Rss },
    ],
  },
  {
    labelKey: 'groupSales',
    items: [
      { href: '/orders', labelKey: 'orders', icon: ShoppingCart },
      { href: '/customers', labelKey: 'customers', icon: Users },
      { href: '/marketplaces', labelKey: 'marketplaces', icon: ShoppingCart },
      { href: '/b2b', labelKey: 'b2b', icon: Handshake },
      { href: '/b2b/requests', labelKey: 'b2bRequests', icon: Handshake },
      { href: '/supplier', labelKey: 'supplier', icon: Truck },
      { href: '/payment', labelKey: 'payment', icon: CreditCard },
      { href: '/shipping', labelKey: 'shipping', icon: Truck },
      { href: '/locations', labelKey: 'locations', icon: MapPin },
    ],
  },
  {
    labelKey: 'groupSite',
    items: [
      { href: '/pages', labelKey: 'pages', icon: FileText },
      { href: '/blog-posts', labelKey: 'blog', icon: Newspaper },
      { href: '/menus', labelKey: 'menus', icon: MenuIcon },
      { href: '/site-builder', labelKey: 'siteBuilder', icon: Palette },
      { href: '/pixels', labelKey: 'pixels', icon: Tag },
    ],
  },
  {
    labelKey: 'groupSettings',
    items: [
      { href: '/credits', labelKey: 'credits', icon: Coins },
      { href: '/billing', labelKey: 'plan', icon: CreditCard },
      { href: '/settings', labelKey: 'settings', icon: Settings },
    ],
  },
]

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout, can } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === '/b2b' || item.href === '/b2b/requests') return can('b2b')
      if (item.href === '/blog') return can('blog')
      return true
    }),
  }))
  const activeHref = nav.flatMap((group) => group.items)
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setCollapsed(e.matches)
      if (e.matches) setMobileOpen(false)
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (loading || !user) return null

  const sidebarWidth = collapsed ? 'w-16' : 'w-60'

  return (
    <div className="flex min-h-screen bg-zinc-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col border-r border-zinc-200 bg-white transition-all duration-200',
        sidebarWidth,
        mobileOpen ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:flex',
      )}>
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4">
          {!collapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/logo.jpeg" alt="Rahatio" className="h-7 w-7 rounded-lg" />
              <span className="text-sm font-semibold text-zinc-900 truncate">{user.name}</span>
            </div>
          )}
            <div className="flex items-center gap-1">
              {mobileOpen && (
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 lg:hidden">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setCollapsed(c => !c)} className="hidden lg:block rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
            <div className="space-y-6">
              {nav.map((group) => (
                <div key={group.labelKey}>
                  {!collapsed && (
                    <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t(group.labelKey)}</p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = activeHref === item.href
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                          )}
                          title={collapsed ? t(item.labelKey) : undefined}>
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {/* Bottom */}
          <div className="border-t border-zinc-100 p-3 space-y-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{t('groupSettings')}</span>
              <NotificationBell />
            </div>
            {user.is_admin && (
              <Link href="/stores"
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
                onClick={() => setMobileOpen(false)}>
                <Shield className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t('superAdmin')}</span>}
              </Link>
            )}
            <button onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t('logout')}</span>}
            </button>
            {!collapsed && (
              <div className="pt-1">
                <LanguageSwitcher />
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100">
              <MenuIcon className="h-5 w-5" />
            </button>
            <img src="/logo.jpeg" alt="Rahatio" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-zinc-900">Rahatio</span>
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <LanguageSwitcher />
            </div>
          </header>

        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider>
        <DashboardShell>{children}</DashboardShell>
      </I18nProvider>
    </AuthProvider>
  )
}
