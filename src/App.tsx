import { useEffect, useState } from 'react'
import { MapView } from './components/MapView'
import { SidePanel } from './components/SidePanel'
import { LoadingOverlay } from './components/LoadingOverlay'
import { useAppStore } from './store/useAppStore'
import { cityIdFromLocation } from './lib/cityRoutes'

export default function App() {
  const init = useAppStore((s) => s.init)
  const setCity = useAppStore((s) => s.setCity)
  const cities = useAppStore((s) => s.cities)
  const cityId = useAppStore((s) => s.cityId)
  const [panelOpen, setPanelOpen] = useState(true)

  useEffect(() => {
    void init()
  }, [init])

  // Back/forward browser navigation between city paths
  useEffect(() => {
    const onPop = () => {
      const id = cityIdFromLocation()
      if (!id || !cities.some((c) => c.id === id) || id === cityId) return
      void setCity(id, { syncUrl: false })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [cities, cityId, setCity])

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#050508] text-zinc-100">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_10%,rgba(0,240,255,0.08),transparent_45%),radial-gradient(ellipse_at_80%_90%,rgba(255,61,129,0.06),transparent_40%)]"
      />

      <div className="relative z-10 flex h-full flex-col md:flex-row">
        <main className="relative min-h-0 flex-1">
          <MapView />
          <LoadingOverlay />

          {/* Mobile panel toggle */}
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-zinc-950/90 px-4 py-2 text-xs font-medium text-cyan-100 shadow-lg backdrop-blur md:hidden"
          >
            {panelOpen ? 'Hide panel' : 'Show panel'}
          </button>
        </main>

        <div
          className={`${
            panelOpen ? 'flex' : 'hidden'
          } h-[45vh] shrink-0 md:flex md:h-full`}
        >
          <SidePanel />
        </div>
      </div>
    </div>
  )
}
