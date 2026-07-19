'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { MapPin, Plus, Pencil, Trash2, Clock } from 'lucide-react'
import type { StoreLocation } from '@/lib/types'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

function LocationMap({ lat, lng, onMove }: { lat: number; lng: number; onMove?: (lat: number, lng: number) => void }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const marker = L.marker([lat, lng], { draggable: !!onMove }).addTo(map)
    markerRef.current = marker

    if (onMove) {
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onMove(pos.lat, pos.lng)
      })
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([lat, lng])
      mapInstanceRef.current.setView([lat, lng])
    }
  }, [lat, lng])

  return <div ref={mapRef} className="h-64 w-full rounded-lg" />
}

export default function LocationsPage() {
  const { user } = useAuth()
  const [locations, setLocations] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', latitude: 41.0082, longitude: 28.9784, address: '',
    city: '', country: 'Türkiye', phone: '', is_primary: false,
    working_hours: ['09:00-18:00', '09:00-18:00', '09:00-18:00', '09:00-18:00', '09:00-18:00', '10:00-16:00', 'Kapalı'],
  })

  useEffect(() => {
    api.getLocations().then(r => setLocations(r)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function openNew() {
    setForm({ name: '', latitude: 41.0082, longitude: 28.9784, address: '', city: '', country: 'Türkiye', phone: '', is_primary: false, working_hours: ['09:00-18:00', '09:00-18:00', '09:00-18:00', '09:00-18:00', '09:00-18:00', '10:00-16:00', 'Kapalı'] })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(loc: StoreLocation) {
    setForm({ name: loc.name || '', latitude: loc.latitude, longitude: loc.longitude, address: loc.address, city: loc.city, country: loc.country, phone: loc.phone || '', is_primary: loc.is_primary, working_hours: loc.working_hours || form.working_hours })
    setEditingId(loc.id)
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      if (editingId) {
        await api.updateLocation(editingId, form)
        setMessage('Konum güncellendi')
      } else {
        await api.createLocation(form)
        setMessage('Konum eklendi')
      }
      setShowForm(false)
      api.getLocations().then(r => setLocations(r))
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Silmek istediğine emin misin?')) return
    try {
      await api.deleteLocation(id)
      setLocations(prev => prev.filter(l => l.id !== id))
      setMessage('Konum silindi')
    } catch (err: any) {
      setMessage(err.message || 'Hata')
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Mağaza Konumları</h1>
          <p className="mt-1 text-sm text-zinc-600">Mağaza lokasyonlarını harita üzerinde yönet.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800">
          <Plus className="h-4 w-4" /> Konum Ekle
        </button>
      </div>

      {message && <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      {loading ? (
        <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Map Overview */}
          {locations.length > 0 && (
            <LocationMap lat={locations[0].latitude} lng={locations[0].longitude} />
          )}

          {/* Locations List */}
          {locations.map(loc => (
            <div key={loc.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{loc.name || 'İsimsiz Konum'}</h3>
                    <p className="text-xs text-zinc-500">{loc.address}, {loc.city}</p>
                    {loc.phone && <p className="text-xs text-zinc-400">{loc.phone}</p>}
                    <p className="text-xs text-zinc-400">{loc.latitude}, {loc.longitude}</p>
                    {loc.is_primary && <span className="mt-1 inline-block rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">Varsayılan</span>}
                    {loc.working_hours && (
                      <div className="mt-2 flex items-start gap-1 text-[10px] text-zinc-400">
                        <Clock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <div>
                          {DAYS.map((day, i) => (
                            <span key={day} className="mr-2">{day.slice(0, 2)}: {loc.working_hours![i] || '—'}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(loc)} className="p-1.5 text-zinc-400 hover:text-zinc-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(loc.id)} className="p-1.5 text-zinc-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}

          {locations.length === 0 && (
            <div className="rounded-xl border border-zinc-200 p-12 text-center text-sm text-zinc-500">
              Henüz konum eklenmemiş.
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-zinc-900">{editingId ? 'Konum Düzenle' : 'Yeni Konum'}</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Konum Adı</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              </div>
              <LocationMap lat={form.latitude} lng={form.longitude}
                onMove={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Enlem</label>
                  <input type="number" step="any" value={form.latitude}
                    onChange={e => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Boylam</label>
                  <input type="number" step="any" value={form.longitude}
                    onChange={e => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">Adres</label>
                <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Şehir</label>
                  <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Telefon</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">Çalışma Saatleri</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {DAYS.map((day, i) => (
                    <div key={day} className="flex items-center gap-1">
                      <span className="w-8 text-[10px] text-zinc-500">{day.slice(0, 2)}</span>
                      <input value={form.working_hours[i]} onChange={e => {
                        const wh = [...form.working_hours]; wh[i] = e.target.value; setForm({ ...form, working_hours: wh })
                      }} className="block w-full rounded border border-zinc-300 px-2 py-1 text-xs font-mono" />
                    </div>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" checked={form.is_primary} onChange={e => setForm({ ...form, is_primary: e.target.checked })}
                  className="rounded border-zinc-300" />
                Varsayılan konum
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={save} disabled={saving}
                className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
