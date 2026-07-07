'use client'

import { useAuth } from '@/lib/auth'

export default function SettingsPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Ayarlar</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza ayarlarını yönet.</p>
      <div className="mt-8 space-y-6">
        <div className="rounded-xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Profil</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p><span className="font-medium text-zinc-900">Ad:</span> {user.name}</p>
            <p><span className="font-medium text-zinc-900">E-posta:</span> {user.email}</p>
            <p><span className="font-medium text-zinc-900">AI Kredisi:</span> {user.ai_credits}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
