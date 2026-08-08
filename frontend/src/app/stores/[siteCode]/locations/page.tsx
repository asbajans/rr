'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import { MapPin, Clock, Phone } from 'lucide-react'
import type { StoreLocation } from '@/lib/types'

const LocationMap = dynamic(() => import('@/components/map/LocationMap'), { ssr: false })

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

export default function StoreLocationsPage() {
  const { siteCode } = useParams<{ siteCode: string }>()
  const [locations, setLocations] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!siteCode) return
    api.getStoreLocations(siteCode)
      .then(r => setLocations(r))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteCode])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-sm text-zinc-500">Yükleniyor...</div>
  if (error) return <div className="mx-auto max-w-4xl px-4 py-16 text-sm text-red-600">{error}</div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">Mağazalarımız</h1>
      <p className="mt-1 text-sm text-zinc-600">Bizi ziyaret edin!</p>

      {locations.length > 0 && (
        <LocationMap
          className="mt-6 h-80 w-full rounded-xl border border-zinc-200"
          markers={locations.map(l => ({ lat: l.latitude, lng: l.longitude, name: l.name, address: l.address, city: l.city }))}
          fitToMarkers
          zoom={12}
        />
      )}

      <div className="mt-6 space-y-4">
        {locations.map(loc => (
          <div key={loc.id} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-900">{loc.name || 'Mağaza'}</h3>
                <p className="text-sm text-zinc-600">{loc.address}, {loc.city}</p>
                {loc.phone && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                    <Phone className="h-3.5 w-3.5" /> {loc.phone}
                  </p>
                )}
                {loc.working_hours && (
                  <div className="mt-2 space-y-0.5">
                    {DAYS.map((day, i) => (
                      <p key={day} className="flex items-center gap-1 text-xs text-zinc-400">
                        <Clock className="h-3 w-3" />
                        <span className="w-12 font-medium">{day.slice(0, 3)}</span> {loc.working_hours![i] || '—'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
