import { motion } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import { STATUS_COLORS, statusLabel } from '../lib/colors'
import type { LayerVisibility, TunnelStatus } from '../types'

const LAYER_KEYS: { key: keyof LayerVisibility; label: string; status?: TunnelStatus }[] = [
  { key: 'operational', label: 'Operational', status: 'operational' },
  { key: 'under_construction', label: 'Under Construction', status: 'under_construction' },
  { key: 'planned', label: 'Planned / Future', status: 'planned' },
  { key: 'stations', label: 'Stations' },
  { key: 'particles', label: 'Vehicle flows' },
]

export function SidePanel() {
  const cities = useAppStore((s) => s.cities)
  const cityId = useAppStore((s) => s.cityId)
  const setCity = useAppStore((s) => s.setCity)
  const layers = useAppStore((s) => s.layers)
  const setLayer = useAppStore((s) => s.setLayer)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const setCameraMode = useAppStore((s) => s.setCameraMode)
  const whatIfFactor = useAppStore((s) => s.whatIfFactor)
  const setWhatIfFactor = useAppStore((s) => s.setWhatIfFactor)
  const timeOfDay = useAppStore((s) => s.timeOfDay)
  const setTimeOfDay = useAppStore((s) => s.setTimeOfDay)
  const selectedStation = useAppStore((s) => s.selectedStation)
  const setSelectedStation = useAppStore((s) => s.setSelectedStation)
  const loading = useAppStore((s) => s.loading)
  const city = useAppStore((s) => s.getCity())
  const throughput = useAppStore((s) => s.getThroughput())

  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="pointer-events-auto flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-white/10 bg-zinc-950/85 p-4 text-zinc-100 shadow-2xl backdrop-blur-xl md:w-80"
    >
      <header className="space-y-1 border-b border-white/10 pb-3">
        <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400/80">
          Boring Company
        </p>
        <h1 className="text-lg font-semibold leading-tight text-white">
          Tunnels Visualizer
        </h1>
        <p className="text-xs text-zinc-400">
          3D network explorer · static · client-side
        </p>
      </header>

      {/* City selector */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          City
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {cities.map((c) => {
            const active = c.id === cityId
            return (
              <button
                key={c.id}
                type="button"
                disabled={loading}
                onClick={() => void setCity(c.id)}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                  active
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100 shadow-[0_0_20px_rgba(0,240,255,0.12)]'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <span className="block font-medium">{c.shortName}</span>
                <span className="text-[10px] text-zinc-500">{c.name}</span>
              </button>
            )
          })}
        </div>
        {city && (
          <p className="text-[11px] leading-relaxed text-zinc-400">{city.description}</p>
        )}
      </section>

      {/* Layers */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Layers
        </h2>
        <ul className="space-y-1.5">
          {LAYER_KEYS.map(({ key, label, status }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                <input
                  type="checkbox"
                  className="size-3.5 rounded border-zinc-600 bg-zinc-900 accent-cyan-400"
                  checked={layers[key]}
                  onChange={(e) => setLayer(key, e.target.checked)}
                />
                {status && (
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: STATUS_COLORS[status].hex, boxShadow: `0 0 8px ${STATUS_COLORS[status].glow}` }}
                  />
                )}
                <span className="text-sm text-zinc-200">{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Throughput dashboard */}
      <section className="space-y-3 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent p-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-cyan-300/80">
          Throughput
        </h2>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-black/30 p-2">
            <p className="text-xl font-semibold tabular-nums text-cyan-300">
              {throughput.pph.toLocaleString()}
            </p>
            <p className="text-[10px] text-zinc-400">est. pax/hr visible</p>
          </div>
          <div className="rounded-lg bg-black/30 p-2">
            <p className="text-xl font-semibold tabular-nums text-white">
              {city?.metrics.targetPph.toLocaleString() ?? '—'}
            </p>
            <p className="text-[10px] text-zinc-400">system target pph</p>
          </div>
        </div>
        {city && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            <span>Op. miles</span>
            <span className="text-right text-zinc-200">{city.metrics.operationalMiles}</span>
            <span>Planned miles</span>
            <span className="text-right text-zinc-200">{city.metrics.plannedMiles}</span>
            <span>Stations (op / plan)</span>
            <span className="text-right text-zinc-200">
              {city.metrics.operationalStations} / {city.metrics.plannedStations}
            </span>
            <span>Visible segments</span>
            <span className="text-right text-zinc-200">{throughput.tunnelCount}</span>
          </div>
        )}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>What-if demand</span>
            <span className="tabular-nums text-zinc-200">{whatIfFactor.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={whatIfFactor}
            onChange={(e) => setWhatIfFactor(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>
      </section>

      {/* Camera & lighting */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Exploration
        </h2>
        <div className="flex gap-2">
          {(['orbit', 'first_person'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCameraMode(mode)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize transition ${
                cameraMode === mode
                  ? 'border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {mode === 'first_person' ? 'Tunnel ride' : 'Orbit'}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Time of day</span>
            <span className="tabular-nums text-zinc-200">
              {String(Math.floor(timeOfDay)).padStart(2, '0')}:00
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.5}
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(Number(e.target.value))}
            className="w-full accent-fuchsia-400"
          />
        </div>
      </section>

      {/* Selected station */}
      {selectedStation && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 rounded-xl border border-white/15 bg-white/5 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Station</p>
              <h3 className="font-semibold text-white">{selectedStation.properties.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="size-2 rounded-full"
              style={{
                background: STATUS_COLORS[selectedStation.properties.status].hex,
              }}
            />
            <span>{statusLabel(selectedStation.properties.status)}</span>
          </div>
          <dl className="grid grid-cols-2 gap-1 text-[11px] text-zinc-400">
            <dt>Capacity</dt>
            <dd className="text-right text-zinc-200">
              {selectedStation.properties.capacity_pph.toLocaleString()} pph
            </dd>
            <dt>Depth</dt>
            <dd className="text-right text-zinc-200">
              ~{selectedStation.properties.depth_m} m
            </dd>
          </dl>
          {selectedStation.properties.notes && (
            <p className="text-[11px] leading-relaxed text-zinc-400">
              {selectedStation.properties.notes}
            </p>
          )}
        </motion.section>
      )}

      <footer className="mt-auto space-y-1 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-zinc-500">
        <p>
          Alignments are schematic, digitized from public maps for visualization — not
          official engineering drawings.
        </p>
        <p>Basemap © OpenFreeMap · OSM contributors · Static GitHub Pages build</p>
      </footer>
    </motion.aside>
  )
}
