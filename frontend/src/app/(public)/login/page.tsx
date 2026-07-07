'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const user = await login(email, password)
      router.push(user.is_admin ? '/stores' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız')
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Giriş Yap</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Henüz hesabın yok mu?{' '}
          <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">Kaydol</Link>
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-900">E-posta</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-900">Şifre</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <Button type="submit" className="w-full">Giriş Yap</Button>
        </form>
      </div>
    </div>
  )
}
