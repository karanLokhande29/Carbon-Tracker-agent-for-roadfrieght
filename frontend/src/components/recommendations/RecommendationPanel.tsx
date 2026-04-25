/**
 * RecommendationPanel — staggered recommendation cards with impact/effort badges,
 * lane highlighting on hover, and one-click apply.
 *
 * Lane-switch cards now show the CURRENT route as context so users always
 * know the recommendation is relative to their selected lane.
 * Validation: if a lane_switch recommendation's origin/destination matches
 * the current route (stale data), the card is suppressed with a console warning.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  ArrowDownRight,
  Shuffle,
  Truck,
  Clock,
  Gauge,
  Route,
  Loader2,
  Sparkles,
  Map,
  ArrowRight,
} from 'lucide-react'
import { cn, formatCO2e, formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { RecommendationItem, ActionType, ImpactLevel } from '@/types'

// ─── Action type config ──────────────────────────────────────────────────────

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  vehicle_switch: <Truck className="w-4 h-4" />,
  load_increase: <Gauge className="w-4 h-4" />,
  timing_shift: <Clock className="w-4 h-4" />,
  driver_efficiency: <Sparkles className="w-4 h-4" />,
  lane_switch: <Shuffle className="w-4 h-4" />,
}

const IMPACT_STYLES: Record<ImpactLevel, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  low: 'bg-white/8 text-white/50 border-white/10',
}

const EFFORT_STYLES: Record<ImpactLevel, string> = {
  high: 'bg-white/8 text-white/40',
  medium: 'bg-white/6 text-white/35',
  low: 'bg-white/4 text-white/30',
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface RecommendationPanelProps {
  recommendations: RecommendationItem[] | undefined
  isLoading: boolean
  baselineKg: number | null
  /** Current route context — used to validate lane_switch cards */
  currentOrigin?: string
  currentDestination?: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RecommendationPanel({
  recommendations,
  isLoading,
  baselineKg,
  currentOrigin,
  currentDestination,
}: RecommendationPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const updateInputA = useAppStore((s) => s.updateInputA)
  const setHighlightedLanes = useAppStore((s) => s.setHighlightedLanes)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null)

  const handleApply = useCallback(
    (rec: RecommendationItem) => {
      updateInputA(rec.modified_inputs as Record<string, unknown>)
      setAppliedIdx(rec.rank)
      setTimeout(() => setAppliedIdx(null), 1500)
    },
    [updateInputA],
  )

  const handleHover = useCallback(
    (rec: RecommendationItem) => {
      const laneId = (rec.lane_info as Record<string, string> | null)?.lane_id
      if (laneId) setHighlightedLanes([laneId])
    },
    [setHighlightedLanes],
  )

  const handleLeave = useCallback(() => {
    setHighlightedLanes([])
  }, [setHighlightedLanes])

  // ── Validate and filter recommendations ─────────────────────────────────
  const recs = (recommendations ?? []).filter((rec) => {
    if (rec.action_type !== 'lane_switch') return true

    const laneInfo = rec.lane_info as Record<string, string> | null
    if (!laneInfo) return true

    // Suppress stale: if the recommended lane matches the currently SELECTED
    // route (not just the current_origin/destination metadata), the backend
    // returned a pick that is the same route — nothing to switch to.
    const recOrigin = laneInfo.origin
    const recDest = laneInfo.destination

    if (
      currentOrigin &&
      currentDestination &&
      recOrigin === currentOrigin &&
      recDest === currentDestination
    ) {
      console.warn(
        `[RecommendationPanel] Suppressed stale lane_switch card: ` +
        `recommended route "${recOrigin} → ${recDest}" matches the ` +
        `currently selected route. Likely a caching/mapping issue.`,
      )
      return false
    }

    return true
  })

  const hasRecs = recs.length > 0

  return (
    <div className="border-t border-white/8">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white/80">Recommended Actions</span>
          {hasRecs && (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              {recs.length}
            </span>
          )}
        </div>
        {/* Show current route pill when we have context */}
        <div className="flex items-center gap-2">
          {currentOrigin && currentDestination && (
            <span className="hidden sm:flex items-center gap-1 text-[9px] text-white/25 font-mono">
              {currentOrigin}
              <ArrowRight className="w-2.5 h-2.5" />
              {currentDestination}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-white/30" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-white/30" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2">
              {/* Loading skeletons */}
              {isLoading && (
                <>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-white/5 rounded-lg animate-pulse"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </>
              )}

              {/* Empty state */}
              {!isLoading && !hasRecs && baselineKg == null && (
                <p className="text-xs text-white/30 text-center py-4">
                  Adjust inputs to see personalized recommendations
                </p>
              )}

              {/* Recommendation cards */}
              {!isLoading && hasRecs && (
                <AnimatePresence mode="popLayout">
                  {recs.map((rec, i) => {
                    const isLaneSwitch = rec.action_type === 'lane_switch'
                    const isApplied = appliedIdx === rec.rank
                    const laneInfo = rec.lane_info as Record<string, string> | null

                    return (
                      <motion.div
                        key={`${rec.rank}-${rec.action_type}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, delay: i * 0.08 }}
                        className={cn(
                          'relative rounded-lg border p-3 cursor-pointer transition-all duration-150',
                          isLaneSwitch
                            ? 'bg-blue-500/5 border-blue-500/15 hover:border-blue-500/30'
                            : 'bg-white/3 border-white/8 hover:border-white/15',
                          'hover:shadow-lg hover:shadow-black/20',
                        )}
                        onClick={() => handleApply(rec)}
                        onMouseEnter={() => handleHover(rec)}
                        onMouseLeave={handleLeave}
                      >
                        {/* Applied toast overlay */}
                        <AnimatePresence>
                          {isApplied && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 bg-emerald-500/15 rounded-lg flex items-center justify-center z-10"
                            >
                              <span className="text-xs text-emerald-400 font-semibold">
                                ✓ Applied
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Header row */}
                        <div className="flex items-start gap-2">
                          <span className={cn(
                            'mt-0.5 shrink-0',
                            isLaneSwitch ? 'text-blue-400' : 'text-white/40',
                          )}>
                            {ACTION_ICONS[rec.action_type]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-white/85 leading-tight">
                              {rec.action}
                            </p>

                        {/* Route context for lane_switch: show FROM → TO clearly.
                            Prefer backend-supplied current_ fields in lane_info,
                            fall back to the prop passed in from SimulatorPanel. */}
                        {isLaneSwitch && laneInfo && (
                          (() => {
                            const fromOrigin = laneInfo.current_origin || currentOrigin
                            const fromDest   = laneInfo.current_destination || currentDestination
                            return fromOrigin && fromDest ? (
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                <span className="text-[9px] text-white/25">from</span>
                                <span className="text-[9px] text-white/45 font-mono bg-white/5 px-1 rounded">
                                  {fromOrigin} → {fromDest}
                                </span>
                                <ArrowRight className="w-2.5 h-2.5 text-blue-400/40 shrink-0" />
                                <span className="text-[9px] text-blue-300/80 font-mono bg-blue-500/8 px-1 rounded">
                                  {laneInfo.origin} → {laneInfo.destination}
                                </span>
                              </div>
                            ) : null
                          })()
                        )}

                            {/* Savings row */}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
                                <ArrowDownRight className="w-3 h-3" />
                                {formatCO2e(Math.abs(rec.co2e_delta_kg))}
                              </span>
                              <span className="text-emerald-500/60 text-[10px]">
                                {Math.abs(rec.co2e_delta_pct).toFixed(1)}% less
                              </span>
                              {rec.cost_delta_inr !== 0 && (
                                <span className="text-white/30 text-[10px]">
                                  {rec.cost_delta_inr < 0 ? 'Save ' : '+'}
                                  {formatCurrency(Math.abs(rec.cost_delta_inr))}
                                </span>
                              )}
                            </div>

                            {/* Badges + map link */}
                            <div className="flex items-center gap-1.5 mt-2">
                              <span
                                className={cn(
                                  'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border',
                                  IMPACT_STYLES[rec.impact],
                                )}
                              >
                                {rec.impact} impact
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded',
                                  EFFORT_STYLES[rec.effort],
                                )}
                              >
                                {rec.effort} effort
                              </span>

                              {isLaneSwitch && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveTab('map')
                                    handleHover(rec)
                                  }}
                                  className="ml-auto flex items-center gap-1 text-[9px] text-blue-400/70 hover:text-blue-400 transition-colors"
                                >
                                  <Map className="w-3 h-3" />
                                  View on map
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
