/**
 * ShapExplainer — dual waterfall + ranked bar chart for SHAP feature attribution.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { BrainCircuit } from 'lucide-react'
import { useAppStore } from '@/store'
import type { ShapFeature } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  weight_tons: 'Weight (t)',
  load_factor: 'Load Factor',
  traffic_index: 'Traffic',
  weather_index: 'Weather',
  fuel_price_index: 'Fuel Price',
  driver_efficiency_index: 'Driver Eff.',
  toll_cost_index: 'Toll Cost',
  route_risk_index: 'Route Risk',
  distance_km: 'Distance',
  month: 'Month',
  week_of_year: 'Week',
  vehicle_type: 'Vehicle',
}

function featureLabel(name: string) {
  return FEATURE_LABELS[name] ?? name.replace(/_/g, ' ')
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function WaterfallTooltip({ active, payload }: { active?: boolean; payload?: { payload: ShapFeature & { displayValue: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#141720]/95 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/70 font-medium">{featureLabel(d.feature)}</p>
      <p className={d.direction === 'increases' ? 'text-red-400' : 'text-emerald-400'}>
        {d.direction === 'increases' ? '+' : ''}{d.value.toFixed(0)} kg
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ShapExplainer() {
  const predictionA = useAppStore((s) => s.predictionA)

  if (!predictionA?.shap_features?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
        <BrainCircuit className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">
          {predictionA ? 'Computing SHAP values…' : 'No attribution data'}
        </p>
        <p className="text-xs text-white/25 max-w-[260px] text-center">
          {predictionA
            ? 'Feature attribution is being calculated for the current prediction.'
            : 'Run a prediction from the Emission Simulator to see feature attribution.'}
        </p>
      </div>
    )
  }

  const features = predictionA.shap_features
  const baselinePkg = predictionA.prediction_kg

  // Waterfall data — sorted by position
  const waterfallData = features.map((f) => ({
    ...f,
    displayValue: f.direction === 'increases' ? f.value : -f.value,
  }))

  // Ranked data — sorted by absolute magnitude
  const rankedData = [...features]
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map((f) => ({
      ...f,
      displayValue: f.direction === 'increases' ? f.value : -f.value,
    }))

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div>
        <h2 className="text-white font-semibold">SHAP Feature Attribution</h2>
        <p className="text-white/40 text-xs mt-0.5">
          Baseline prediction: {baselinePkg.toLocaleString('en-IN')} kg — bars show push above/below baseline
        </p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
        {/* LEFT: Waterfall */}
        <div className="flex flex-col gap-2">
          <p className="text-white/50 text-xs font-medium">Directional Impact</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}`}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="feature"
                tickFormatter={featureLabel}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
              <Tooltip content={<WaterfallTooltip />} />
              <Bar dataKey="displayValue" radius={[0, 3, 3, 0]}>
                {waterfallData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.direction === 'increases' ? '#ef4444' : '#22c55e'}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* RIGHT: Ranked by magnitude */}
        <div className="flex flex-col gap-2">
          <p className="text-white/50 text-xs font-medium">Top 10 by Magnitude</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankedData} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                tickFormatter={(v) => `${Math.abs(v).toFixed(0)}`}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="feature"
                tickFormatter={featureLabel}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip content={<WaterfallTooltip />} />
              <Bar dataKey="displayValue" radius={[0, 3, 3, 0]}>
                {rankedData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.direction === 'increases' ? '#ef4444' : '#22c55e'}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-white/25 text-[11px] border-t border-white/8 pt-3">
        Feature attribution shows which inputs pushed this prediction above or below the baseline of{' '}
        <span className="text-white/50">{baselinePkg.toLocaleString('en-IN')} kg</span>.
        Longer bars = stronger influence. Red = increases CO₂e, Green = reduces it.
      </p>
    </div>
  )
}
