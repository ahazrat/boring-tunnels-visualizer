import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages: set VITE_BASE to /repo-name/ when deploying
// Local/preview defaults to /
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  // MapLibre 6 ships a sibling worker module resolved via import.meta.url.
  // Vite's dep optimizer rewrites the main bundle into .vite/deps without
  // copying the worker, which breaks the map (blank page). Keep it external
  // to prebundling so worker + shared chunks load from node_modules.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    // Avoid prebundling surprises for maplibre in production too
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  server: {
    // Helpful when debugging worker 404s
    fs: {
      allow: ['.'],
    },
  },
})
