/**
 * SimulatorPanel — the core right sidebar.
 * Lane selector, vehicle tiles, parameter sliders, prediction display,
 * compare mode, and embedded recommendations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sliders,
  Gauge,
  Leaf,
  AlertTriangle,
  Loader2,
  ChevronDown,
  GitCompareArrows,
  ArrowRight,
} from 'lucide-react'

import { SliderField } from './SliderField'
import { VehicleTile } from './VehicleTile'
import { RecommendationPanel } from '@/components/recommendations/RecommendationPanel'

import { useAppStore } from '@/store'
import { usePrediction } from '@/hooks/usePredict'
import { useRecommendations } from '@/hooks/useRecommendations'
import { useLanes } from '@/hooks/useLanes'
import {
  cn,
  formatCO2e,
  formatCurrency,
  getConfidenceColor,
} from '@/lib/utils'
import type { VehicleType, LaneSummary } from '@/types'

// ─── Vehicle type order ──────────────────────────────────────────────────────

const VEHICLE_TYPES: VehicleType[] = [
  'road_articulated_diesel',
  'road_rigid_diesel',
  'road_lcv_diesel',
  'road_cng',
  'road_rigid_electric',
]

// ─── Animated CO₂e counter ──────────────────────────────────────────────────

function AnimatedCO2e({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevRef = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prevRef.current
    const to = value
    const dur = 400
    const t0 = performance.now()

    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      el.textContent = formatCO2e(from + (to - from) * eased)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    prevRef.current = to
  }, [value])

  return <span ref={ref}>{formatCO2e(value)}</span>
}

// ─── Grouped lane selector ──────────────────────────────────────────────────

function LaneSelector({
  lanes,
  selectedId,
  onChange,
}: {
  lanes: LaneSummary[]
  selectedId: string
  onChange: (laneId: string) => void
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, LaneSummary[]> = {}
    lanes.forEach((l) => {
      const letter = l.origin[0]
      if (!groups[letter]) groups[letter] = []
      groups[letter].push(l)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [lanes])

  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white appearance-none cursor-pointer focus:outline-none focus:border-emerald-500/50 pr-8 truncate"
      >
        {grouped.map(([letter, group]) => (
          <optgroup key={letter} label={letter} className="bg-[#1a1d2e]">
            {group.map((lane) => (
              <option key={lane.lane_id} value={lane.lane_id} className="bg-[#1a1d2e]">
                {lane.origin} → {lane.destination} ({lane.distance_km.toLocaleString('en-IN')} km)
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
    </div>
  )
}

// ─── Tooltip definitions for each parameter ──────────────────────────────────

const PARAM_TOOLTIPS = {
  weight_tons: {
    simple: 'How heavy the cargo is. Heavier loads burn more fuel and produce more CO₂.',
    technical: 'Gross vehicle weight in metric tons. Directly scales fuel consumption via the drivetrain load model (linear above 60% GVW).',
  },
  load_factor: {
    simple: 'How full the truck is compared to its maximum capacity. A fuller truck is more efficient per kg delivered.',
    technical: 'Ratio of actual payload to max rated payload (0–1.5). Values >1.0 indicate overloading. Used as a normalisation divisor in the per-tonne-km emission factor.',
  },
  traffic_index: {
    simple: 'How congested the roads are. Heavy traffic means more stopping and idling, which wastes fuel.',
    technical: 'Multiplicative scalar on base travel time (1.0 = free-flow). Derived from INRIX/HERE congestion data. Values >1.1 trigger amber warning as stop-and-go increases fuel burn by ~15–30%.',
  },
  weather_index: {
    simple: 'How bad the weather is. Rain, strong winds, or extreme heat make engines work harder.',
    technical: 'Composite index (1.0 = neutral) aggregating headwind penalty, rolling resistance from wet roads, and temperature-related fuel density correction. Source: ERA5 reanalysis.',
  },
  fuel_price_index: {
    simple: 'How expensive diesel is right now compared to the average. Higher prices increase operating costs but not direct CO₂ emissions.',
    technical: 'Normalised fuel price multiplier relative to 12-month rolling mean (1.0 = baseline). Affects cost estimates and indirectly influences route/mode choice elasticity.',
  },
  driver_efficiency_index: {
    simple: 'How smoothly the driver operates the vehicle. Harsh braking, sudden acceleration, and high speeds all increase fuel use.',
    technical: 'Driver behaviour scalar (0.8–1.1) capturing eco-driving score: acceleration events/km, idle time %, and cruise control adherence. Below 0.9 triggers a warning.',
  },
  toll_cost_index: {
    simple: 'The extra cost added by tolls along the route. Higher tolls can make some routes more expensive even if they are shorter.',
    technical: 'Normalised toll expenditure relative to baseline lane toll profile (1.0 = standard). Feeds into the total cost-of-transport model; does not affect CO₂ directly but influences route selection.',
  },
  route_risk_index: {
    simple: 'How dangerous or unpredictable the route is — e.g. mountains, poor roads, or accident-prone areas.',
    technical: 'Composite risk multiplier (1.0 = normal) from road quality score, elevation-change penalty (grade resistance), and historical incident rate. Values >1.1 trigger amber warning.',
  },
} as const

// ─── Slider section (shared by normal and compare modes) ─────────────────────

function SliderSection({
  values,
  onChange,
  compact = false,
}: {
  values: {
    weight_tons: number
    load_factor: number
    traffic_index: number
    weather_index: number
    fuel_price_index: number
    driver_efficiency_index: number
    toll_cost_index: number
    route_risk_index: number
  }
  onChange: (patch: Record<string, number>) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-0.5">
      <SliderField
        label="Weight (tons)"
        value={values.weight_tons}
        min={1} max={40} step={0.5}
        onChange={(v) => onChange({ weight_tons: v })}
        formatVal={(v) => `${v.toFixed(1)}t`}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.weight_tons}
      />
      <SliderField
        label="Load Factor"
        value={values.load_factor}
        min={0.3} max={1.5} step={0.05}
        onChange={(v) => onChange({ load_factor: v })}
        formatVal={(v) => `${(v * 100).toFixed(0)}%`}
        normalValue={0.8}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.load_factor}
      />
      <SliderField
        label="Traffic Index"
        value={values.traffic_index}
        min={0.8} max={1.3} step={0.01}
        onChange={(v) => onChange({ traffic_index: v })}
        normalValue={1.0}
        warnWhen="high" warnThreshold={1.1}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.traffic_index}
      />
      <SliderField
        label="Weather Index"
        value={values.weather_index}
        min={0.8} max={1.2} step={0.01}
        onChange={(v) => onChange({ weather_index: v })}
        normalValue={1.0}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.weather_index}
      />
      <SliderField
        label="Fuel Price Index"
        value={values.fuel_price_index}
        min={0.9} max={1.2} step={0.01}
        onChange={(v) => onChange({ fuel_price_index: v })}
        normalValue={1.01}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.fuel_price_index}
      />
      <SliderField
        label="Driver Efficiency"
        value={values.driver_efficiency_index}
        min={0.8} max={1.1} step={0.01}
        onChange={(v) => onChange({ driver_efficiency_index: v })}
        normalValue={1.0}
        warnWhen="low" warnThreshold={0.9}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.driver_efficiency_index}
      />
      <SliderField
        label="Toll Cost Index"
        value={values.toll_cost_index}
        min={1.0} max={1.5} step={0.01}
        onChange={(v) => onChange({ toll_cost_index: v })}
        normalValue={1.35}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.toll_cost_index}
      />
      <SliderField
        label="Route Risk"
        value={values.route_risk_index}
        min={0.9} max={1.2} step={0.01}
        onChange={(v) => onChange({ route_risk_index: v })}
        normalValue={1.0}
        warnWhen="high" warnThreshold={1.1}
        compact={compact}
        tooltip={PARAM_TOOLTIPS.route_risk_index}
      />
    </div>
  )
}

// ─── Prediction result card ──────────────────────────────────────────────────

function PredictionCard({
  prediction,
  isLoading,
  isError,
  label,
  accent = 'emerald',
}: {
  prediction: { prediction_kg: number; confidence_score: number; confidence_level: string; low_confidence_warning: boolean; origin: string; destination: string; fuel_cost_inr: number; model_used?: string } | null | undefined
  isLoading: boolean
  isError: boolean
  label?: string
  accent?: 'emerald' | 'violet'
}) {
  const accentColor = accent === 'emerald' ? '#10b981' : '#8b5cf6'

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-4 animate-pulse">
        <div className="flex items-center gap-2 text-white/30 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Computing…
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          Prediction failed — check backend
        </div>
      </div>
    )
  }

  if (!prediction) return null

  const confColor = getConfidenceColor(prediction.confidence_level as 'high' | 'medium' | 'low')

  return (
    <div className="bg-white/5 rounded-xl p-4">
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: accentColor }}>
          {label}
        </p>
      )}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-wider">
            Predicted CO₂e
          </p>
          <p className="text-2xl font-bold text-white mt-0.5">
            <AnimatedCO2e value={prediction.prediction_kg} />
          </p>
          {/* Model badge */}
          {prediction.model_used && (
            <p className="flex items-center gap-1.5 mt-1">
              <span className="text-white/30 text-[10px]">via</span>
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                prediction.model_used === 'hybrid_graphsage' || prediction.model_used === 'hybrid'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-emerald-500/15 text-emerald-400',
              )}>
                {prediction.model_used === 'hybrid_graphsage' || prediction.model_used === 'hybrid'
                  ? 'Hybrid'
                  : 'CatBoost'}
              </span>
            </p>
          )}
          <p className="text-white/35 text-[11px] mt-0.5">
            {prediction.origin} → {prediction.destination}
          </p>
        </div>
        <Leaf className="w-5 h-5 shrink-0 mt-1" style={{ color: `${accentColor}60` }} />
      </div>

      {/* Confidence bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: confColor }}>
            <Gauge className="w-3 h-3" />
            {(prediction.confidence_score * 100).toFixed(0)}% confidence
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: confColor }}>
            {prediction.confidence_level}
          </span>
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${prediction.confidence_score * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ backgroundColor: confColor }}
          />
        </div>
      </div>

      {/* Low confidence warning */}
      {prediction.low_confidence_warning && (
        <div className="flex items-center gap-2 mt-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-[10px] text-amber-300/80">
            Low confidence — consider using CatBoost estimate
          </span>
        </div>
      )}

      {/* Fuel cost */}
      <div className="flex items-center justify-between text-[11px] text-white/40 mt-2.5 pt-2.5 border-t border-white/5">
        <span>Est. fuel cost</span>
        <span className="text-white/70 font-medium">{formatCurrency(prediction.fuel_cost_inr)}</span>
      </div>
    </div>
  )
}

