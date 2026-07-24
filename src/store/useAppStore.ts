import { create } from 'zustand'
import type {
  CameraMode,
  CityConfig,
  LayerVisibility,
  StationFeature,
  StationCollection,
  TunnelCollection,
} from '../types'
import { publicUrl } from '../lib/assets'
import { estimateVisibleThroughput } from '../lib/throughput'
import { cityIdFromLocation, syncCityUrl } from '../lib/cityRoutes'

interface SetCityOptions {
  /** Update browser URL (default true) */
  syncUrl?: boolean
  /** history.replaceState vs pushState when syncing URL */
  replace?: boolean
}

interface AppState {
  cities: CityConfig[]
  cityId: string | null
  tunnels: TunnelCollection | null
  stations: StationCollection | null
  loading: boolean
  error: string | null
  layers: LayerVisibility
  cameraMode: CameraMode
  whatIfFactor: number
  selectedStation: StationFeature | null
  timeOfDay: number // 0–24
  flyToken: number

  init: () => Promise<void>
  setCity: (id: string, opts?: SetCityOptions) => Promise<void>
  setLayer: (key: keyof LayerVisibility, value: boolean) => void
  setCameraMode: (mode: CameraMode) => void
  setWhatIfFactor: (v: number) => void
  setSelectedStation: (s: StationFeature | null) => void
  setTimeOfDay: (h: number) => void
  getThroughput: () => { pph: number; tunnelCount: number }
  getCity: () => CityConfig | null
}

/** Lean defaults: status layers on as needed; heavy graphics OFF */
const DEFAULT_LAYERS: LayerVisibility = {
  operational: true,
  under_construction: true,
  planned: false,
  stations: true,
  tunnelGlow: false,
  particles: false,
  depth3d: false,
}

export const useAppStore = create<AppState>((set, get) => ({
  cities: [],
  cityId: null,
  tunnels: null,
  stations: null,
  loading: false,
  error: null,
  layers: { ...DEFAULT_LAYERS },
  cameraMode: 'orbit',
  whatIfFactor: 1,
  selectedStation: null,
  timeOfDay: 21,
  flyToken: 0,

  init: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(publicUrl('data/cities.json'))
      if (!res.ok) throw new Error(`Failed to load cities (${res.status})`)
      const cities = (await res.json()) as CityConfig[]
      set({ cities, loading: false })

      const fromUrl = cityIdFromLocation()
      const match = cities.find((c) => c.id === fromUrl)
      const target = match?.id ?? cities[0]?.id
      if (target) {
        await get().setCity(target, { replace: true, syncUrl: true })
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to initialize',
      })
    }
  },

  setCity: async (id, opts) => {
    const city = get().cities.find((c) => c.id === id)
    if (!city) return

    // Already on this city with data loaded — still sync URL if needed
    if (get().cityId === id && get().tunnels) {
      if (opts?.syncUrl !== false) {
        syncCityUrl(id, opts?.replace ? 'replace' : 'push')
      }
      return
    }

    set({
      loading: true,
      error: null,
      cityId: id,
      selectedStation: null,
      tunnels: null,
      stations: null,
    })

    if (opts?.syncUrl !== false) {
      syncCityUrl(id, opts?.replace ? 'replace' : 'push')
    }

    try {
      const [tRes, sRes] = await Promise.all([
        fetch(publicUrl(city.dataFiles.tunnels)),
        fetch(publicUrl(city.dataFiles.stations)),
      ])
      if (!tRes.ok || !sRes.ok) throw new Error('Failed to load city dataset')
      const [tunnels, stations] = await Promise.all([tRes.json(), sRes.json()])
      const hasOperational = Boolean(
        tunnels?.features?.some(
          (f: { properties?: { status?: string } }) =>
            f.properties?.status === 'operational',
        ),
      )
      const layers = get().layers
      set({
        tunnels,
        stations,
        loading: false,
        flyToken: get().flyToken + 1,
        layers: hasOperational
          ? layers
          : {
              ...layers,
              planned: true,
              under_construction: true,
              tunnelGlow: false,
              particles: false,
              depth3d: false,
            },
      })

      if (typeof document !== 'undefined') {
        document.title = `${city.shortName} · Boring Tunnels Visualizer`
      }
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load city',
      })
    }
  },

  setLayer: (key, value) =>
    set((s) => ({ layers: { ...s.layers, [key]: value } })),

  setCameraMode: (mode) => set({ cameraMode: mode }),

  setWhatIfFactor: (v) => set({ whatIfFactor: Math.max(0.1, Math.min(2, v)) }),

  setSelectedStation: (s) => set({ selectedStation: s }),

  setTimeOfDay: (h) => set({ timeOfDay: Math.max(0, Math.min(24, h)) }),

  getThroughput: () => {
    const { tunnels, layers, whatIfFactor } = get()
    return estimateVisibleThroughput(
      tunnels,
      {
        operational: layers.operational,
        under_construction: layers.under_construction,
        planned: layers.planned,
      },
      whatIfFactor,
    )
  },

  getCity: () => {
    const { cities, cityId } = get()
    return cities.find((c) => c.id === cityId) ?? null
  },
}))
