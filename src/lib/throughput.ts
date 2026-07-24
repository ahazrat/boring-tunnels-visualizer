import type { TunnelCollection, TunnelStatus } from '../types'

/** Scale particle count by capacity and device budget */
export function particleBudget(capacityPph: number, maxParticles = 120): number {
  const scaled = Math.round((capacityPph / 90000) * maxParticles)
  return Math.max(2, Math.min(maxParticles, scaled))
}

export function estimateVisibleThroughput(
  tunnels: TunnelCollection | null,
  layers: Record<TunnelStatus, boolean>,
  whatIfFactor: number,
): { pph: number; tunnelCount: number } {
  if (!tunnels) return { pph: 0, tunnelCount: 0 }

  let pph = 0
  let tunnelCount = 0
  for (const f of tunnels.features) {
    const status = f.properties.status
    if (!layers[status]) continue
    tunnelCount += 1
    // Operational contributes fully; UC ~40%; planned ~15% of published capacity in "what-if"
    const weight =
      status === 'operational' ? 1 : status === 'under_construction' ? 0.4 : 0.15
    pph += f.properties.capacity_pph * weight
  }

  return {
    pph: Math.round(pph * whatIfFactor),
    tunnelCount,
  }
}

export function deviceParticleMultiplier(): number {
  if (typeof window === 'undefined') return 1
  const cores = navigator.hardwareConcurrency ?? 4
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  if (isMobile) return 0.35
  if (cores <= 4) return 0.55
  return 1
}
