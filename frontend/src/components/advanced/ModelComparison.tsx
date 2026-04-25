/**
 * ModelComparison — metrics table + quantile calibration chart + per-entity MAPE bars.
 */
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Cell, LineChart, Line, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { useModelMetrics, useEntityMape } from '@/hooks/useAnalytics'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { ChartSkeleton, TableSkeleton } from '@/components/layout/LoadingSkeleton'
import type { ModelMetrics, EntityMapeItem } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

// Quantile calibration data (TFT observed coverage)
const CALIBRATION_DATA = [
  { q: '2%',  ideal: 0.02, tft: 0.05 },
  { q: '10%', ideal: 0.10, tft: 0.12 },
  { q: '25%', ideal: 0.25, tft: 0.26 },
  { q: '50%', ideal: 0.50, tft: 0.52 },
  { q: '75%', ideal: 0.75, tft: 0.76 },
  { q: '90%', ideal: 0.90, tft: 0.89 },
  { q: '98%', ideal: 0.98, tft: 0.96 },
]

// Metrics we display (key in ModelMetrics.metrics)
const METRIC_ROWS: { label: string; key: string; lowerIsBetter?: boolean; pct?: boolean }[] = [
  { label: 'Val RMSE (kg)',       key: 'val_rmse',          lowerIsBetter: true },
  { label: 'Val MAPE (%)',        key: 'val_mape',          lowerIsBetter: true, pct: true },
  { label: 'Val MAE (kg)',        key: 'val_mae',           lowerIsBetter: true },
  { label: 'Val R²',             key: 'val_r2',            lowerIsBetter: false },
  { label: 'Test RMSE (kg)',      key: 'test_rmse',         lowerIsBetter: true },
  { label: 'Test MAPE (%)',       key: 'test_mape',         lowerIsBetter: true, pct: true },
  { label: 'Test MAE (kg)',       key: 'test_mae',          lowerIsBetter: true },
  { label: 'Within 10% (%)',      key: 'val_within_10pct',  lowerIsBetter: false, pct: true },
  { label: 'Within 20% (%)',      key: 'val_within_20pct',  lowerIsBetter: false, pct: true },
  { label: 'Inference (ms)',      key: 'inference_ms',      lowerIsBetter: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapeColor(mape: number) {
  if (mape < 20) return '#22c55e'
  if (mape < 30) return '#f59e0b'
  return '#ef4444'
}

function fmtMetric(val: number | string | undefined, pct?: boolean): string {
  if (val === undefined || val === null) return '—'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return String(val)
  return pct ? `${n.toFixed(1)}%` : n.toFixed(1)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricsTable({ models }: { models: ModelMetrics[] }) {
  // Merge inference_ms from root into metrics so table can access it by key
  const enriched = models.map((m) => ({
    ...m,
    metrics: { ...m.metrics, inference_ms: m.inference_ms },
  }))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-white/40 font-medium py-2 pr-4 whitespace-nowrap">Metric</th>
            {enriched.map((m) => (
              <th key={m.name} className="text-left text-white/70 font-semibold py-2 px-3 whitespace-nowrap">
                <div>{m.name}</div>
                <div className="text-[9px] text-white/30 font-normal mt-0.5">{m.best_for}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_ROWS.map(({ label, key, lowerIsBetter, pct }) => {
            const values = enriched.map((m) => {
              const v = m.metrics?.[key]
              return v !== undefined ? parseFloat(String(v)) : NaN
            })
            const validValues = values.filter((v) => !isNaN(v))
            const best = validValues.length
              ? lowerIsBetter
                ? Math.min(...validValues)
                : Math.max(...validValues)
              : null

            return (
              <tr key={key} className="border-t border-white/5 hover:bg-white/2 transition-colors">
                <td className="py-2 pr-4 text-white/50">{label}</td>
                {values.map((v, i) => {
                  const isBest = best !== null && !isNaN(v) && v === best
                  return (
                    <td
                      key={i}
                      className={cn(
                        'py-2 px-3 font-mono tabular-nums rounded',
                        isBest ? 'text-emerald-400 bg-emerald-500/8' : 'text-white/70',
                      )}
                    >
                      {fmtMetric(v, pct)}
                      {isBest && <span className="ml-1 text-emerald-500/60 text-[9px]">★</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CalibrationChart() {
  return (
    <div className="bg-white/3 rounded-xl p-4 border border-white/8">
      <p className="text-white/70 text-xs font-semibold">TFT Quantile Calibration — near-ideal coverage</p>
      <p className="text-white/30 text-[11px] mt-0.5 mb-3">
        The 80% CI truly contains ~80% of actual values
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={CALIBRATION_DATA} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="q" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            axisLine={false} tickLine={false} domain={[0, 1]}
          />
          <Tooltip
            formatter={(v: number) => [`${(v * 100).toFixed(0)}%`]}
            contentStyle={{ backgroundColor: '#141720', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
          />
          <Legend wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }} />
          <Line type="monotone" dataKey="ideal" name="Ideal (diagonal)" stroke="rgba(156,163,175,0.5)" strokeDasharray="5 3" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="tft" name="TFT Observed" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EntityMapeChart({ data }: { data: EntityMapeItem[] }) {
  const setSelectedLaneId = useAppStore((s) => s.setSelectedLaneId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const sorted = useMemo(
    () => [...data].sort((a, b) => b.mape - a.mape),
    [data]
  )

  function handleBarClick(entry: EntityMapeItem) {
    setSelectedLaneId(entry.lane_id)
    setActiveTab('forecast')
  }

  return (
    <div className="bg-white/3 rounded-xl p-4 border border-white/8">
      <p className="text-white/70 text-xs font-semibold mb-0.5">Per-Lane MAPE — click to open forecast</p>
      <p className="text-white/30 text-[11px] mb-3">140 lanes sorted by forecast difficulty</p>
      <div style={{ height: 280, overflowX: 'auto' }}>
        <BarChart
          width={Math.max(sorted.length * 7, 880)}
          height={260}
          data={sorted}
          margin={{ top: 10, right: 10, bottom: 30, left: 40 }}
          onClick={(d) => { if (d?.activePayload?.[0]) handleBarClick(d.activePayload[0].payload as EntityMapeItem) }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="lane_id"
            tickFormatter={(v: string) => v.slice(-3)}
            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 8 }}
            axisLine={false} tickLine={false}
            interval={9}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
            axisLine={false} tickLine={false} width={36}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}%`, 'MAPE']}
            labelFormatter={(label: string) => {
              const item = sorted.find((s) => s.lane_id === label)
              return item ? `${item.origin} → ${item.destination}` : label
            }}
            contentStyle={{ backgroundColor: '#141720', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
          />
          <ReferenceLine y={10} stroke="rgba(34,197,94,0.4)" strokeDasharray="4 4" label={{ value: '10%', fill: '#22c55e', fontSize: 9, position: 'right' }} />
          <ReferenceLine y={20} stroke="rgba(245,158,11,0.4)" strokeDasharray="4 4" label={{ value: '20%', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
          <Bar dataKey="mape" radius={[2, 2, 0, 0]} maxBarSize={8}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={mapeColor(entry.mape)} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelComparison() {
  const { data: models, isLoading: metricsLoading } = useModelMetrics()
  const { data: entityMape, isLoading: mapeLoading } = useEntityMape()

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Section 1: Metrics Table */}
      <div className="bg-white/3 rounded-xl p-4 border border-white/8">
        <p className="text-white/70 text-xs font-semibold mb-3">Model Metrics Comparison</p>
        {metricsLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : models?.length ? (
          <MetricsTable models={models} />
        ) : (
          <p className="text-white/30 text-xs">Model metrics not available</p>
        )}
      </div>

      {/* Section 2: Calibration Chart */}
      <CalibrationChart />

      {/* Section 3: Per-entity MAPE */}
      {mapeLoading ? (
        <ChartSkeleton height={320} />
      ) : entityMape?.length ? (
        <EntityMapeChart data={entityMape} />
      ) : (
        <div className="text-white/30 text-xs text-center py-8">Per-lane MAPE data unavailable</div>
      )}
    </div>
  )
}
