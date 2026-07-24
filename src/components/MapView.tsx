import { useEffect, useMemo, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import type { PickingInfo } from '@deck.gl/core'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useAppStore } from '../store/useAppStore'
import { statusRgba } from '../lib/colors'
import {
  deviceParticleMultiplier,
  particleBudget,
} from '../lib/throughput'
import type { StationFeature, TunnelFeature, TunnelStatus } from '../types'

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
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const animRef = useRef<number>(0)
  const timeRef = useRef(0)

  const city = useAppStore((s) => s.getCity())
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
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-115.172, 36.125],
      zoom: 12.2,
      pitch: 55,
      bearing: -20,
      attributionControl: {},
      maxPitch: 75,
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120 }), 'bottom-left')

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
    })
    map.addControl(overlay)

    mapRef.current = map
    overlayRef.current = overlay

    return () => {
      cancelAnimationFrame(animRef.current)
      overlay.finalize()
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [])

  // Fly to city
  useEffect(() => {
    const map = mapRef.current
    const c = useAppStore.getState().getCity()
    if (!map || !c || flyToken === 0) return

    map.flyTo({
      center: c.center,
      zoom: c.zoom,
      pitch: c.pitch,
      bearing: c.bearing,
      duration: 2200,
      essential: true,
    })
  }, [flyToken, cityId])

  // First-person mode: follow tunnel path roughly
  useEffect(() => {
    const map = mapRef.current
    if (!map || !tunnels || cameraMode !== 'first_person') return

    const operational = tunnels.features.find(
      (f) => f.properties.status === 'operational',
    ) ?? tunnels.features[0]
    if (!operational) return

    const coords = operational.geometry.coordinates as [number, number][]
    let i = 0
    let cancelled = false

    const step = () => {
      if (cancelled || !mapRef.current) return
      const a = coords[i % coords.length]
      const b = coords[(i + 1) % coords.length]
      const bearing =
        (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
      mapRef.current.easeTo({
        center: a,
        zoom: 16.5,
        pitch: 70,
        bearing,
        duration: 900,
      })
      i += 1
      animRef.current = window.setTimeout(step, 950) as unknown as number
    }
    step()

    return () => {
      cancelled = true
      clearTimeout(animRef.current)
    }
  }, [cameraMode, tunnels, cityId])

  // Deck layers + particle animation
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

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

      // Subtle night dimming based on time of day
      const night =
        timeOfDay < 6 || timeOfDay > 19
          ? 1
          : timeOfDay < 8 || timeOfDay > 17
            ? 0.7
            : 0.4

      const deckLayers = [
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
        layers.particles && trips.length > 0
          ? new TripsLayer<Trip>({
              id: 'vehicle-trips',
              data: trips,
              getPath: (d) => d.path,
              getTimestamps: (d) => d.timestamps,
              getColor: (d) => [...d.color, 230] as [number, number, number, number],
              getWidth: 3,
              widthMinPixels: 2,
              trailLength: 1.2,
              currentTime: timeRef.current,
            })
          : null,
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
      ].filter(Boolean)

      overlay.setProps({ layers: deckLayers })
      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      cancelled = true
      cancelAnimationFrame(animRef.current)
    }
  }, [tunnels, stations, layers, trips, timeOfDay, setSelectedStation])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {city && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-cyan-500/20 bg-black/55 px-3 py-2 backdrop-blur-md md:left-auto md:right-[22rem]">
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
