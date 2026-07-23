'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import {
  LayoutDashboard, Package, ShoppingCart, Sparkles, Settings,
  Shield, LogOut, CreditCard, Handshake, Rss, FolderKanban,
  MapPin, Truck, FileText, Coins, Camera, Palette, MenuIcon,
  FolderTree, Tag, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Ana',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Ürünler',
    items: [
      { href: '/products', label: 'Ürünler', icon: Package },
      { href: '/categories', label: 'Kategoriler', icon: FolderTree },
      { href: '/variations', label: 'Varyasyonlar', icon: FolderKanban },
      { href: '/feeds', label: 'XML Feed', icon: Rss },
    ],
  },
  {
    label: 'Satış',
    items: [
      { href: '/orders', label: 'Siparişler', icon: ShoppingCart },
      { href: '/b2b', label: 'B2B Keşfet', icon: Handshake },
      { href: '/b2b/requests', label: 'B2B Talepler', icon: Handshake },
      { href: '/integrations', label: 'Pazaryeri', icon: ShoppingCart },
    ],
  },
  {
    label: 'Site',
    items: [
      { href: '/pages', label: 'Sayfalar', icon: FileText },
      { href: '/menus', label: 'Menüler', icon: MenuIcon },
      { href: '/site-builder', label: 'Site Tasarım', icon: Palette },
      { href: '/pixels', label: 'Piksel & Takip', icon: Tag },
    ],
  },
  {
    label: 'Ayarlar',
    items: [
      { href: '/payment', label: 'Ödeme Yöntemleri', icon: CreditCard },
      { href: '/locations', label: 'Konumlar', icon: MapPin },
      { href: '/shipping', label: 'Kargo', icon: Truck },
      { href: '/ai', label: 'AI Görsel', icon: Sparkles },
      { href: '/credits', label: 'AI Kredileri', icon: Coins },
      { href: '/billing', label: 'Faturalandırma', icon: CreditCard },
      { href: '/settings', label: 'Ayarlar', icon: Settings },
    ],
  },
]

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
            {navGroups.map((group) => (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{group.label}</p>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                        )}
                        title={collapsed ? item.label : undefined}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
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
          {user.is_admin && (
            <Link href="/stores"
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              onClick={() => setMobileOpen(false)}>
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Super Admin</span>}
            </Link>
          )}
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
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
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  )
}
