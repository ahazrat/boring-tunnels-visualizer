import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type Map as MapLibreMapType,
} from 'maplibre-gl'
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
import type {
  PathCoord,
  StationFeature,
  TunnelFeature,
  TunnelStatus,
} from '../types'

/**
 * Absolute worker URL under Vite `base` (required for GitHub Pages subpath).
 * Worker ESM imports ./maplibre-gl-shared.mjs from the same public/maplibre folder.
 */
function configureMaplibreWorker(): void {
  const base = import.meta.env.BASE_URL || '/'
  const workerPath = `${base}maplibre/maplibre-gl-worker.mjs`.replace(
    /\/{2,}/g,
    '/',
  )
  const absolute = new URL(workerPath, window.location.href).href
  setWorkerUrl(absolute)
}

configureMaplibreWorker()

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark'

interface Trip {
  path: PathCoord[]
  timestamps: number[]
  color: [number, number, number]
  status: TunnelStatus
}

/** Flatten 3D path to 2D when depth profile is off (cheaper + flatter map). */
function pathForRender(
  coords: GeoJSON.Position[],
  depth3d: boolean,
): PathCoord[] {
  if (depth3d) {
    return coords.map((c) => {
      if (c.length >= 3) return [c[0], c[1], c[2]] as PathCoord
      return [c[0], c[1], 0] as PathCoord
    })
  }
  return coords.map((c) => [c[0], c[1]] as PathCoord)
}

function buildTrips(
  tunnels: TunnelFeature[],
  layers: Record<TunnelStatus, boolean>,
  whatIf: number,
  depth3d: boolean,
): Trip[] {
  // Cap particles hard for snappy UX even when enabled
  const mult = deviceParticleMultiplier() * whatIf * 0.45
  const trips: Trip[] = []

  for (const feature of tunnels) {
    const status = feature.properties.status
    if (!layers[status]) continue

    const raw = feature.geometry.coordinates
    if (raw.length < 2) continue
    const coords = pathForRender(raw, depth3d)
    const count = Math.max(
      1,
      Math.min(
        8,
        Math.round(particleBudget(feature.properties.capacity_pph, 40) * mult * 0.25),
      ),
    )
    const color = statusRgba(status).slice(0, 3) as [number, number, number]
    const duration = 10 + Math.random() * 6

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

  const needsAnimation = layers.particles

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
      layers.depth3d,
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
        pitch: 45,
        bearing: -20,
        attributionControl: {},
        maxPitch: 75,
        // Prefer lower GPU load by default
        maxTileCacheSize: 50,
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

  // Fly to city — slightly lower pitch when depth3d off for snappier feel
  useEffect(() => {
    const map = mapRef.current
    if (!map || !city || flyToken === 0 || !mapReady) return

    const pitch = layers.depth3d ? Math.max(city.pitch, 55) : Math.min(city.pitch, 48)

    map.flyTo({
      center: city.center,
      zoom: city.zoom,
      pitch,
      bearing: city.bearing,
      duration: 1600,
      essential: true,
    })
  }, [flyToken, cityId, city, mapReady, layers.depth3d])

  // First-person tunnel ride
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tunnels || cameraMode !== 'first_person' || !mapReady) return

    const operational =
      tunnels.features.find((f) => f.properties.status === 'operational') ??
      tunnels.features[0]
    if (!operational) return

    const coords = operational.geometry.coordinates
    let i = 0
    let cancelled = false

    const step = () => {
      if (cancelled || !mapRef.current) return
      const a = coords[i % coords.length]
      const b = coords[(i + 1) % coords.length]
      const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
      mapRef.current.easeTo({
        center: [a[0], a[1]],
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

  // Deck layers — animate only when particles are enabled
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || !mapReady) return

    let cancelled = false

    const paint = () => {
      if (cancelled) return

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

      const deckLayers: Layer[] = []

      if (layers.tunnelGlow) {
        deckLayers.push(
          new PathLayer<TunnelFeature>({
            id: 'tunnels-glow',
            data: visibleTunnels,
            getPath: (d) => pathForRender(d.geometry.coordinates, layers.depth3d),
            getColor: (d) => {
              const [r, g, b, a] = statusRgba(d.properties.status)
              return [r, g, b, Math.round(a * 0.32 * night)]
            },
            getWidth: 16,
            widthUnits: 'meters',
            widthMinPixels: 5,
            capRounded: true,
            jointRounded: true,
            pickable: false,
            updateTriggers: {
              getPath: layers.depth3d,
            },
          }),
        )
      }

      deckLayers.push(
        new PathLayer<TunnelFeature>({
          id: 'tunnels-core',
          data: visibleTunnels,
          getPath: (d) => pathForRender(d.geometry.coordinates, layers.depth3d),
          getColor: (d) => {
            const [r, g, b, a] = statusRgba(d.properties.status)
            // Slightly dim return tubes so twin pair is readable
            const dirBoost = d.properties.direction === 'return' ? 0.75 : 1
            const alpha =
              d.properties.status === 'planned'
                ? Math.round(a * 0.8 * night * dirBoost)
                : Math.round(a * night * dirBoost)
            return [r, g, b, alpha]
          },
          getWidth: (d) => (d.properties.status === 'operational' ? 9 : 6),
          widthUnits: 'meters',
          widthMinPixels: 2,
          capRounded: true,
          jointRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
          updateTriggers: {
            getPath: layers.depth3d,
            getColor: layers.depth3d,
          },
        }),
      )

      if (layers.particles && trips.length > 0) {
        deckLayers.push(
          new TripsLayer<Trip>({
            id: 'vehicle-trips',
            data: trips,
            getPath: (d) => d.path,
            getTimestamps: (d) => d.timestamps,
            getColor: (d) => [...d.color, 220] as [number, number, number, number],
            getWidth: 2.5,
            widthMinPixels: 1.5,
            trailLength: 1.0,
            currentTime: timeRef.current,
          }),
        )
      }

      if (layers.stations) {
        deckLayers.push(
          new ScatterplotLayer<StationFeature>({
            id: 'stations',
            data: visibleStations,
            getPosition: (d) => d.geometry.coordinates as [number, number],
            getFillColor: (d) => statusRgba(d.properties.status),
            getLineColor: [255, 255, 255, 180],
            getRadius: 70,
            radiusUnits: 'meters',
            radiusMinPixels: 5,
            radiusMaxPixels: 16,
            stroked: true,
            lineWidthMinPixels: 1.5,
            pickable: true,
            autoHighlight: true,
            onClick: (info: PickingInfo<StationFeature>) => {
              if (info.object) setSelectedStation(info.object)
            },
          }),
        )
      }

      overlay.setProps({ layers: deckLayers })
    }

    if (needsAnimation) {
      const loop = () => {
        if (cancelled) return
        timeRef.current = (timeRef.current + 0.04) % 30
        paint()
        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
      return () => {
        cancelled = true
        cancelAnimationFrame(animRef.current)
      }
    }

    // Static paint — no rAF churn
    paint()
    return () => {
      cancelled = true
    }
  }, [
    tunnels,
    stations,
    layers,
    trips,
    timeOfDay,
    setSelectedStation,
    mapReady,
    needsAnimation,
  ])

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6">
          <div className="max-w-md rounded-xl border border-rose-500/40 bg-zinc-950 p-4 text-sm text-rose-200">
            <p className="font-semibold text-rose-100">Map failed to start</p>
            <p className="mt-2 text-rose-200/80">{mapError}</p>
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
