/**
 * ForecastPanel — full-width TFT quantile forecast area chart with lane selector.
 */
import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend,
} from 'recharts'
import { Loader2, AlertTriangle, TrendingUp, Info } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { ForecastReliabilityBadge } from './ForecastReliabilityBadge'
import { useForecast, useLanes } from '@/hooks/useLanes'
import { useAnomalies } from '@/hooks/useAnalytics'
import { cn } from '@/lib/utils'
import type { ForecastPoint, HistoricalPoint } from '@/types'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

function fmtKg(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return `${Math.round(v)}`
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ForecastTooltip({ active, payload, label, anomalyDates }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  anomalyDates: Set<string>
}) {
  if (!active || !payload?.length) return null
  const isAnomaly = label ? anomalyDates.has(label) : false

  return (
    <div className="bg-[#141720]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs min-w-[200px]">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-white/60 font-semibold">{label}</p>
        {isAnomaly && (
          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            anomaly week
          </span>
        )}
      </div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-6 py-0.5">
          <span style={{ color: p.color }} className="opacity-80">{p.name}</span>
          <span className="text-white/80 tabular-nums">{fmtKg(p.value)} kg</span>
        </div>
      ))}
    </div>
  )
}

// ─── Lane Selector ────────────────────────────────────────────────────────────

function LaneSelect({ laneId, onChange, lanes }: {
  laneId: string
  onChange: (id: string) => void
  lanes: { lane_id: string; origin: string; destination: string; distance_km: number }[]
}) {
  return (
    <div className="relative">
      <select
        value={laneId}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white appearance-none pr-7 min-w-[240px] focus:outline-none focus:border-emerald-500/50"
      >
        {lanes.map((l) => (
          <option key={l.lane_id} value={l.lane_id} className="bg-[#1a1d2e]">
            {l.origin} → {l.destination} ({l.distance_km.toLocaleString('en-IN')} km)
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ForecastPanel() {
  const { data: lanes } = useLanes()
  const [laneId, setLaneId] = useState('lane_000')
  const [horizon, setHorizon] = useState(8)

  const { data: forecast, isLoading, isError } = useForecast(laneId, horizon)
  const { data: anomalies } = useAnomalies()

  const hasForecastData = (forecast?.forecast?.length ?? 0) > 0

  // Build set of anomaly dates for reference lines
  const anomalyDates = useMemo(() => {
    if (!anomalies) return new Set<string>()
    return new Set(anomalies.map((a) => a.date))
  }, [anomalies])

  // Merge historical + forecast into unified chart data
  // Always include historical even if forecast is empty
  const chartData = useMemo(() => {
    if (!forecast) return []

    const hist: { date: string; historical: number }[] = (forecast.historical as HistoricalPoint[]).map((h) => ({
      date: fmtDate(h.date),
      historical: h.co2e_kg,
    }))

    const fcast = (forecast.forecast as ForecastPoint[]).map((f) => ({
      date: fmtDate(f.date),
      q10: f.q10,
      q25: f.q25,
      q50: f.q50,
      q75: f.q75,
      q90: f.q90,
      isLowConf: f.low_confidence,
    }))

    // Merge by date label
    const allDates = [...hist.map((h) => h.date), ...fcast.map((f) => f.date)]
    const map = new Map<string, Record<string, number | boolean>>()
    hist.forEach((h) => map.set(h.date, { historical: h.historical }))
    fcast.forEach((f) => {
      const existing = map.get(f.date) ?? {}
      map.set(f.date, { ...existing, ...f })
    })

    return allDates.filter((d, i, arr) => arr.indexOf(d) === i).map((date) => ({
      date,
      ...(map.get(date) ?? {}),
    }))
  }, [forecast])

  // Anomaly reference lines within chart range
  const anomalyRefLines = useMemo(() => {
    if (!forecast || !anomalies) return []
    const forecastDates = new Set(chartData.map((d) => d.date))
    return anomalies
      .map((a) => fmtDate(a.date))
      .filter((d) => forecastDates.has(d))
      .slice(0, 5) // cap to avoid clutter
  }, [forecast, anomalies, chartData])

  const hasLowConf = useMemo(() =>
    forecast?.forecast.some((f) => f.low_confidence) ?? false,
  [forecast])

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-white font-semibold">TFT Quantile Forecast</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {lanes && (
            <LaneSelect laneId={laneId} onChange={setLaneId} lanes={lanes} />
          )}

          {/* Horizon slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 whitespace-nowrap">Horizon:</span>
            <input
              type="range"
              min={4} max={12} step={1}
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value))}
              className="w-24 accent-blue-500"
            />
            <span className="text-xs text-blue-400 w-14">{horizon} weeks</span>
          </div>

          {/* Reliability badge */}
          {forecast && (
            <ForecastReliabilityBadge
              reliability={forecast.lane_reliability.reliability}
              mape={forecast.lane_reliability.mape}
            />
          )}
        </div>
      </div>

      {/* Low confidence banner */}
      {hasLowConf && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-300/90 text-xs">
            Predictions in low-CO₂e range (&lt;1,000 kg) have elevated uncertainty.
            CatBoost point estimate displayed for those weeks.
          </span>
        </div>
      )}

      {/* Fallback info badge — subtle, not alarming */}
      {forecast?.is_tft_fallback && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Directional forecast — TFT running in historical mode on this platform
        </div>
      )}

      {/* Chart */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center text-white/40 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading forecast…</span>
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center text-red-400/60 text-sm gap-2">
          <AlertTriangle className="w-4 h-4" />
          Failed to load forecast — backend may not have trained TFT model
        </div>
      )}

      {!isLoading && !isError && chartData.length > 0 && (
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <AreaChart
            width={880}
            height={380}
            data={chartData}
            margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
            style={{ margin: '0 auto', display: 'block' }}
          >
            <defs>
              <linearGradient id="ciWide" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="ciIqr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.10} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 8)} />
            <YAxis tickFormatter={fmtKg} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={(props) => <ForecastTooltip {...props} anomalyDates={anomalyDates} />} />
            <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} label={{ value: '1k kg', fill: '#ef4444', fontSize: 9, position: 'right' }} />
            {anomalyRefLines.map((date) => (
              <ReferenceLine key={date} x={date} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
            ))}
            <Area type="monotone" dataKey="q90" stroke="none" fill="url(#ciWide)" fillOpacity={1} name="90th pct" legendType="none" />
            <Area type="monotone" dataKey="q10" stroke="none" fill="#0a0d14" fillOpacity={1} name="10th pct" legendType="none" />
            <Area type="monotone" dataKey="q75" stroke="none" fill="url(#ciIqr)" fillOpacity={1} name="75th pct" legendType="none" />
            <Area type="monotone" dataKey="q25" stroke="none" fill="#0a0d14" fillOpacity={1} name="25th pct" legendType="none" />
            <Area type="monotone" dataKey="q50" stroke="#3b82f6" strokeWidth={2} fill="none" dot={false} name="Median (q50)" />
            <Area type="monotone" dataKey="historical" stroke="rgba(156,163,175,0.7)" strokeWidth={1.5} strokeDasharray="6 3" fill="none" dot={false} name="Historical" />
            <Legend wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', paddingTop: '8px' }} />
          </AreaChart>
        </div>
      )}
    </div>
  )
}
