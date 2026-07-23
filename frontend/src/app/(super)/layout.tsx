'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Store, Users, CreditCard, LogOut, FolderTree, Sparkles, Settings, Cpu, Gauge, Layers, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/stores', label: 'Mağazalar', icon: Store },
  { href: '/users', label: 'Kullanıcılar', icon: Users },
  { href: '/plans', label: 'Planlar', icon: CreditCard },
  { href: '/super/categories', label: 'Kategoriler', icon: FolderTree },
  { href: '/super-ai', label: 'AI Yönetimi', icon: Sparkles },
  { href: '/api-settings', label: 'API Ayarları', icon: Settings },
  { href: '/ai-providers', label: 'AI Sağlayıcılar', icon: Cpu },
  { href: '/ai-scenarios', label: 'AI Senaryoları', icon: Layers },
  { href: '/ai-rate-limits', label: 'AI Rate Limits', icon: Gauge },
]

function SuperShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="flex min-h-screen bg-zinc-950">
      <aside className={cn(
        'flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}>
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="rounded-lg bg-white p-1 shrink-0">
              <img src="/logo.jpeg" alt="Rahatio" className="h-6 w-auto" />
            </div>
            {!collapsed && <span className="text-sm font-semibold text-white truncate">Super Admin</span>}
          </div>
          <button onClick={() => setCollapsed(c => !c)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
                  )}
                  title={collapsed ? item.label : undefined}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-800 hover:text-white">
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}

export default function SuperLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SuperShell>{children}</SuperShell>
    </AuthProvider>
  )
}
