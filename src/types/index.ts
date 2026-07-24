export type TunnelStatus = 'operational' | 'under_construction' | 'planned'

export type CameraMode = 'orbit' | 'first_person'

export interface CityMetrics {
  operationalMiles: number
  plannedMiles: number
  operationalStations: number
  plannedStations: number
  targetPph: number
  currentPeakPph: number
}

export interface CityDataFiles {
  tunnels: string
  stations: string
}

export interface CityConfig {
  id: string
  name: string
  shortName: string
  status: TunnelStatus
  description: string
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
  metrics: CityMetrics
  dataFiles: CityDataFiles
}

export interface TunnelProperties {
  id: string
  name: string
  status: TunnelStatus
  depth_m: number
  capacity_pph: number
  notes?: string
  direction?: 'forward' | 'return'
  pair_id?: string
  from?: string
  to?: string
}

export interface StationProperties {
  id: string
  name: string
  status: TunnelStatus
  capacity_pph: number
  depth_m: number
  notes?: string
}

export type Coord2 = [number, number]
export type Coord3 = [number, number, number]
export type PathCoord = Coord2 | Coord3

export type TunnelFeature = GeoJSON.Feature<GeoJSON.LineString, TunnelProperties>
export type StationFeature = GeoJSON.Feature<GeoJSON.Point, StationProperties>
export type TunnelCollection = GeoJSON.FeatureCollection<GeoJSON.LineString, TunnelProperties>
export type StationCollection = GeoJSON.FeatureCollection<GeoJSON.Point, StationProperties>

/** Network status layers + optional heavy graphics (graphics default OFF for performance) */
export interface LayerVisibility {
  operational: boolean
  under_construction: boolean
  planned: boolean
  stations: boolean
  /** Soft halo around tunnels — GPU cost */
  tunnelGlow: boolean
  /** Animated vehicle/particle flows — high cost */
  particles: boolean
  /** Render path elevation (subsurface bowl) in 3D — moderate cost */
  depth3d: boolean
}
