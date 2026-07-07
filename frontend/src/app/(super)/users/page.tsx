'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { User } from '@/lib/types'

export default function SuperUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAdminUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Kullanıcılar</h1>
      <p className="mt-1 text-sm text-zinc-600">Tüm kullanıcıları yönet.</p>
      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-600">{error}</p>}
      {!loading && !error && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Ad</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">E-posta</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">AI Kredisi</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Yetki</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{user.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{user.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{user.email}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{user.ai_credits}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.is_admin ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {user.is_admin ? 'Admin' : 'Kullanıcı'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz kullanıcı bulunmuyor.</div>
          )}
        </div>
      )}
    </div>
  )
}
