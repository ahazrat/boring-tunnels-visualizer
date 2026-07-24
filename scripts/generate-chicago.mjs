/**
 * Generate Chicago twin-tube corridors:
 * - unique non-overlapping edges (hub + one extension)
 * - straight plan view between stations
 * - subsurface depth profile (down then up)
 * - two parallel opposite-direction tunnels per route
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../public/data/chicago')

/** @type {Record<string, { name: string, lon: number, lat: number, capacity: number, depth: number, notes: string }>} */
const STATIONS = {
  downtown: {
    name: 'Downtown Loop',
    lon: -87.6298,
    lat: 41.8781,
    capacity: 12000,
    depth: 14,
    notes: 'Central interchange hub for all regional spokes — west corridor via Oak Park to Oakbrook.',
  },
  ohare: {
    name: "O'Hare International (ORD)",
    lon: -87.9073,
    lat: 41.9742,
    capacity: 10000,
    depth: 16,
    notes: "Northwest airport terminus — twin-tube links include Downtown and Lombard.",
  },
  midway: {
    name: 'Midway International (MDW)',
    lon: -87.7522,
    lat: 41.7868,
    capacity: 7000,
    depth: 15,
    notes: 'Southwest-side airport terminus.',
  },
  oakpark: {
    name: 'Oak Park',
    // Near Harlem Ave / I-290 (Eisenhower) — between Loop and Oakbrook
    lon: -87.7945,
    lat: 41.8728,
    capacity: 5000,
    depth: 14,
    notes:
      'Near-west hub in Oak Park along the I-290 corridor — twin-tube links to Downtown, Oakbrook, O\'Hare, and Midway.',
  },
  oakbrook: {
    name: 'Oakbrook Center',
    lon: -87.9531,
    lat: 41.8503,
    capacity: 4500,
    depth: 14,
    notes:
      'West-suburban retail / employment node — east to Oak Park/Downtown, west/northwest to Lombard and Woodridge.',
  },
  lombard: {
    name: 'Lombard',
    // Yorktown / central Lombard — between Oakbrook, I-88, and north toward O'Hare
    lon: -88.0078,
    lat: 41.8801,
    capacity: 5000,
    depth: 14,
    notes:
      'DuPage hub in Lombard (near Yorktown corridor) — twin-tube links to Oakbrook, Woodridge, and O\'Hare.',
  },
  woodridge: {
    name: 'Woodridge',
    // I-88 × I-355 interchange area — between Lisle, Downers Grove, and Woodridge
    lon: -88.047,
    lat: 41.791,
    capacity: 6000,
    depth: 14,
    notes:
      'Woodridge hub at the I-88 / I-355 interchange — park-and-ride access; links to Oakbrook, Naperville, Lombard, and Bolingbrook.',
  },
  naperville: {
    name: 'Naperville',
    lon: -88.1535,
    lat: 41.7508,
    capacity: 5500,
    depth: 14,
    notes:
      'Western suburban hub — links via Woodridge toward Oakbrook/Downtown, twin-tube to Woodfield, south via Bolingbrook toward Joliet, and southwest to Plainfield.',
  },
  bolingbrook: {
    name: 'Bolingbrook',
    // Between Naperville and Joliet (I-55 corridor)
    lon: -88.0684,
    lat: 41.6986,
    capacity: 4500,
    depth: 14,
    notes:
      'Southwest suburban hub in Bolingbrook, splitting the Naperville–Joliet twin-tube corridor; also links west to Plainfield and north to Woodridge.',
  },
  plainfield: {
    name: 'Plainfield',
    // Far SW suburb — west of Bolingbrook / south of Naperville / NW of Joliet
    lon: -88.212,
    lat: 41.627,
    capacity: 4500,
    depth: 14,
    notes:
      'Far southwest hub in Plainfield — twin-tube links to Naperville, Bolingbrook, and Joliet.',
  },
  woodfield: {
    name: 'Woodfield Mall',
    lon: -88.0369,
    lat: 42.0464,
    capacity: 5000,
    depth: 14,
    notes: 'Northwest suburban interchange (Schaumburg) — twin-tube links to O\'Hare, Naperville, and Evanston.',
  },
  eastchicago: {
    name: 'East Chicago',
    // East Chicago, Indiana — industrial lakefront / IN border
    lon: -87.4548,
    lat: 41.6392,
    capacity: 4000,
    depth: 15,
    notes:
      'Northwest Indiana hub in East Chicago — twin-tube links to Downtown Loop and Joliet.',
  },
  joliet: {
    name: 'Joliet',
    lon: -88.0817,
    lat: 41.525,
    capacity: 4500,
    depth: 14,
    notes:
      'Southwest suburban hub — twin-tube links to Midway, East Chicago, Bolingbrook (toward Naperville), and Plainfield; no Downtown corridor.',
  },
  evanston: {
    name: 'Evanston',
    // Northwestern / Evanston lakefront (Lake Michigan) — ~12 mi N of the Loop
    lon: -87.6695,
    lat: 42.052,
    capacity: 5000,
    depth: 14,
    notes: 'North-shore lakefront hub (Evanston / Northwestern area) — twin-tube links to Downtown and Woodfield.',
  },
}

