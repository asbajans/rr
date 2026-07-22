'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Package, ShoppingCart, Sparkles, Settings, Shield, LogOut, CreditCard, Handshake, Rss, FolderKanban, MapPin, Truck, FileText, Coins, Plus, Camera, Palette, MenuIcon, FolderTree } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { AiProductCreator } from '@/components/ai/AiProductCreator'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Ürünler', icon: Package },
  { href: '/orders', label: 'Siparişler', icon: ShoppingCart },
  { href: '/b2b', label: 'B2B Keşfet', icon: Handshake },
  { href: '/b2b/requests', label: 'B2B Talepler', icon: Handshake },
  { href: '/ai', label: 'AI Görsel', icon: Sparkles },
  { href: '/variations', label: 'Varyasyonlar', icon: FolderKanban },
  { href: '/feeds', label: 'XML Feed', icon: Rss },
  { href: '/billing', label: 'Faturalandırma', icon: CreditCard },
  { href: '/payment', label: 'Ödeme', icon: CreditCard },
  { href: '/locations', label: 'Konumlar', icon: MapPin },
  { href: '/categories', label: 'Kategoriler', icon: FolderTree },
  { href: '/integrations', label: 'Pazaryeri', icon: ShoppingCart },
  { href: '/shipping', label: 'Kargo', icon: Truck },
  { href: '/pages', label: 'Sayfalar', icon: FileText },
  { href: '/menus', label: 'Menüler', icon: MenuIcon },
  { href: '/site-builder', label: 'Site Tasarım', icon: Palette },
  { href: '/credits', label: 'AI Kredileri', icon: Coins },
  { href: '/settings', label: 'Ayarlar', icon: Settings },
]

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [showAiCreator, setShowAiCreator] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const handleAiProductCreate = (product: any) => {
    router.refresh()
    setShowAiCreator(false)
  }

  if (loading || !user) return null

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center gap-2 px-2 pb-6">
          <img src="/logo.jpeg" alt="Rahatio" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-zinc-900">{user.name}</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-indigo-100 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900')}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            )
          })}
        </nav>
        {user.is_admin && (
          <Link href="/stores"
            className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
            <Shield className="h-4 w-4" />Super Admin
          </Link>
        )}
        <div className="mt-4 pt-4 border-t border-zinc-200">
          <button
            onClick={() => setShowAiCreator(true)}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <Camera className="h-4 w-4" />
            AI ile Ürün Ekle
          </button>
        </div>
        <button onClick={logout}
          className="mt-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
          <LogOut className="h-4 w-4" />Çıkış Yap
        </button>
      </aside>
      <div className="flex-1 p-8">{children}</div>
      {showAiCreator && (
        <AiProductCreator onClose={() => setShowAiCreator(false)} onSuccess={handleAiProductCreate} />
      )}
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