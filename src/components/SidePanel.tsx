import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import { STATUS_COLORS, statusLabel } from '../lib/colors'
import { estimateVisibleThroughput } from '../lib/throughput'
import type { LayerVisibility, TunnelStatus } from '../types'

const STATUS_LAYER_KEYS: {
  key: keyof LayerVisibility
  label: string
  status?: TunnelStatus
}[] = [
  { key: 'operational', label: 'Operational', status: 'operational' },
  { key: 'under_construction', label: 'Under Construction', status: 'under_construction' },
  { key: 'planned', label: 'Planned / Future', status: 'planned' },
  { key: 'stations', label: 'Stations' },
]

/** Heavy graphics — all default OFF for snappy performance */
const GRAPHICS_TOGGLES: {
  key: keyof LayerVisibility
  label: string
  hint: string
  cost: 'low' | 'med' | 'high'
}[] = [
  {
    key: 'tunnelGlow',
    label: 'Tunnel glow',
    hint: 'Soft halo under paths',
    cost: 'med',
  },
  {
    key: 'depth3d',
    label: 'Depth profile',
    hint: 'Subsurface bowl (down then up)',
    cost: 'med',
  },
  {
    key: 'particles',
    label: 'Vehicle flows',
    hint: 'Animated traffic particles',
    cost: 'high',
  },
]

function CostPill({ cost }: { cost: 'low' | 'med' | 'high' }) {
  const styles =
    cost === 'high'
      ? 'border-rose-400/40 text-rose-300/90'
      : cost === 'med'
        ? 'border-amber-400/40 text-amber-200/90'
        : 'border-emerald-400/40 text-emerald-300/90'
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${styles} border`}
    >
      {cost}
    </span>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked
          ? 'bg-cyan-500/80 shadow-[0_0_12px_rgba(0,240,255,0.35)]'
          : 'bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

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
  const tunnels = useAppStore((s) => s.tunnels)
  const city = useAppStore((s) => s.cities.find((c) => c.id === s.cityId) ?? null)

  const throughput = useMemo(
    () =>
      estimateVisibleThroughput(
        tunnels,
        {
          operational: layers.operational,
          under_construction: layers.under_construction,
          planned: layers.planned,
        },
        whatIfFactor,
      ),
    [
      tunnels,
      layers.operational,
      layers.under_construction,
      layers.planned,
      whatIfFactor,
    ],
  )

  const graphicsOn = GRAPHICS_TOGGLES.filter((g) => layers[g.key]).length

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

      {/* Network layers */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          Network layers
        </h2>
        <ul className="space-y-1.5">
          {STATUS_LAYER_KEYS.map(({ key, label, status }) => (
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
                    style={{
                      background: STATUS_COLORS[status].hex,
                      boxShadow: `0 0 8px ${STATUS_COLORS[status].glow}`,
                    }}
                  />
                )}
                <span className="text-sm text-zinc-200">{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {/* Graphics performance toggles */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-300">
              Graphics
            </h2>
            <p className="text-[10px] text-zinc-500">
              Default off for smooth performance
            </p>
          </div>
          <span className="text-[10px] tabular-nums text-zinc-500">
            {graphicsOn}/{GRAPHICS_TOGGLES.length} on
          </span>
        </div>

        <ul className="space-y-3">
          {GRAPHICS_TOGGLES.map(({ key, label, hint, cost }) => (
            <li
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{label}</span>
                  <CostPill cost={cost} />
                </div>
                <p className="text-[10px] leading-snug text-zinc-500">{hint}</p>
              </div>
              <ToggleSwitch
                label={label}
                checked={layers[key]}
                onChange={(v) => setLayer(key, v)}
              />
            </li>
          ))}
        </ul>

        {graphicsOn > 0 && (
          <button
            type="button"
            onClick={() => {
              setLayer('tunnelGlow', false)
              setLayer('particles', false)
              setLayer('depth3d', false)
            }}
            className="w-full rounded-lg border border-white/10 py-1.5 text-[11px] text-zinc-400 transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            Turn all graphics off
          </button>
        )}
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
            <span>Visible tubes</span>
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
          Alignments are schematic for visualization — not official engineering drawings.
          Chicago uses unique twin-tube corridors (no overlapping routes).
        </p>
        <p>Basemap © OpenFreeMap · OSM contributors · Static GitHub Pages build</p>
      </footer>
    </motion.aside>
  )
}