/**
 * Unique edges only — no redundant overlapping laterals.
 * Woodridge sits on the Oakbrook–Naperville corridor (replaces direct link).
 */
const ROUTES = [
  { id: 'downtown-ohare', from: 'downtown', to: 'ohare', capacity: 10000, maxDepth: 48 },
  { id: 'downtown-midway', from: 'downtown', to: 'midway', capacity: 7000, maxDepth: 42 },
  // Split Downtown–Oakbrook at Oak Park (I-290 / Harlem corridor)
  { id: 'downtown-oakpark', from: 'downtown', to: 'oakpark', capacity: 6000, maxDepth: 40 },
  { id: 'oakpark-oakbrook', from: 'oakpark', to: 'oakbrook', capacity: 5500, maxDepth: 38 },
  { id: 'oakpark-ohare', from: 'oakpark', to: 'ohare', capacity: 5500, maxDepth: 42 },
  { id: 'oakpark-midway', from: 'oakpark', to: 'midway', capacity: 5500, maxDepth: 40 },
  // Split former Oakbrook–Naperville long-haul at Woodridge (88/355)
  { id: 'oakbrook-woodridge', from: 'oakbrook', to: 'woodridge', capacity: 5500, maxDepth: 38 },
  { id: 'woodridge-naperville', from: 'woodridge', to: 'naperville', capacity: 5500, maxDepth: 38 },
  // Lombard hub: Oakbrook, Woodridge, O'Hare
  { id: 'oakbrook-lombard', from: 'oakbrook', to: 'lombard', capacity: 5000, maxDepth: 36 },
  { id: 'lombard-woodridge', from: 'lombard', to: 'woodridge', capacity: 5000, maxDepth: 36 },
  { id: 'lombard-ohare', from: 'lombard', to: 'ohare', capacity: 5500, maxDepth: 42 },
  { id: 'ohare-woodfield', from: 'ohare', to: 'woodfield', capacity: 5500, maxDepth: 40 },
  { id: 'naperville-woodfield', from: 'naperville', to: 'woodfield', capacity: 4500, maxDepth: 40 },
  { id: 'woodfield-evanston', from: 'woodfield', to: 'evanston', capacity: 4500, maxDepth: 40 },
  { id: 'downtown-eastchicago', from: 'downtown', to: 'eastchicago', capacity: 5000, maxDepth: 42 },
  { id: 'midway-joliet', from: 'midway', to: 'joliet', capacity: 5000, maxDepth: 44 },
  { id: 'joliet-eastchicago', from: 'joliet', to: 'eastchicago', capacity: 4500, maxDepth: 42 },
  // Split Naperville–Joliet at Bolingbrook
  { id: 'naperville-bolingbrook', from: 'naperville', to: 'bolingbrook', capacity: 4000, maxDepth: 38 },
  { id: 'bolingbrook-joliet', from: 'bolingbrook', to: 'joliet', capacity: 4000, maxDepth: 40 },
  { id: 'bolingbrook-woodridge', from: 'bolingbrook', to: 'woodridge', capacity: 4000, maxDepth: 36 },
  // Plainfield SW hub
  { id: 'naperville-plainfield', from: 'naperville', to: 'plainfield', capacity: 4000, maxDepth: 38 },
  { id: 'bolingbrook-plainfield', from: 'bolingbrook', to: 'plainfield', capacity: 4000, maxDepth: 36 },
  { id: 'plainfield-joliet', from: 'plainfield', to: 'joliet', capacity: 4000, maxDepth: 38 },
  { id: 'downtown-evanston', from: 'downtown', to: 'evanston', capacity: 5500, maxDepth: 40 },
]

const SAMPLES = 28
/** Twin-tube centerline separation (meters) */
const TUBE_OFFSET_M = 18

function metersToDeg(lat, eastM, northM) {
  const latRad = (lat * Math.PI) / 180
  const dLat = northM / 111_320
  const dLon = eastM / (111_320 * Math.cos(latRad))
  return { dLon, dLat }
}

/**
 * Smooth depth profile: shallow at portals, deepest mid-run (sinusoidal bowl).
 * Returns meters below surface (positive depth).
 */
function depthAt(t, portalDepth, maxDepth) {
  // sin(πt) peaks at 1 in the middle
  const bowl = Math.sin(Math.PI * t)
  return portalDepth + (maxDepth - portalDepth) * bowl
}

