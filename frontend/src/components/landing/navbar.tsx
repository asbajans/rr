'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'

export function Navbar() {
  const { user, loading } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold tracking-tight text-zinc-900">
          Rahatio
        </Link>
        <div className="hidden items-center gap-6 sm:flex">
          <Link href="/features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Özellikler
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Fiyatlandırma
          </Link>
          <Link href="/blog" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            Blog
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link href={user.is_admin ? '/stores' : '/dashboard'} className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
                {user.name}
              </Link>
              <Link href={user.is_admin ? '/stores' : '/dashboard'}>
                <Button size="sm">Panele Git</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Giriş Yap</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Başla</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
