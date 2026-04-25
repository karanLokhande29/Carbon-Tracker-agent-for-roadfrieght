/**
 * AdvancedTab — internal 4-tab container:
 *   Model Comparison | 3D Emission Surface | City Embeddings | Per-Lane MAPE
 */
import { useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart2, Box, Network, Map } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModelComparison } from './ModelComparison'
import { CityEmbeddingScatter } from './CityEmbeddingScatter'
import { ChartSkeleton } from '@/components/layout/LoadingSkeleton'
import { AnomalyCalendar } from '@/components/analytics/AnomalyCalendar'
import { VehicleBreakdown } from '@/components/analytics/VehicleBreakdown'

// Lazy-load heavy 3D component
const EmissionSurface3D = lazy(() =>
  import('./EmissionSurface3D').then((m) => ({ default: m.EmissionSurface3D }))
)

// ─── Tab definitions ──────────────────────────────────────────────────────────

type AdvancedSubTab = 'models' | 'surface3d' | 'embeddings' | 'anomalies'

interface TabDef {
  id: AdvancedSubTab
  label: string
  Icon: React.FC<{ className?: string }>
}

const TABS: TabDef[] = [
  { id: 'models',     label: 'Model Comparison',    Icon: BarChart2 },
  { id: 'surface3d',  label: '3D Emission Surface', Icon: Box },
  { id: 'embeddings', label: 'City Embeddings',     Icon: Network },
  { id: 'anomalies',  label: 'Anomaly Explorer',    Icon: Map },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdvancedTab() {
  const [activeSubTab, setActiveSubTab] = useState<AdvancedSubTab>('models')

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 shrink-0 border-b border-white/6">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSubTab(id)}
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-medium px-3 py-2 rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
              activeSubTab === id
                ? 'text-emerald-400 border-emerald-500 bg-emerald-500/8'
                : 'text-white/40 border-transparent hover:text-white/60 hover:bg-white/4',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeSubTab === 'models' && <ModelComparison />}

            {activeSubTab === 'surface3d' && (
              <div className="h-full p-6 overflow-y-auto">
                <Suspense fallback={
                  <div className="space-y-4">
                    <ChartSkeleton height={420} />
                    <p className="text-white/30 text-xs text-center animate-pulse">Loading 3D engine…</p>
                  </div>
                }>
                  <EmissionSurface3D />
                </Suspense>
              </div>
            )}

            {activeSubTab === 'embeddings' && (
              <div className="flex flex-col h-full p-4 gap-3">
                <div>
                  <h3 className="text-white text-sm font-semibold">City Freight Embeddings</h3>
                  <p className="text-white/40 text-xs mt-0.5">GraphSAGE → UMAP projection of 29 cities. Click to highlight lanes.</p>
                </div>
                <div className="flex-1 min-h-0 bg-white/3 rounded-xl border border-white/8 p-3">
                  <CityEmbeddingScatter />
                </div>
              </div>
            )}

            {activeSubTab === 'anomalies' && (
              <div className="flex flex-col h-full">
                <div style={{ height: '200px' }} className="shrink-0 border-b border-white/8">
                  <AnomalyCalendar />
                </div>
                <div className="flex-1 min-h-0">
                  <VehicleBreakdown />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
