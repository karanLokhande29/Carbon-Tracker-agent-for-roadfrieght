import { usePrediction } from '@/hooks/usePredict'
import { useRecommendations } from '@/hooks/useRecommendations'
import { useAppStore } from '@/store'
import { formatCO2e, formatCurrency, getConfidenceColor, vehicleTypeLabel, cn } from '@/lib/utils'
import {
  Sliders,
  Gauge,
  Leaf,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ArrowDownRight,
} from 'lucide-react'
import type { VehicleType } from '@/types'

// ─── Slider row ───────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formatVal?: (v: number) => string
}

function SliderRow({ label, value, min, max, step, onChange, formatVal }: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-white/50 w-36 shrink-0">{label}</span>
      <div className="relative flex-1 h-1.5 bg-white/10 rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="text-[11px] text-white/80 w-14 text-right tabular-nums">
        {formatVal ? formatVal(value) : value.toFixed(2)}
      </span>
    </div>
  )
}

// ─── Vehicle selector ─────────────────────────────────────────────────────────

const VEHICLE_TYPES: VehicleType[] = [
  'road_articulated_diesel',
  'road_rigid_diesel',
  'road_lcv_diesel',
  'road_cng',
  'road_rigid_electric',
]

// ─── SimulatorPanel ───────────────────────────────────────────────────────────

export function SimulatorPanel() {
  const { inputA, updateInputA } = useAppStore()

  const { data: prediction, isLoading, isError } = usePrediction(inputA, true)
  const { data: recommendations } = useRecommendations(
    inputA,
    prediction?.prediction_kg ?? null,
  )

  const confColor = prediction
    ? getConfidenceColor(prediction.confidence_level)
    : '#6b7280'

  return (
    <aside className="flex flex-col h-full bg-[#0f1117] border-l border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
        <Sliders className="w-4 h-4 text-emerald-400" />
        <h2 className="text-white text-sm font-semibold">Emission Simulator</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 scrollbar-thin">

        {/* Vehicle type */}
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider mb-2 block">
            Vehicle Type
          </label>
          <div className="relative">
            <select
              value={inputA.vehicle_type}
              onChange={(e) => updateInputA({ vehicle_type: e.target.value as VehicleType })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-emerald-500/50"
            >
              {VEHICLE_TYPES.map((vt) => (
                <option key={vt} value={vt} className="bg-[#1a1d2e]">
                  {vehicleTypeLabel(vt)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        </div>

        {/* Sliders */}
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider mb-3 block">
            Shipment Parameters
          </label>
          <div className="space-y-3.5">
            <SliderRow
              label="Weight (tons)"
              value={inputA.weight_tons}
              min={1} max={40} step={0.5}
              onChange={(v) => updateInputA({ weight_tons: v })}
              formatVal={(v) => `${v.toFixed(1)}t`}
            />
            <SliderRow
              label="Load Factor"
              value={inputA.load_factor}
              min={0.3} max={1.5} step={0.01}
              onChange={(v) => updateInputA({ load_factor: v })}
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider mb-3 block">
            Operational Indices
          </label>
          <div className="space-y-3.5">
            <SliderRow
              label="Traffic Index"
              value={inputA.traffic_index}
              min={0.8} max={1.3} step={0.01}
              onChange={(v) => updateInputA({ traffic_index: v })}
            />
            <SliderRow
              label="Weather Index"
              value={inputA.weather_index}
              min={0.8} max={1.2} step={0.01}
              onChange={(v) => updateInputA({ weather_index: v })}
            />
            <SliderRow
              label="Driver Efficiency"
              value={inputA.driver_efficiency_index}
              min={0.8} max={1.1} step={0.01}
              onChange={(v) => updateInputA({ driver_efficiency_index: v })}
            />
            <SliderRow
              label="Fuel Price Index"
              value={inputA.fuel_price_index}
              min={0.9} max={1.2} step={0.01}
              onChange={(v) => updateInputA({ fuel_price_index: v })}
            />
            <SliderRow
              label="Toll Cost Index"
              value={inputA.toll_cost_index}
              min={1.0} max={1.5} step={0.01}
              onChange={(v) => updateInputA({ toll_cost_index: v })}
            />
            <SliderRow
              label="Route Risk Index"
              value={inputA.route_risk_index}
              min={0.9} max={1.2} step={0.01}
              onChange={(v) => updateInputA({ route_risk_index: v })}
            />
          </div>
        </div>
      </div>

      {/* Prediction result */}
      <div className="border-t border-white/10 px-5 py-4 space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Computing…
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Prediction failed — check backend
          </div>
        )}

        {prediction && !isLoading && (
          <>
            {/* Main CO2e */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/40 text-[11px] uppercase tracking-wider">
                    Predicted CO₂e
                  </p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {formatCO2e(prediction.prediction_kg)}
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    {prediction.origin} → {prediction.destination}
                  </p>
                </div>
                <Leaf className="w-6 h-6 text-emerald-500/60 mt-1" />
              </div>

              {/* Confidence */}
              <div className="flex items-center gap-2 mt-3">
                <Gauge className="w-3.5 h-3.5" style={{ color: confColor }} />
                <span className="text-xs" style={{ color: confColor }}>
                  {(prediction.confidence_score * 100).toFixed(0)}% confidence
                  ({prediction.confidence_level})
                </span>
                {prediction.low_confidence_warning && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 ml-auto" />
                )}
              </div>
            </div>

            {/* Fuel cost */}
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>Est. fuel cost</span>
              <span className="text-white/80">
                {formatCurrency(prediction.fuel_cost_inr)}
              </span>
            </div>

            {/* Best recommendation */}
            {recommendations?.recommendations[0] && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-emerald-400 text-[11px] font-medium truncate">
                    {recommendations.recommendations[0].action}
                  </p>
                  <p className="text-emerald-500/60 text-[10px]">
                    Save {formatCO2e(Math.abs(recommendations.recommendations[0].co2e_delta_kg))}
                    {' '}({Math.abs(recommendations.recommendations[0].co2e_delta_pct).toFixed(1)}%)
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