// ─── Compare result card ─────────────────────────────────────────────────────

function CompareResult({
  predA,
  predB,
  onApplyB,
}: {
  predA: { prediction_kg: number } | null | undefined
  predB: { prediction_kg: number } | null | undefined
  onApplyB: () => void
}) {
  if (!predA || !predB) return null

  const deltaKg = predB.prediction_kg - predA.prediction_kg
  const deltaPct = (deltaKg / predA.prediction_kg) * 100
  const isBetter = deltaKg < 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 rounded-xl p-4 mt-3"
    >
      {/* Side by side values */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider">Scenario A</p>
          <p className="text-lg font-bold text-white mt-1">{formatCO2e(predA.prediction_kg)}</p>
        </div>
        <div>
          <p className="text-[10px] text-violet-400/60 uppercase tracking-wider">Scenario B</p>
          <p className="text-lg font-bold text-white mt-1">{formatCO2e(predB.prediction_kg)}</p>
        </div>
      </div>

      {/* Delta */}
      <div className={cn(
        'text-center mt-3 pt-3 border-t border-white/8',
        isBetter ? 'text-emerald-400' : 'text-red-400',
      )}>
        <p className="text-sm font-semibold">
          {isBetter ? '↓' : '↑'} {formatCO2e(Math.abs(deltaKg))}
        </p>
        <p className="text-[11px] opacity-70">
          {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}% {isBetter ? 'savings' : 'increase'}
        </p>
      </div>

      {/* Apply B button */}
      {isBetter && (
        <button
          onClick={onApplyB}
          className="w-full mt-3 flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg py-2 transition-colors"
        >
          Apply Scenario B
          <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export function SimulatorPanel() {
  const {
    inputA,
    inputB,
    updateInputA,
    updateInputB,
    resetInputB,
    compareMode,
    setCompareMode,
  } = useAppStore()

  const { data: lanes } = useLanes()

  // Predictions
  const predQueryA = usePrediction(inputA, true)
  const predQueryB = usePrediction(inputB, compareMode)

  // ── Sync prediction results into Zustand store (for ShapExplainer + other consumers)
  const setPredictionA = useAppStore((s) => s.setPredictionA)
  const setPredictionB = useAppStore((s) => s.setPredictionB)
  const activeModel = useAppStore((s) => s.activeModel)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setActiveModel = useAppStore((s) => s.setActiveModel)

  useEffect(() => {
    setPredictionA(predQueryA.data ?? null)
  }, [predQueryA.data, setPredictionA])

  useEffect(() => {
    setPredictionB(predQueryB.data ?? null)
  }, [predQueryB.data, setPredictionB])

  // Recommendations (only for scenario A in normal mode)
  const recQuery = useRecommendations(inputA, predQueryA.data?.prediction_kg ?? null)

  // ── Compare toggle ─────────────────────────────────────────────────────
  const handleToggleCompare = useCallback(() => {
    if (!compareMode) resetInputB()
    setCompareMode(!compareMode)
  }, [compareMode, resetInputB, setCompareMode])

  // ── Apply Scenario B ───────────────────────────────────────────────────
  const applyB = useCallback(() => {
    updateInputA({ ...inputB })
    setCompareMode(false)
  }, [inputB, updateInputA, setCompareMode])

  // ── Lane change handler ────────────────────────────────────────────────
  const handleLaneChange = useCallback(
    (laneId: string) => {
      updateInputA({ lane_id: laneId })
    },
    [updateInputA],
  )

  return (
    <aside className="flex flex-col h-full bg-[#0f1117] border-l border-white/8 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h2 className="text-white text-sm font-semibold">Emission Simulator</h2>
        </div>
        <button
          onClick={handleToggleCompare}
          className={cn(
            'flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all',
            compareMode
              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
              : 'bg-white/5 text-white/40 border border-white/8 hover:text-white/60 hover:border-white/15',
          )}
        >
          <GitCompareArrows className="w-3 h-3" />
          {compareMode ? 'Exit Compare' : 'Compare A/B'}
        </button>
      </div>

      {/* ── TFT notice (when TFT pill is active) ─────────────────── */}
      {activeModel === 'tft' && (
        <div className="flex items-start gap-3 mx-5 mt-3 mb-0 bg-purple-500/10 border border-purple-500/25 rounded-xl p-3 shrink-0">
          <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-purple-400 text-[10px] font-bold">T</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300 text-xs font-medium">TFT Forecasting Model active</p>
            <p className="text-purple-300/60 text-[11px] mt-0.5 leading-relaxed">
              TFT predicts emission <em>trends</em> over 4–12 weeks, not per-shipment.
              The Forecast tab is now open.
            </p>
            <button
              onClick={() => {
                setActiveModel('catboost')
                updateInputA({ model: 'catboost' })
              }}
              className="text-purple-300 text-[11px] underline underline-offset-2 mt-1 hover:text-purple-200 transition-colors"
            >
              ← Switch back to CatBoost
            </button>
          </div>
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!compareMode ? (
          /* ── NORMAL MODE ─────────────────────────────────────── */
          <div className="px-5 py-4 space-y-5">
            {/* Lane selector */}
            {lanes && (
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5 block">
                  Freight Lane
                </label>
                <LaneSelector
                  lanes={lanes}
                  selectedId={inputA.lane_id}
                  onChange={handleLaneChange}
                />
              </div>
            )}

            {/* Vehicle type tiles */}
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-2 block">
                Vehicle Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {VEHICLE_TYPES.map((vt) => (
                  <VehicleTile
                    key={vt}
                    vehicleType={vt}
                    selected={inputA.vehicle_type === vt}
                    onClick={() => updateInputA({ vehicle_type: vt })}
                  />
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">
                Parameters
              </label>
              <SliderSection
                values={inputA}
                onChange={(patch) => updateInputA(patch)}
              />
            </div>

            {/* Prediction result */}
            <PredictionCard
              prediction={predQueryA.data}
              isLoading={predQueryA.isLoading}
              isError={predQueryA.isError}
            />
          </div>
        ) : (
          /* ── COMPARE MODE ────────────────────────────────────── */
          <div className="p-4 space-y-4">
            {/* Lane selector (shared) */}
            {lanes && (
              <LaneSelector
                lanes={lanes}
                selectedId={inputA.lane_id}
                onChange={handleLaneChange}
              />
            )}

            {/* A/B columns */}
            <div className="grid grid-cols-2 gap-3">
              {/* Scenario A */}
              <div className="space-y-3">
                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider text-center bg-emerald-500/10 rounded-lg py-1">
                  Scenario A
                </div>
                <select
                  value={inputA.vehicle_type}
                  onChange={(e) => updateInputA({ vehicle_type: e.target.value as VehicleType })}
                  className="w-full bg-white/5 border border-emerald-500/20 rounded-md px-2 py-1.5 text-[10px] text-white appearance-none"
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt} value={vt} className="bg-[#1a1d2e]">
                      {vt.replace('road_', '').replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <SliderSection values={inputA} onChange={(p) => updateInputA(p)} compact />
              </div>

              {/* Scenario B */}
              <div className="space-y-3">
                <div className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider text-center bg-violet-500/10 rounded-lg py-1">
                  Scenario B
                </div>
                <select
                  value={inputB.vehicle_type}
                  onChange={(e) => updateInputB({ vehicle_type: e.target.value as VehicleType })}
                  className="w-full bg-white/5 border border-violet-500/20 rounded-md px-2 py-1.5 text-[10px] text-white appearance-none"
                >
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt} value={vt} className="bg-[#1a1d2e]">
                      {vt.replace('road_', '').replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <SliderSection values={inputB} onChange={(p) => updateInputB(p)} compact />
              </div>
            </div>

            {/* Prediction cards */}
            <div className="grid grid-cols-2 gap-3">
              <PredictionCard
                prediction={predQueryA.data}
                isLoading={predQueryA.isLoading}
                isError={predQueryA.isError}
                label="Scenario A"
                accent="emerald"
              />
              <PredictionCard
                prediction={predQueryB.data}
                isLoading={predQueryB.isLoading}
                isError={predQueryB.isError}
                label="Scenario B"
                accent="violet"
              />
            </div>

            {/* Comparison delta */}
            <CompareResult
              predA={predQueryA.data}
              predB={predQueryB.data}
              onApplyB={applyB}
            />
          </div>
        )}

        {/* ── Recommendations (below prediction in normal mode) ── */}
        {!compareMode && (
          <RecommendationPanel
            recommendations={recQuery.data?.recommendations}
            isLoading={recQuery.isLoading}
            baselineKg={predQueryA.data?.prediction_kg ?? null}
            currentOrigin={predQueryA.data?.origin}
            currentDestination={predQueryA.data?.destination}
          />
        )}
      </div>
    </aside>
  )
}
