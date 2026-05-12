'use client'

// Loaded only via next/dynamic with ssr:false — never runs on the server.
import { useEffect, useRef, useState } from 'react'
import type { CoffeeFarmData, TeaFarmData } from '@farms/db'

type AnyFarm = CoffeeFarmData | TeaFarmData

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

interface Props {
  farms: AnyFarm[]
  selectedId: string | null
  selectedFarm: AnyFarm | null
  onSelect: (id: string | null) => void
  onBoundsChange?: (bounds: MapBounds) => void
}

const COFFEE_COLOR = '#b45309' // amber
const TEA_COLOR    = '#15803d' // green

const isCoffee = (farm: AnyFarm) => 'varieties' in farm

const defStyle = (farm: AnyFarm): L.CircleMarkerOptions => ({
  radius: 5,
  color: '#fff',
  weight: 1.5,
  fillColor: isCoffee(farm) ? COFFEE_COLOR : TEA_COLOR,
  fillOpacity: 0.85,
  className: 'farm-dot',
  pane: 'farmDotsPane',
})

const hiStyle = (farm: AnyFarm): L.CircleMarkerOptions => ({
  radius: 8,
  color: '#fff',
  weight: 2.5,
  fillColor: isCoffee(farm) ? COFFEE_COLOR : TEA_COLOR,
  fillOpacity: 1,
  className: 'farm-dot farm-dot--selected',
  pane: 'farmDotsPane',
})

const CYCLOSM_URL = 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
const CYCLOSM_OPTIONS = {
  maxZoom: 20,
  attribution:
    '<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a> | ' +
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

export default function FarmMap({ farms, selectedId, selectedFarm, onSelect, onBoundsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, { marker: L.CircleMarker; farm: AnyFarm }>>(new Map())
  const prevSelectedRef = useRef<string | null>(null)
  const overlayRef = useRef<L.Polygon | null>(null)
  const userInteractedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)

  // Initialise the Leaflet map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled || mapRef.current || !containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl

      const map = L.map(containerRef.current!, {
        maxBounds: [[5, 67], [38, 98]],
        maxBoundsViscosity: 1,
        minZoom: 4,

      }).setView([20, 80], 6)

      mapRef.current = map
      map.createPane('farmDotsPane').style.zIndex = '450'
      setMapReady(true)

      const emitBounds = () => {
        if (!userInteractedRef.current || !onBoundsChange) return
        const b = map.getBounds()
        onBoundsChange({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('movestart', (e: any) => { if (e.originalEvent) userInteractedRef.current = true })
      map.on('moveend', emitBounds)
      map.on('zoomend', emitBounds)

      L.tileLayer(CYCLOSM_URL, { ...CYCLOSM_OPTIONS, subdomains: 'abc' }).addTo(map)

      fetch('/india.geojson')
        .then(r => r.json())
        .then(india => {
          const world: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180]]
          const polys =
            india.type === 'Polygon'
              ? [india.coordinates]
              : india.coordinates
          const poly = L.polygon(
            [world, ...polys.map((p: number[][][]) => p[0].map(c => [c[1], c[0]] as [number, number]))],
            { color: 'none', fillColor: '#ddd', fillOpacity: 0.5, interactive: false }
          ).addTo(map)
          overlayRef.current = poly
        })
        .catch(() => {})

      fetch('/india-states.geojson')
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(states => {
          L.geoJSON(states, {
            style: {
              color: '#707070',
              weight: 1,
              opacity: 0.7,
              fill: false,
            },
            interactive: false,
          }).addTo(map)
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current.clear()
      overlayRef.current = null
    }
  }, [])

  // Sync markers whenever the farms list changes
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(L => {
      const map = mapRef.current!
      const existing = markersRef.current
      const nextIds = new Set(farms.map(f => f.id))

      // Remove stale markers
      existing.forEach(({ marker }, id) => {
        if (!nextIds.has(id)) {
          marker.remove()
          existing.delete(id)
        }
      })

      // Add new markers
      farms.forEach(farm => {
        if (farm.lat == null || farm.lng == null) return
        if (existing.has(farm.id)) return

        const popup =
          `<strong>${farm.name}</strong>` +
          (farm.address ? `<br><span class="popup-address">${farm.address}</span>` : '') +
          `<br>${farm.city}, ${farm.state}` +
          (farm.url
            ? `<br><a href="${farm.url}" target="_blank" rel="noopener">Website →</a>`
            : '')

        const marker = L.circleMarker([farm.lat, farm.lng], defStyle(farm))
          .bindPopup(popup, { autoClose: false })
          .addTo(map)

        marker.on('click', () => onSelect(farm.id))
        existing.set(farm.id, { marker, farm })
      })

      // Only fit bounds on initial load before the user has panned/zoomed
      if (!selectedId && !userInteractedRef.current) {
        const coords: [number, number][] = []
        existing.forEach(({ marker }, id) => {
          if (nextIds.has(id)) coords.push([marker.getLatLng().lat, marker.getLatLng().lng])
        })
        if (coords.length) {
          map.fitBounds(coords, { padding: [30, 30], maxZoom: 12 })
        }
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms, onSelect, mapReady])

  // Highlight + flyTo when selection changes
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(() => {
      const map = mapRef.current!
      const prev = prevSelectedRef.current

      // Deselect previous marker
      if (prev) {
        const entry = markersRef.current.get(prev)
        if (entry) { entry.marker.setStyle(defStyle(entry.farm)); entry.marker.closePopup() }
      }

      // Select new marker and fly to it
      if (selectedId) {
        const entry = markersRef.current.get(selectedId)
        if (entry) {
          entry.marker.setStyle(hiStyle(entry.farm))
          entry.marker.bringToFront()
          entry.marker.openPopup()
        }

        // Fly to the farm's coordinates (use selectedFarm prop for accuracy,
        // fall back to the marker position if the farm was filtered out)
        const lat = selectedFarm?.lat ?? entry?.marker.getLatLng().lat
        const lng = selectedFarm?.lng ?? entry?.marker.getLatLng().lng
        if (lat != null && lng != null) {
          map.setView([lat, lng], 13, { animate: false })
        }
      } else if (!userInteractedRef.current) {
        // Nothing selected and user hasn't manually navigated — zoom to show all markers
        const coords: [number, number][] = []
        markersRef.current.forEach(({ marker }) => {
          coords.push([marker.getLatLng().lat, marker.getLatLng().lng])
        })
        if (coords.length) {
          map.fitBounds(coords, { padding: [30, 30], maxZoom: 12, animate: true })
        }
      }

      prevSelectedRef.current = selectedId
    })
  }, [selectedId, selectedFarm, mapReady])

  return (
    <div ref={containerRef} id="map" />
  )
}
