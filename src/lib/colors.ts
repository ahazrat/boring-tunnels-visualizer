import type { TunnelStatus } from '../types'

/** Status colors — solid bright = operational, ghosted = future */
export const STATUS_COLORS: Record<
  TunnelStatus,
  { rgb: [number, number, number]; hex: string; glow: string; alpha: number }
> = {
  operational: {
    rgb: [0, 240, 255],
    hex: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.55)',
    alpha: 255,
  },
  under_construction: {
    rgb: [255, 180, 50],
    hex: '#ffb432',
    glow: 'rgba(255, 180, 50, 0.45)',
    alpha: 220,
  },
  planned: {
    rgb: [255, 61, 129],
    hex: '#ff3d81',
    glow: 'rgba(255, 61, 129, 0.28)',
    alpha: 140,
  },
}

export function statusRgba(
  status: TunnelStatus,
  alphaOverride?: number,
): [number, number, number, number] {
  const c = STATUS_COLORS[status]
  return [c.rgb[0], c.rgb[1], c.rgb[2], alphaOverride ?? c.alpha]
}

export function statusLabel(status: TunnelStatus): string {
  switch (status) {
    case 'operational':
      return 'Operational'
    case 'under_construction':
      return 'Under Construction'
    case 'planned':
      return 'Planned / Future'
  }
}
