'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [error, setError] = useState('')
  const { register } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const user = await register(name, email, password, storeName || undefined)
      router.push(user.is_admin ? '/stores' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız')
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Hesap Oluştur</h1>
        <p className="mt-1 text-sm text-zinc-600">Rahatio'ya hoş geldin.</p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700">Ad Soyad</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Mağaza Adı</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)}
              placeholder="(isteğe bağlı)"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">E-posta</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Şifre</label>
            <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <Button type="submit" className="w-full">Kaydol</Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Hesabın var mı?{' '}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">Giriş Yap</Link>
        </p>
      </div>
    </div>
  )
}
