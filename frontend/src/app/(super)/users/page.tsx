'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import type { User } from '@/lib/types'
import type { Plan } from '@/lib/types'
import { Pencil, Coins, Tag } from 'lucide-react'

export default function SuperUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [planUserId, setPlanUserId] = useState<number | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([api.getAdminUsers(), api.getAdminPlans()])
      .then(([usersRes, plansRes]) => {
        setUsers(usersRes.data)
        setPlans(plansRes)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function grantCredits(user: User) {
    const amount = parseInt(creditAmount)
    if (!amount || amount <= 0) return
    setSaving(true)
    setMessage('')
    try {
      await api.updateAdminUser(user.id, { ai_credits: user.ai_credits + amount })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ai_credits: user.ai_credits + amount } : u))
      setMessage(`${user.name} kullanıcısına ${amount} kredi tanımlandı`)
      setEditingId(null)
      setCreditAmount('')
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(false)
    }
  }

  async function assignPlan(user: User) {
    const planId = parseInt(selectedPlan)
    if (!planId) return
    setSaving(true)
    setMessage('')
    try {
      const res = await api.assignPlanToUser(user.id, planId)
      setMessage(res.message)
      setPlanUserId(null)
      setSelectedPlan('')
    } catch (err: any) {
      setMessage(err.message || 'Paket atanamadı')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Kullanıcılar</h1>
          <p className="mt-1 text-sm text-zinc-400">Tüm kullanıcıları yönet, AI kredisi ve paket ata.</p>
        </div>
      </div>

      {message && <div className="mt-4 rounded-lg bg-zinc-800 p-3 text-sm text-green-400">{message}</div>}
      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}
      {error && <p className="mt-8 text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="mt-6 overflow-hidden rounded-xl border border-zinc-700">
          <table className="min-w-full divide-y divide-zinc-700">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Ad</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">E-posta</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">AI Kredisi</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Yetki</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700 bg-zinc-900">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-zinc-800/50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{user.id}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">{user.name}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{user.email}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{user.ai_credits}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${user.is_admin ? 'bg-amber-900/50 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {user.is_admin ? 'Admin' : 'Kullanıcı'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <div className="flex items-center gap-3">
                      {editingId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" value={creditAmount} onChange={e => setCreditAmount(e.target.value)}
                            className="w-20 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-white" placeholder="Adet" />
                          <button onClick={() => grantCredits(user)} disabled={saving}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                            {saving ? '...' : 'Ver'}
                          </button>
                          <button onClick={() => { setEditingId(null); setCreditAmount('') }}
                            className="text-xs text-zinc-500 hover:text-white">İptal</button>
                        </div>
                      ) : planUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
                            className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-white">
                            <option value="">Paket seç...</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          <button onClick={() => assignPlan(user)} disabled={saving || !selectedPlan}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                            {saving ? '...' : 'Ata'}
                          </button>
                          <button onClick={() => { setPlanUserId(null); setSelectedPlan('') }}
                            className="text-xs text-zinc-500 hover:text-white">İptal</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(user.id); setCreditAmount('') }}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                            <Coins className="h-3 w-3" /> Kredi
                          </button>
                          <button onClick={() => { setPlanUserId(user.id); setSelectedPlan('') }}
                            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300">
                            <Tag className="h-3 w-3" /> Paket Ata
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <div className="p-12 text-center text-sm text-zinc-500">Henüz kullanıcı bulunmuyor.</div>}
        </div>
      )}
    </div>
  )
}
