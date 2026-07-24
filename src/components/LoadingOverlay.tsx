import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'

export function LoadingOverlay() {
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)

  return (
    <AnimatePresence>
      {(loading || error) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
        >
          <div className="rounded-xl border border-cyan-500/30 bg-zinc-950/90 px-6 py-4 text-center shadow-[0_0_40px_rgba(0,240,255,0.15)]">
            {error ? (
              <p className="text-sm text-rose-300">{error}</p>
            ) : (
              <>
                <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
                <p className="text-sm text-cyan-100">Loading tunnel network…</p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
