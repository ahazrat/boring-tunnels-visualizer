import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

// GitHub Pages: set VITE_BASE to /repo-name/ when deploying
// Local/preview defaults to /
const base = process.env.VITE_BASE || '/'

/**
 * MapLibre 6 workers are ESM that import ./maplibre-gl-shared.mjs.
 * Vite's ?url emit only hashes the worker file, so shared 404s in production
 * and the map canvas stays blank. Keep both files as static public assets.
 */
function copyMaplibreWorkers(): Plugin {
  const copy = () => {
    const dest = resolve(rootDir, 'public/maplibre')
    const srcDir = resolve(rootDir, 'node_modules/maplibre-gl/dist')
    mkdirSync(dest, { recursive: true })
    for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'] as const) {
      copyFileSync(resolve(srcDir, file), resolve(dest, file))
    }
  }

  return {
    name: 'copy-maplibre-workers',
    buildStart: copy,
    configureServer: copy,
  }
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), copyMaplibreWorkers()],
  optimizeDeps: {
    // Avoid broken prebundled worker paths in dev
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
})
