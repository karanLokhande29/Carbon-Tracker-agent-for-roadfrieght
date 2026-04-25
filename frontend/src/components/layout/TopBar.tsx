import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useHealth } from '@/hooks/useAnalytics'
import { toast } from '@/components/layout/Toast'
import {
  Map,
  TrendingUp,
  Truck,
  BrainCircuit,
  Settings2,
  Activity,
  Leaf,
} from 'lucide-react'
import type { AppTab, ModelType } from '@/types'

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: AppTab; label: string; icon: React.ElementType }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'fleet', label: 'Fleet', icon: Truck },
  { id: 'explainability', label: 'Explainability', icon: BrainCircuit },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
]

// ─── Model pill config ────────────────────────────────────────────────────────

interface ModelInfo {
  id: ModelType
  label: string
  tooltip: string
  activeClass: string
}

const MODELS: ModelInfo[] = [
  {
    id: 'catboost',
    label: 'CatBoost',
    tooltip: 'Gradient boosted decision trees. Powers the Emission Simulator, SHAP explainability panel, and recommendation cards.',
    activeClass: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    tooltip: 'CatBoost enhanced with GraphSAGE city embeddings. Powers similar-corridor recommendations and the City Embeddings scatter on the map.',
    activeClass: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40',
  },
  {
    id: 'tft',
    label: 'TFT',
    tooltip: 'Temporal Fusion Transformer. Powers the Forecast tab with multi-week quantile predictions and uncertainty bands.',
    activeClass: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function TopBar() {
  const { activeTab, setActiveTab, activeModel, setActiveModel, updateInputA } = useAppStore()

  function handleModelClick(id: ModelType) {
    if (id === 'tft') {
      // TFT is a forecasting model — redirect to Forecast tab
      setActiveModel('tft')
      setActiveTab('forecast')
      toast.info('TFT is a forecasting model — switched to Forecast tab')
    } else {
      setActiveModel(id)
      // Sync the model into simulator inputs so usePrediction picks it up
      updateInputA({ model: id as 'catboost' | 'hybrid' })
    }
  }
  const { data: health } = useHealth()

  const backendOk =
    health?.status === 'ok' &&
    health.models.some((m) => m.name === 'catboost' && m.loaded)

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0f1117] border-b border-white/10 select-none z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight tracking-tight">
            Carbon Tracker
          </p>
          <p className="text-white/40 text-[10px] leading-tight">
            Decision Intelligence
          </p>
        </div>
      </div>

      {/* Tab Nav */}
      <nav className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              activeTab === id
                ? 'bg-white/10 text-white shadow-inner'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {/* Right side: model pills + health */}
      <div className="flex items-center gap-4 min-w-[200px] justify-end">
        {/* Model pills */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {MODELS.map(({ id, label, tooltip, activeClass }) => (
            <div key={id} className="relative group">
              <button
                onClick={() => handleModelClick(id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200',
                  activeModel === id
                    ? activeClass
                    : 'text-white/40 hover:text-white/70',
                )}
              >
                {label}
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-[#1a1d2e] border border-white/10 rounded-lg px-3 py-2.5 text-[11px] text-white/70 shadow-xl z-50 w-72 leading-relaxed">
                {tooltip}
              </div>
            </div>
          ))}
        </div>

        {/* Health dot */}
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-white/30" />
          <div
            className={cn(
              'w-2 h-2 rounded-full transition-colors duration-500',
              backendOk
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]'
                : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]',
            )}
          />
        </div>
      </div>
    </header>
  )
}
