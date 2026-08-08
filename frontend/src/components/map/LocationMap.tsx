'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

export default function LocationMap({
  lat,
  lng,
  onMove,
  markers,
  fitToMarkers = true,
  zoom = 15,
  className = 'h-64 w-full rounded-lg',
}: {
  lat?: number
  lng?: number
  onMove?: (lat: number, lng: number) => void
  markers?: { lat: number; lng: number; name?: string | null; address?: string | null; city?: string | null }[]
  fitToMarkers?: boolean
  zoom?: number
  className?: string
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const coordsRef = useRef({ lat, lng })
  const markersRef = useRef(markers)
  const onMoveRef = useRef(onMove)
  const fitToMarkersRef = useRef(fitToMarkers)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    coordsRef.current = { lat, lng }
  }, [lat, lng])

  useEffect(() => {
    markersRef.current = markers
  }, [markers])

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    fitToMarkersRef.current = fitToMarkers
    zoomRef.current = zoom
  }, [fitToMarkers, zoom])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const validMarkers = (markersRef.current || []).filter(p => p.lat != null && p.lng != null && isFinite(Number(p.lat)) && isFinite(Number(p.lng)))
    const firstMarker = validMarkers[0]
    const center: [number, number] = coordsRef.current.lat != null && coordsRef.current.lng != null && isFinite(Number(coordsRef.current.lat)) && isFinite(Number(coordsRef.current.lng))
      ? [Number(coordsRef.current.lat), Number(coordsRef.current.lng)]
      : (firstMarker
          ? [Number(firstMarker.lat), Number(firstMarker.lng)]
          : [41.0082, 28.9784])

    const map = L.map(mapRef.current).setView(center, zoomRef.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    if (validMarkers.length > 0) {
      validMarkers.forEach(p => {
        L.marker([Number(p.lat), Number(p.lng)])
          .addTo(map)
          .bindPopup(`<b>${p.name || 'Mağaza'}</b><br>${p.address || ''} ${p.city || ''}`)
      })
      if (fitToMarkersRef.current) {
        const bounds = L.latLngBounds(validMarkers.map(p => [Number(p.lat), Number(p.lng)] as L.LatLngTuple))
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    } else if (onMoveRef.current) {
      const marker = L.marker(center, { draggable: true }).addTo(map)
      markerRef.current = marker
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        onMoveRef.current?.(pos.lat, pos.lng)
      })
    } else {
      L.marker(center).addTo(map)
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current && lat != null && lng != null) {
      markerRef.current.setLatLng([lat, lng])
      mapInstanceRef.current.setView([lat, lng])
    }
  }, [lat, lng])

  return <div ref={mapRef} className={className} />
}
