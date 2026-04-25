import { AnimatePresence, motion } from 'framer-motion'
import { TopBar } from '@/components/layout/TopBar'
import { SimulatorPanel } from '@/components/simulator/SimulatorPanel'
import { MapPanel } from '@/components/panels/MapPanel'
import { ForecastPanel } from '@/components/forecast/ForecastPanel'
import { FleetPlanner } from '@/components/analytics/FleetPlanner'
import { ShapExplainer } from '@/components/analytics/ShapExplainer'
import { AdvancedTab } from '@/components/advanced/AdvancedTab'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { ToastContainer } from '@/components/layout/Toast'
import { useAppStore } from '@/store'

// ─── Left panel routing ───────────────────────────────────────────────────────

function LeftPanel() {
  const activeTab = useAppStore((s) => s.activeTab)

  const panels: Record<string, React.ReactNode> = {
    map:            <ErrorBoundary label="Map"><MapPanel /></ErrorBoundary>,
    forecast:       <ErrorBoundary label="Forecast"><ForecastPanel /></ErrorBoundary>,
    fleet:          <ErrorBoundary label="Fleet Planner"><FleetPlanner /></ErrorBoundary>,
    explainability: <ErrorBoundary label="SHAP Explainer"><ShapExplainer /></ErrorBoundary>,
    advanced:       <ErrorBoundary label="Advanced Tab"><AdvancedTab /></ErrorBoundary>,
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.18 }}
        className="h-full"
      >
        {panels[activeTab]}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Responsive grid ──────────────────────────────────────────────────────────

function AppGrid() {
  return (
    <>
      {/* ≥ 1280px: side-by-side 60/40 split */}
      <main
        className="flex-1 grid overflow-hidden max-xl:hidden"
        style={{ gridTemplateColumns: '3fr 2fr' }}
      >
        <div className="overflow-hidden bg-[#0d1017] border-r border-white/5">
          <LeftPanel />
        </div>
        <div className="overflow-hidden">
          <ErrorBoundary label="Simulator">
            <SimulatorPanel />
          </ErrorBoundary>
        </div>
      </main>

      {/* < 1280px: stacked layout */}
      <main className="flex-1 flex flex-col overflow-hidden xl:hidden">
        <div className="flex-1 overflow-hidden bg-[#0d1017]">
          <LeftPanel />
        </div>
        <div className="h-[420px] shrink-0 border-t border-white/5 overflow-hidden">
          <ErrorBoundary label="Simulator">
            <SimulatorPanel />
          </ErrorBoundary>
        </div>
      </main>
    </>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-[#0a0d14] text-white overflow-hidden">
      <TopBar />
      <AppGrid />
      <ToastContainer />
    </div>
  )
}
