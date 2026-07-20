'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'
import { Store, Users, CreditCard, LogOut, FolderTree, Sparkles } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/super/stores', label: 'Mağazalar', icon: Store },
  { href: '/super/users', label: 'Kullanıcılar', icon: Users },
  { href: '/super/plans', label: 'Planlar', icon: CreditCard },
  { href: '/super/categories', label: 'Kategoriler', icon: FolderTree },
  { href: '/super/super-ai', label: 'AI Yönetimi', icon: Sparkles },
]

function SuperShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-zinc-200 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="rounded-lg bg-white p-1">
            <img src="/logo.jpeg" alt="Rahatio" className="h-7 w-auto" />
          </div>
          <span className="text-sm font-semibold text-white">Super Admin</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white')}>
                <item.icon className="h-4 w-4" />{item.label}
              </Link>
            )
          })}
        </nav>
        <button onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white">
          <LogOut className="h-4 w-4" />Çıkış Yap
        </button>
      </aside>
      <div className="flex-1 p-8">{children}</div>
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
