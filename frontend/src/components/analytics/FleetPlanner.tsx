/**
 * FleetPlanner — vehicle mix optimiser with radial chart and carbon impact stats.
 */
import { useState, useMemo, useRef } from 'react'
import {
  RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip,
} from 'recharts'
import { AlertTriangle, RefreshCw, Info } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { SliderField } from '@/components/simulator/SliderField'
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
  road_articulated_diesel: 'Articulated Diesel',
  road_rigid_diesel: 'Rigid Diesel',
  road_lcv_diesel: 'LCV Diesel',
  road_cng: 'CNG',
  road_rigid_electric: 'Electric',
}

// Average CO₂e per shipment from dataset (kg)
const AVG_CO2E: Record<VehicleType, number> = {
  road_articulated_diesel: 3200,
  road_rigid_diesel: 1800,
  road_lcv_diesel: 620,
  road_cng: 870,
  road_rigid_electric: 120,
}

// Fuel cost per shipment (INR)
const FUEL_COST: Record<VehicleType, number> = {
  road_articulated_diesel: 72000,
  road_rigid_diesel: 48000,
  road_lcv_diesel: 18000,
  road_cng: 32000,
  road_rigid_electric: 4200,
}

const ANNUAL_SHIPMENTS = 41_336
const VEHICLES = Object.keys(AVG_CO2E) as VehicleType[]

