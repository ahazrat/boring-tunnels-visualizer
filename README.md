# 3D Interactive Boring Company Tunnels Visualizer

Beautiful, high-performance **static** 3D web app for exploring Boring Company tunnel networks — **Vegas Loop** flagship, Music City Loop, Dubai pilot, and Austin Cybertunnel placeholders.

> **v1 constraint:** fully client-side, no backend, no paid APIs required for core use. Deploy free on **GitHub Pages**.

![Stack](https://img.shields.io/badge/Vite-React_TS-646CFF?logo=vite)
![Map](https://img.shields.io/badge/MapLibre-deck.gl-00f0ff)
![Host](https://img.shields.io/badge/GitHub_Pages-static-222)

## Features (Phase 1 MVP)

- **City selector** with cinematic fly-in (Vegas, Nashville, Dubai, Austin, Chicago)
- **Layer toggles**: Operational · Under Construction · Planned
- Glowing **tunnel paths** + clickable **stations**
- **Animated vehicle flows** (density scales with capacity / what-if slider)
- **Throughput dashboard** with simple demand multiplier
- **Orbit** + basic **first-person tunnel ride** camera
- Dark cyber aesthetic (Tesla / Boring Co vibe)
- Free basemap via [OpenFreeMap](https://openfreemap.org/) (no API key)

## Quick start

```bash
cd boring-tunnels-visualizer
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build    # production build → dist/
npm run preview  # preview dist locally
```

## GitHub Pages deploy

1. Create a GitHub repo and push this project.
2. **Settings → Pages → Source:** GitHub Actions.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow).
4. Site URL: `https://<user>.github.io/boring-tunnels-visualizer/`

The workflow sets `VITE_BASE` to `/<repo-name>/` automatically.

For a custom domain or user/org site root:

```bash
VITE_BASE=/ npm run build
```

## Project structure

```
public/data/
  cities.json                 # city registry + metrics
  las-vegas/                  # flagship GeoJSON
  nashville/ dubai/ austin/   # additional cities
src/
  components/                 # MapView, SidePanel, overlays
  store/useAppStore.ts        # Zustand state
  lib/                        # colors, throughput, asset URLs
  types/                      # shared TS types
```

### Adding a city

1. Add `public/data/<city-id>/tunnels.geojson` and `stations.geojson`.
2. Register the city in `public/data/cities.json`.
3. Redeploy (or refresh in dev).

Tunnel/station `properties.status` must be one of:

- `operational`
- `under_construction`
- `planned`

## Architecture

1. Static site loads city GeoJSON on demand.
2. **MapLibre GL** renders the OSM-based dark basemap.
3. **deck.gl** draws tunnels (`PathLayer`), stations (`ScatterplotLayer`), and animated flows (`TripsLayer`).
4. **Zustand** holds layers, selection, what-if factor, and camera mode.
5. No server — pure static assets + browser GPU/CPU.

### Roadmap (from design)

| Phase | Focus |
|------|--------|
| **1** ✅ | MapLibre + OSM + Vegas + multi-city data + dashboard |
| **2** | True 3D tubes / cutaways (Three.js / R3F), neon interiors |
| **3** | Richer simulation, LOD, Web Workers |
| **4** | Polish, PWA, refined alignments, more cities |

R3F / Three.js are already dependencies for Phase 2 mesh work.

## Data notes

Alignments are **schematic**, digitized from public maps for visualization — **not** official engineering drawings. Capacity figures are based on published marketing / reporting ranges (e.g. Vegas system target ~90k pph) and simple client-side models.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Vite + React + TypeScript |
| Maps | MapLibre GL JS + deck.gl |
| 3D (next) | Three.js / React Three Fiber |
| UI | Tailwind CSS v4 + Framer Motion |
| State | Zustand |
| Host | GitHub Pages (static `dist/`) |

## License

Data and visuals for educational / portfolio use. Basemap © OpenFreeMap / OpenStreetMap contributors.
