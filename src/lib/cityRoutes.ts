/** City deep-links under Vite `base` (works with GitHub Pages project sites). */

export function getBasePath(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

/** Path segment for a city, e.g. `/boring-tunnels-visualizer/chicago` or `/chicago` */
export function pathForCity(cityId: string): string {
  const base = getBasePath()
  const id = cityId.replace(/^\/+|\/+$/g, '')
  return `${base}${id}`
}

/**
 * Absolute public URL for a city (production or current origin).
 * @example https://ahazrat.github.io/boring-tunnels-visualizer/chicago
 */
export function absoluteUrlForCity(cityId: string, origin = window.location.origin): string {
  return new URL(pathForCity(cityId), origin).href
}

/** Parse city id from the current pathname (first segment after base). */
export function cityIdFromLocation(pathname = window.location.pathname): string | null {
  const base = getBasePath()
  let path = pathname

  // Strip base prefix when present
  if (base !== '/' && path.startsWith(base.slice(0, -1))) {
    // base `/repo/` → match `/repo` or `/repo/`
    const bare = base.slice(0, -1)
    if (path === bare || path.startsWith(base)) {
      path = path.startsWith(base) ? path.slice(base.length) : ''
    } else if (path.startsWith(bare + '/')) {
      path = path.slice(bare.length + 1)
    }
  } else if (base === '/') {
    path = path.replace(/^\//, '')
  }

  path = path.replace(/^\//, '').replace(/\/$/, '')
  if (!path || path === 'index.html') return null

  const segment = path.split('/').filter(Boolean)[0]
  return segment || null
}

/** Update the browser URL to the city path without reloading. */
export function syncCityUrl(cityId: string, mode: 'push' | 'replace' = 'push'): void {
  const next = pathForCity(cityId)
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  // Compare path only (ignore search/hash noise)
  const nextPath = new URL(next, window.location.origin).pathname
  if (window.location.pathname === nextPath) return

  if (mode === 'replace') {
    window.history.replaceState({ cityId }, '', next)
  } else {
    window.history.pushState({ cityId }, '', next)
  }

  // Keep document title helpful
  void current
}
