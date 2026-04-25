/**
 * VehicleBreakdown — stacked/grouped Recharts bar chart of monthly CO₂e by vehicle type.
 */
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVehicleBreakdown } from '@/hooks/useAnalytics'
import type { VehicleType } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_COLORS: Record<VehicleType, string> = {
  road_articulated_diesel: '#ef4444',
  road_rigid_diesel: '#f97316',
  road_lcv_diesel: '#eab308',
  road_cng: '#22c55e',
  road_rigid_electric: '#3b82f6',
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  road_articulated_diesel: 'Articulated',
  road_rigid_diesel: 'Rigid',
  road_lcv_diesel: 'LCV',
  road_cng: 'CNG',
  road_rigid_electric: 'Electric',
}

const VEHICLE_TYPES: VehicleType[] = [
  'road_articulated_diesel',
  'road_rigid_diesel',
  'road_lcv_diesel',
  'road_cng',
  'road_rigid_electric',
]

type ViewMode = 'stacked' | 'grouped'
type NormMode = 'total' | 'per_km' | 'per_tonne'
type YearFilter = 'all' | '2023' | '2024' | '2025' | '2026' | '2027'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtKg(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}Mt`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return `${Math.round(v)}`
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="bg-[#141720]/95 border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-xs min-w-[180px]">
      <p className="text-white/60 font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white/80 tabular-nums">{fmtKg(p.value)} kg</span>
        </div>
      ))}
      <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
        <span className="text-white/40">Total</span>
        <span className="text-white/90 font-medium tabular-nums">{fmtKg(total)} kg</span>
      </div>
    </div>
  )
}

// ─── Toggle Button Group ──────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-[10px] font-medium transition-colors',
            value === opt.value
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/3 text-white/40 hover:text-white/60',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VehicleBreakdown() {
  const { data, isLoading, isError } = useVehicleBreakdown()

  const [viewMode, setViewMode] = useState<ViewMode>('stacked')
  const [normMode, setNormMode] = useState<NormMode>('total')
  const [yearFilter, setYearFilter] = useState<YearFilter>('all')

  // Transform data into chart format
  const chartData = useMemo(() => {
    if (!data) return []

    const filtered = yearFilter === 'all'
      ? data
      : data.filter((d) => d.year_month.startsWith(yearFilter))

    const monthMap = new Map<string, Record<string, number>>()

    for (const row of filtered) {
      const label = row.year_month // e.g. "2023-01"
      const [y, m] = label.split('-')
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const displayLabel = `${monthNames[parseInt(m) - 1]} '${y.slice(2)}`

      if (!monthMap.has(displayLabel)) monthMap.set(displayLabel, {})
      const entry = monthMap.get(displayLabel)!

      const value = normMode === 'total'
        ? row.total_co2e_kg
        : normMode === 'per_km'
          ? row.avg_co2e_per_km
          : row.avg_co2e_per_tonne

      entry[VEHICLE_LABELS[row.vehicle_type as VehicleType]] = value
    }

    return Array.from(monthMap.entries()).map(([month, values]) => ({ month, ...values }))
  }, [data, yearFilter, normMode])

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-white/40 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading breakdown…</span>
    </div>
  )

  if (isError) return (
    <div className="flex items-center justify-center h-full text-red-400/60 text-sm">
      Failed to load vehicle breakdown
    </div>
  )

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Vehicle Fleet Breakdown</h2>
          <p className="text-white/40 text-xs mt-0.5">Monthly CO₂e by vehicle type</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <ToggleGroup
          options={[{ label: 'Stacked', value: 'stacked' }, { label: 'Grouped', value: 'grouped' }]}
          value={viewMode}
          onChange={setViewMode}
        />
        <ToggleGroup
          options={[
            { label: 'Total', value: 'total' },
            { label: 'Per km', value: 'per_km' },
            { label: 'Per tonne', value: 'per_tonne' },
          ]}
          value={normMode}
          onChange={setNormMode}
        />
        <ToggleGroup
          options={[
            { label: 'All', value: 'all' },
            ...(['2023','2024','2025','2026','2027'] as YearFilter[]).map((y) => ({ label: y, value: y })),
          ]}
          value={yearFilter}
          onChange={setYearFilter}
        />
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={yearFilter === 'all' ? 5 : 1}
            />
            <YAxis
              tickFormatter={fmtKg}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', paddingTop: '12px' }}
            />
            {VEHICLE_TYPES.map((vt) => (
              <Bar
                key={vt}
                dataKey={VEHICLE_LABELS[vt]}
                stackId={viewMode === 'stacked' ? 'a' : undefined}
                fill={VEHICLE_COLORS[vt]}
                opacity={0.85}
                radius={viewMode === 'grouped' ? [2, 2, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
