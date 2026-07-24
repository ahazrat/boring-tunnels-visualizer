import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import { STATUS_COLORS, statusLabel } from '../lib/colors'

export function StationOverlay() {
  const selected = useAppStore((s) => s.selectedStation)
  const setSelectedStation = useAppStore((s) => s.setSelectedStation)
  const tunnels = useAppStore((s) => s.tunnels)

  if (!selected) return null

  const p = selected.properties
  const color = STATUS_COLORS[p.status]

  // Corridors that touch this station (by name match in tunnel names / from-to if present)
  const stationKey = p.id.replace(/^st-chi-/, '').replace(/^st-/, '')
  const related =
    tunnels?.features.filter((f) => {
      const prop = f.properties
      if (prop.from === stationKey || prop.to === stationKey) return true
      const n = prop.name.toLowerCase()
      const sn = p.name.toLowerCase().split('(')[0].trim()
      return n.includes(sn.toLowerCase())
    }) ?? []

  // Unique pair corridors (count each twin once)
  const pairs = new Set(
    related.map((f) => f.properties.pair_id ?? f.properties.id.replace(/-(nb|sb)$/, '')),
  )

  return (
    <AnimatePresence>
      <motion.div
        key={p.id}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
        className="pointer-events-auto absolute bottom-6 left-4 z-20 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-white/15 bg-zinc-950/92 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl md:left-6 md:bottom-8"
        style={{
          boxShadow: `0 0 0 1px ${color.hex}33, 0 12px 40px rgba(0,0,0,0.55), 0 0 32px ${color.glow}`,
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Station</p>
            <h3 className="text-lg font-semibold leading-tight text-white">{p.name}</h3>
          </div>
          <button
            type="button"
            onClick={() => setSelectedStation(null)}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-400 transition hover:border-white/25 hover:text-white"
            aria-label="Close station details"
          >
            ✕
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              borderColor: `${color.hex}66`,
              background: `${color.hex}18`,
              color: color.hex,
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: color.hex, boxShadow: `0 0 8px ${color.glow}` }}
            />
            {statusLabel(p.status)}
          </span>
          {pairs.size > 0 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-300">
              {pairs.size} corridor{pairs.size === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Capacity</dt>
            <dd className="font-semibold tabular-nums text-cyan-200">
              {p.capacity_pph.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-zinc-500">pph</span>
            </dd>
          </div>
          <div className="rounded-xl bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Portal depth</dt>
            <dd className="font-semibold tabular-nums text-white">
              ~{p.depth_m}
              <span className="ml-1 text-xs font-normal text-zinc-500">m</span>
            </dd>
          </div>
          <div className="col-span-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Coordinates</dt>
            <dd className="font-mono text-xs tabular-nums text-zinc-300">
              {selected.geometry.coordinates[1].toFixed(4)}°N,{' '}
              {Math.abs(selected.geometry.coordinates[0]).toFixed(4)}°W
            </dd>
          </div>
        </dl>

        {p.notes && (
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-400">{p.notes}</p>
        )}

        {related.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
              Connected tubes
            </p>
            <ul className="max-h-24 space-y-1 overflow-y-auto text-[11px] text-zinc-400">
              {[...pairs].slice(0, 6).map((pairId) => {
                const sample = related.find(
                  (f) =>
                    (f.properties.pair_id ?? f.properties.id.replace(/-(nb|sb)$/, '')) ===
                    pairId,
                )
                const label =
                  sample?.properties.name.replace(/\s*·\s*Tube [AB]$/i, '') ?? pairId
                return (
                  <li key={pairId} className="flex items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: color.hex }}
                    />
                    <span className="truncate">{label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