function buildCenterline(a, b, portalA, portalB, maxDepth, samples) {
  /** @type {[number, number, number][]} */
  const coords = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const lon = a.lon + (b.lon - a.lon) * t
    const lat = a.lat + (b.lat - a.lat) * t
    const portal = portalA + (portalB - portalA) * t
    const depth = depthAt(t, portal, maxDepth)
    // GeoJSON / deck.gl elevation is meters above sea-ish; use negative for subsurface
    const elev = -depth
    coords.push([lon, lat, elev])
  }
  return coords
}

function offsetLine(coords, offsetM) {
  if (coords.length < 2) return coords
  const mid = coords[Math.floor(coords.length / 2)]
  const first = coords[0]
  const last = coords[coords.length - 1]
  // Plan bearing of the straight shot
  const dLon = last[0] - first[0]
  const dLat = last[1] - first[1]
  const len = Math.hypot(dLon, dLat) || 1
  // Perpendicular unit in lon/lat (approx), scaled via meters at mid-lat
  const ux = -dLat / len
  const uy = dLon / len
  // Convert desired meter offset to lon/lat using mid latitude
  const { dLon: oLon, dLat: oLat } = metersToDeg(mid[1], ux * offsetM, uy * offsetM)
  // Normalize ux,uy in lon/lat space then apply meter conversion properly:
  // Better: perpendicular in meters along the route's geographic bearing
  const bearing = Math.atan2(dLon * Math.cos((mid[1] * Math.PI) / 180), dLat)
  const perp = bearing + Math.PI / 2
  const east = Math.sin(perp) * offsetM
  const north = Math.cos(perp) * offsetM
  const off = metersToDeg(mid[1], east, north)

  return coords.map(([lon, lat, elev]) => [lon + off.dLon, lat + off.dLat, elev])
}

function reverseCoords(coords) {
  return [...coords].reverse()
}

function haversineKm(a, b) {
  const R = 6371
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLon = toR(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// --- stations geojson ---
const stationsFc = {
  type: 'FeatureCollection',
  name: 'chicago-stations',
  features: Object.entries(STATIONS).map(([id, s]) => ({
    type: 'Feature',
    properties: {
      id: `st-chi-${id}`,
      name: s.name,
      status: 'planned',
      capacity_pph: s.capacity,
      depth_m: s.depth,
      notes: s.notes,
    },
    geometry: {
      type: 'Point',
      coordinates: [s.lon, s.lat],
    },
  })),
}

// --- tunnels geojson ---
const tunnelFeatures = []
let totalMiles = 0

for (const route of ROUTES) {
  const A = STATIONS[route.from]
  const B = STATIONS[route.to]
  const miles = haversineKm(A, B) * 0.621371
  totalMiles += miles

  const center = buildCenterline(A, B, A.depth, B.depth, route.maxDepth, SAMPLES)
  const forward = offsetLine(center, TUBE_OFFSET_M / 2)
  const reverse = reverseCoords(offsetLine(center, -TUBE_OFFSET_M / 2))

  const baseName = `${A.name.split('(')[0].trim()} ↔ ${B.name.split('(')[0].trim()}`

  tunnelFeatures.push({
    type: 'Feature',
    properties: {
      id: `${route.id}-nb`,
      name: `${baseName} · Tube A`,
      status: 'planned',
      depth_m: route.maxDepth,
      capacity_pph: Math.round(route.capacity / 2),
      direction: 'forward',
      pair_id: route.id,
      from: route.from,
      to: route.to,
      notes: `Twin tube A (outbound). Straight plan alignment with subsurface bowl (portal ~${A.depth}–${B.depth}m, mid ~${route.maxDepth}m). ~${miles.toFixed(1)} mi.`,
    },
    geometry: { type: 'LineString', coordinates: forward },
  })

  tunnelFeatures.push({
    type: 'Feature',
    properties: {
      id: `${route.id}-sb`,
      name: `${baseName} · Tube B`,
      status: 'planned',
      depth_m: route.maxDepth,
      capacity_pph: Math.round(route.capacity / 2),
      direction: 'return',
      pair_id: route.id,
      from: route.to,
      to: route.from,
      notes: `Twin tube B (return). Parallel opposite-direction bore; no shared track with Tube A.`,
    },
    geometry: { type: 'LineString', coordinates: reverse },
  })
}

const tunnelsFc = {
  type: 'FeatureCollection',
  name: 'chicago-tunnels',
  features: tunnelFeatures,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'stations.geojson'), JSON.stringify(stationsFc, null, 2) + '\n')
writeFileSync(join(outDir, 'tunnels.geojson'), JSON.stringify(tunnelsFc, null, 2) + '\n')

console.log(
  `Chicago: ${stationsFc.features.length} stations, ${ROUTES.length} routes × 2 tubes = ${tunnelFeatures.length} tunnels, ~${totalMiles.toFixed(1)} corridor-mi`,
)
