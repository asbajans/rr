'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ShoppingCart, Sparkles, Truck, X } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { StoreNotification } from '@/lib/types'

const NOTIF_ICONS: Record<string, typeof ShoppingCart> = {
  new_order: ShoppingCart,
  order_status: Truck,
  system: Sparkles,
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins} dk`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa`
  const days = Math.floor(hrs / 24)
  return `${days} g`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<StoreNotification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const [list, count] = await Promise.all([api.getNotifications(20, 0), api.getUnreadCount()])
      setNotifications(list.notifications)
      setUnread(count.unreadCount)
    } catch {
      /* auth not ready */
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    await api.markAllNotificationsRead()
    setUnread(0)
    setNotifications(ns => ns.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
  }

  const markRead = async (n: StoreNotification) => {
    if (!n.readAt) {
      await api.markNotificationRead(n.id)
      setUnread(u => Math.max(0, u - 1))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="Bildirimler">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <p className="text-sm font-semibold text-zinc-900">Bildirimler</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAllRead} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600" title="Tümünü okundu işaretle">
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-400">Bildirim yok</p>
            ) : (
              notifications.map(n => {
                const Icon = NOTIF_ICONS[n.type] || Sparkles
                const orderId = n.data?.orderId
                return (
                  <div key={n.id} onClick={() => markRead(n)}
                    className={`flex gap-3 border-b border-zinc-50 px-3 py-2.5 ${n.readAt ? '' : 'bg-indigo-50/50'}`}>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-zinc-500">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-400">{timeAgo(n.createdAt)}</p>
                      {orderId && (
                        <Link href={`/orders/${orderId}`} className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:underline">
                          Siparişi aç
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