const BASELINE: Record<VehicleType, number> = {
  road_articulated_diesel: 34,
  road_rigid_diesel: 30,
  road_lcv_diesel: 18, // fixed: was 17, baseline must sum to 100
  road_cng: 12,
  road_rigid_electric: 6,
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  positive,
  tooltip,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean
  tooltip?: string
}) {
  const [show, setShow] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShow(true)
  }
  function handleLeave() {
    timerRef.current = setTimeout(() => setShow(false), 120)
  }

  return (
    <div className="bg-white/4 rounded-xl p-4 border border-white/8 relative">
      <div className="flex items-center gap-1">
        <p className="text-white/40 text-[10px] uppercase tracking-wider">{label}</p>
        {tooltip && (
          <span
            className="relative inline-flex items-center"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <Info className="w-3 h-3 text-white/25 hover:text-white/50 cursor-help transition-colors" />
            {show && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#1e2235] border border-white/12 rounded-lg px-3 py-2 text-[11px] text-white/70 leading-relaxed shadow-xl z-50 pointer-events-none whitespace-normal">
                {tooltip}
                {/* small arrow */}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e2235]" />
              </span>
            )}
          </span>
        )}
      </div>
      <p className={cn('text-xl font-bold mt-1', positive === true ? 'text-emerald-400' : positive === false ? 'text-red-400' : 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FleetPlanner() {
  const [mix, setMix] = useState<Record<VehicleType, number>>({ ...BASELINE })
  const [offsetPrice, setOffsetPrice] = useState(1500)

  const total = useMemo(() => VEHICLES.reduce((s, v) => s + mix[v], 0), [mix])
  const isValid = Math.abs(total - 100) < 0.5

  function autoCorrect() {
    if (total === 0) return
    const factor = 100 / total
    const corrected = Object.fromEntries(VEHICLES.map((v) => [v, Math.round(mix[v] * factor * 10) / 10])) as Record<VehicleType, number>
    setMix(corrected)
  }

  function setVehicle(vt: VehicleType, pct: number) {
    setMix((prev) => ({ ...prev, [vt]: pct }))
  }

  // Computations
  const annualCo2eCurrent = useMemo(() =>
    VEHICLES.reduce((s, v) => s + (BASELINE[v] / 100) * AVG_CO2E[v] * ANNUAL_SHIPMENTS, 0),
  [])

  const annualCo2eScenario = useMemo(() =>
    VEHICLES.reduce((s, v) => s + (mix[v] / 100) * AVG_CO2E[v] * ANNUAL_SHIPMENTS, 0),
  [mix])

  const annualCostBase = useMemo(() =>
    VEHICLES.reduce((s, v) => s + (BASELINE[v] / 100) * FUEL_COST[v] * ANNUAL_SHIPMENTS, 0),
  [])

  const annualCostScenario = useMemo(() =>
    VEHICLES.reduce((s, v) => s + (mix[v] / 100) * FUEL_COST[v] * ANNUAL_SHIPMENTS, 0),
  [mix])

  // Absolute scenario values (always reflect current slider mix)
  const scenarioTonnes = annualCo2eScenario / 1000
  const offsetValueAbsolute = (annualCo2eScenario / 1000) * offsetPrice
  const treesAbsolute = Math.round(annualCo2eScenario / 21)

  const radialData = useMemo(() =>
    VEHICLES.map((v) => ({
      name: VEHICLE_LABELS[v],
      value: mix[v],
      fill: VEHICLE_COLORS[v],
    })),
  [mix])

  return (
    <div className="flex h-full gap-6 p-6">
      {/* LEFT: Controls */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div>
          <h2 className="text-white font-semibold">Fleet Mix Optimiser</h2>
          <p className="text-white/40 text-xs mt-0.5">Adjust vehicle percentages to see carbon impact</p>
        </div>

        {/* Sum validation banner */}
        {!isValid && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="text-red-400 text-xs">Must total 100% (currently {total.toFixed(1)}%)</span>
            <button
              onClick={autoCorrect}
              className="ml-auto flex items-center gap-1 text-[10px] bg-red-500/20 hover:bg-red-500/30 px-2 py-1 rounded text-red-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Fix
            </button>
          </div>
        )}

        {/* Vehicle sliders */}
        <div className="space-y-3 bg-white/3 rounded-xl p-4 border border-white/8">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Vehicle Mix (%)</p>
          {VEHICLES.map((vt) => (
            <div key={vt}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60">{VEHICLE_LABELS[vt]}</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${VEHICLE_COLORS[vt]}20`, color: VEHICLE_COLORS[vt] }}
                >
                  {mix[vt].toFixed(0)}%
                </span>
              </div>
              <SliderField
                label=""
                value={mix[vt]}
                min={0} max={100} step={1}
                onChange={(v) => setVehicle(vt, v)}
                formatVal={() => ''}
                compact
              />
            </div>
          ))}
          <div className={cn(
            'flex justify-between text-xs pt-2 border-t border-white/8',
            isValid ? 'text-emerald-400' : 'text-red-400',
          )}>
            <span>Total</span>
            <span className="font-bold">{total.toFixed(1)}%</span>
          </div>
        </div>

        {/* Offset price */}
        <div className="bg-white/3 rounded-xl p-4 border border-white/8">
          <SliderField
            label="Carbon Offset Price (₹/tonne)"
            value={offsetPrice}
            min={500} max={5000} step={50}
            onChange={setOffsetPrice}
            formatVal={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
        </div>
      </div>

      {/* RIGHT: Results */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Annual Fleet CO₂e"
            value={`${scenarioTonnes.toLocaleString('en-IN', { maximumFractionDigits: 0 })} t`}
            sub={`${annualCo2eScenario.toLocaleString('en-IN')} kg · per year`}
          />
          <StatCard
            label="Annual Fuel Cost"
            value={formatCurrency(annualCostScenario)}
            sub={`across ${ANNUAL_SHIPMENTS.toLocaleString('en-IN')} annual shipments`}
          />
          <StatCard
            label="Carbon Offset Value"
            value={formatCurrency(offsetValueAbsolute)}
            sub={`at ₹${offsetPrice}/tonne`}
          />
          <StatCard
            label="Equivalent Trees"
            value={treesAbsolute.toLocaleString('en-IN')}
            sub="trees needed to offset scenario emissions"
            tooltip="Each mature tree absorbs approximately 21 kg of CO₂ per year (IPCC / UN Environment Programme estimate). This figure accounts for average canopy cover and growth rate across tropical and subtropical species."
          />
        </div>

        {/* Radial bar chart */}
        <div className="flex-1 bg-white/3 rounded-xl border border-white/8 p-4 min-h-0">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Scenario Mix</p>
          <ResponsiveContainer width="100%" height={240}>
            <RadialBarChart
              innerRadius="20%"
              outerRadius="90%"
              data={radialData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend
                iconSize={8}
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(1)}%`]}
                contentStyle={{ backgroundColor: '#141720', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
