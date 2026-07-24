import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type Map as MapLibreMapType,
} from 'maplibre-gl'
// Force Vite to emit a real URL for the MapLibre worker (avoids blank map in dev)
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { PickingInfo, Layer } from '@deck.gl/core'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useAppStore } from '../store/useAppStore'
import { statusRgba } from '../lib/colors'
import {
  deviceParticleMultiplier,
  particleBudget,
} from '../lib/throughput'
import type { StationFeature, TunnelFeature, TunnelStatus } from '../types'

// Must run before any Map is constructed
setWorkerUrl(maplibreWorkerUrl)

/** Free dark basemap — no API key (OpenFreeMap) */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'

interface Trip {
  path: [number, number][]
  timestamps: number[]
  color: [number, number, number]
  status: TunnelStatus
}

function buildTrips(
  tunnels: TunnelFeature[],
  layers: Record<TunnelStatus, boolean>,
  whatIf: number,
): Trip[] {
  const mult = deviceParticleMultiplier() * whatIf
  const trips: Trip[] = []

  for (const feature of tunnels) {
    const status = feature.properties.status
    if (!layers[status]) continue

    const coords = feature.geometry.coordinates as [number, number][]
    if (coords.length < 2) continue

    const count = Math.max(
      1,
      Math.round(particleBudget(feature.properties.capacity_pph) * mult * 0.35),
    )
    const color = statusRgba(status).slice(0, 3) as [number, number, number]
    const duration = 8 + Math.random() * 6

    for (let i = 0; i < count; i++) {
      const offset = Math.random() * duration
      const timestamps = coords.map(
        (_, idx) => offset + (idx / (coords.length - 1)) * duration,
      )
      trips.push({ path: coords, timestamps, color, status })
    }
  }

  return trips
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMapType | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)
  const rideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const city = useAppStore((s) => s.cities.find((c) => c.id === s.cityId) ?? null)
  const cityId = useAppStore((s) => s.cityId)
  const tunnels = useAppStore((s) => s.tunnels)
  const stations = useAppStore((s) => s.stations)
  const layers = useAppStore((s) => s.layers)
  const flyToken = useAppStore((s) => s.flyToken)
  const whatIfFactor = useAppStore((s) => s.whatIfFactor)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const timeOfDay = useAppStore((s) => s.timeOfDay)
  const setSelectedStation = useAppStore((s) => s.setSelectedStation)

  const trips = useMemo(() => {
    if (!tunnels || !layers.particles) return []
    return buildTrips(
      tunnels.features as TunnelFeature[],
      {
        operational: layers.operational,
        under_construction: layers.under_construction,
        planned: layers.planned,
      },
      whatIfFactor,
    )
  }, [tunnels, layers, whatIfFactor])

  // Init map once
  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    let cancelled = false
    let map: MapLibreMapType | null = null
    let overlay: MapboxOverlay | null = null
    let ro: ResizeObserver | null = null

    try {
      map = new MapLibreMap({
        container: el,
        style: MAP_STYLE,
        center: [-115.172, 36.125],
        zoom: 12.2,
        pitch: 55,
        bearing: -20,
        attributionControl: {},
        maxPitch: 75,
      })

      map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
      map.addControl(new ScaleControl({ maxWidth: 120 }), 'bottom-left')

      overlay = new MapboxOverlay({
        interleaved: false,
        layers: [],
      })
      map.addControl(overlay)

      map.on('error', (e) => {
        console.error('[maplibre]', e.error)
        // Style/tile errors shouldn't blank the whole UI; only surface hard init failures
      })

      map.once('load', () => {
        if (cancelled) return
        map?.resize()
        setMapReady(true)
      })

      ro = new ResizeObserver(() => {
        map?.resize()
      })
      ro.observe(el)

      mapRef.current = map
      overlayRef.current = overlay
      setMapError(null)
    } catch (err) {
      console.error(err)
      setMapError(err instanceof Error ? err.message : 'Failed to initialize map')
    }

    return () => {
      cancelled = true
      setMapReady(false)
      if (rideTimerRef.current) clearTimeout(rideTimerRef.current)
      cancelAnimationFrame(animRef.current)
      ro?.disconnect()
      try {
        overlay?.finalize()
      } catch {
        /* ignore */
      }
      try {
        map?.remove()
      } catch {
        /* ignore */
      }
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

  // Fly to city
  useEffect(() => {
    const map = mapRef.current
    if (!map || !city || flyToken === 0 || !mapReady) return

    map.flyTo({
      center: city.center,
      zoom: city.zoom,
      pitch: city.pitch,
      bearing: city.bearing,
      duration: 2200,
      essential: true,
    })
  }, [flyToken, cityId, city, mapReady])

  // First-person mode: follow tunnel path roughly
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tunnels || cameraMode !== 'first_person' || !mapReady) return

    const operational =
      tunnels.features.find((f) => f.properties.status === 'operational') ??
      tunnels.features[0]
    if (!operational) return

    const coords = operational.geometry.coordinates as [number, number][]
    let i = 0
    let cancelled = false

    const step = () => {
      if (cancelled || !mapRef.current) return
      const a = coords[i % coords.length]
      const b = coords[(i + 1) % coords.length]
      const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
      mapRef.current.easeTo({
        center: a,
        zoom: 16.5,
        pitch: 70,
        bearing,
        duration: 900,
      })
      i += 1
      rideTimerRef.current = setTimeout(step, 950)
    }
    step()

    return () => {
      cancelled = true
      if (rideTimerRef.current) clearTimeout(rideTimerRef.current)
    }
  }, [cameraMode, tunnels, cityId, mapReady])

  // Deck layers + particle animation
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || !mapReady) return

    let cancelled = false
    const loop = () => {
      if (cancelled) return
      timeRef.current = (timeRef.current + 0.04) % 30

      const tunnelFeatures = (tunnels?.features ?? []) as TunnelFeature[]
      const stationFeatures = (stations?.features ?? []) as StationFeature[]

      const visibleTunnels = tunnelFeatures.filter((f) => layers[f.properties.status])
      const visibleStations = layers.stations
        ? stationFeatures.filter((f) => layers[f.properties.status])
        : []

      const night =
        timeOfDay < 6 || timeOfDay > 19
          ? 1
          : timeOfDay < 8 || timeOfDay > 17
            ? 0.7
            : 0.4

      const deckLayers: Layer[] = [
        new PathLayer<TunnelFeature>({
          id: 'tunnels-glow',
          data: visibleTunnels,
          getPath: (d) => d.geometry.coordinates as [number, number][],
          getColor: (d) => {
            const [r, g, b, a] = statusRgba(d.properties.status)
            return [r, g, b, Math.round(a * 0.35 * night)]
          },
          getWidth: 18,
          widthUnits: 'meters',
          widthMinPixels: 6,
          capRounded: true,
          jointRounded: true,
          pickable: false,
        }),
        new PathLayer<TunnelFeature>({
          id: 'tunnels-core',
          data: visibleTunnels,
          getPath: (d) => d.geometry.coordinates as [number, number][],
          getColor: (d) => {
            const [r, g, b, a] = statusRgba(d.properties.status)
            const alpha =
              d.properties.status === 'planned'
                ? Math.round(a * 0.75 * night)
                : Math.round(a * night)
            return [r, g, b, alpha]
          },
          getWidth: (d) => (d.properties.status === 'operational' ? 10 : 7),
          widthUnits: 'meters',
          widthMinPixels: 3,
          capRounded: true,
          jointRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
        }),
      ]

      if (layers.particles && trips.length > 0) {
        deckLayers.push(
          new TripsLayer<Trip>({
            id: 'vehicle-trips',
            data: trips,
            getPath: (d) => d.path,
            getTimestamps: (d) => d.timestamps,
            getColor: (d) => [...d.color, 230] as [number, number, number, number],
            getWidth: 3,
            widthMinPixels: 2,
            trailLength: 1.2,
            currentTime: timeRef.current,
          }),
        )
      }

      deckLayers.push(
        new ScatterplotLayer<StationFeature>({
          id: 'stations',
          data: visibleStations,
          getPosition: (d) => d.geometry.coordinates as [number, number],
          getFillColor: (d) => statusRgba(d.properties.status),
          getLineColor: [255, 255, 255, 180],
          getRadius: 55,
          radiusUnits: 'meters',
          radiusMinPixels: 6,
          radiusMaxPixels: 18,
          stroked: true,
          lineWidthMinPixels: 1.5,
          pickable: true,
          autoHighlight: true,
          onClick: (info: PickingInfo<StationFeature>) => {
            if (info.object) setSelectedStation(info.object)
          },
        }),
      )

      overlay.setProps({ layers: deckLayers })
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
    }
  }, [tunnels, stations, layers, trips, timeOfDay, setSelectedStation, mapReady])

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-md rounded-xl border border-rose-500/40 bg-zinc-950 p-4 text-sm text-rose-200">
            <p className="font-semibold text-rose-100">Map failed to start</p>
            <p className="mt-2 text-rose-200/80">{mapError}</p>
            <p className="mt-3 text-xs text-zinc-500">
              Try hard-refreshing, or run: rm -rf node_modules/.vite && npm run dev
            </p>
          </div>
        </div>
      )}

      {city && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border border-cyan-500/20 bg-black/55 px-3 py-2 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
            Viewing
          </p>
          <p className="font-semibold text-white">{city.shortName}</p>
          <p className="text-xs text-zinc-400">{city.name}</p>
        </div>
      )}
    </div>
  )
}
