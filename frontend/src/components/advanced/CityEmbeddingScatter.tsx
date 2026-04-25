/**
 * CityEmbeddingScatter — UMAP scatter of 29 Indian cities coloured by avg CO₂e.
 * Click city → highlight map lanes through that city.
 */
import { useMemo } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { Loader2 } from 'lucide-react'
import { useCityEmbeddings } from '@/hooks/useAnalytics'
import { useLanes } from '@/hooks/useLanes'
import { useAppStore } from '@/store'
import { getEmissionColor, formatCO2e } from '@/lib/utils'
import type { UMAPPoint } from '@/types'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CityTooltip({ active, payload }: { active?: boolean; payload?: { payload: UMAPPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#141720]/95 border border-white/10 rounded-xl px-3 py-2.5 text-xs shadow-xl">
      <p className="text-white font-semibold">{d.city}</p>
      <p className="text-white/50 mt-1">Avg CO₂e: <span className="text-white/80">{formatCO2e(d.avg_co2e_kg)}</span></p>
      <p className="text-white/50">Shipments: <span className="text-white/80">{d.total_shipments?.toLocaleString('en-IN')}</span></p>
    </div>
  )
}

// ─── Custom Dot with label ────────────────────────────────────────────────────

function CityDot(props: { cx?: number; cy?: number; payload?: UMAPPoint; onClick: (city: UMAPPoint) => void }) {
  const { cx = 0, cy = 0, payload, onClick } = props
  if (!payload) return null
  const color = getEmissionColor(payload.avg_co2e_kg)
  const r = Math.max(5, Math.min(18, Math.sqrt(payload.total_shipments ?? 100) / 3))
  return (
    <g cursor="pointer" onClick={() => onClick(payload)}>
      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1.5} />
      <text
        x={cx}
        y={cy - r - 3}
        textAnchor="middle"
        fontSize={9}
        fill="rgba(255,255,255,0.65)"
        style={{ pointerEvents: 'none', textShadow: '0 1px 4px #000' }}
      >
        {payload.city}
      </text>
    </g>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CityEmbeddingScatter() {
  const { data, isLoading, isError } = useCityEmbeddings()
  const { data: lanes } = useLanes()
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setHighlightedLaneIds = useAppStore((s) => s.setHighlightedLaneIds)
  const setHighlightedCity = useAppStore((s) => s.setHighlightedCity)

  // City → lane map
  const cityLaneMap = useMemo(() => {
    if (!lanes) return new Map<string, string[]>()
    const m = new Map<string, string[]>()
    for (const lane of lanes) {
      for (const city of [lane.origin, lane.destination]) {
        if (!m.has(city)) m.set(city, [])
        m.get(city)!.push(lane.lane_id)
      }
    }
    return m
  }, [lanes])

  function handleCityClick(city: UMAPPoint) {
    const laneIds = cityLaneMap.get(city.city) ?? []
    setHighlightedLaneIds(laneIds)
    setHighlightedCity(city.city)
    setActiveTab('map')
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-white/40 gap-2">
      <Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">Loading embeddings…</span>
    </div>
  )

  if (isError || !data?.length) return (
    <div className="flex items-center justify-center h-full text-white/30 text-xs">
      City embedding data unavailable
    </div>
  )

  return (
    <div className="flex flex-col h-full gap-3">
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <XAxis dataKey="x" type="number" tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
          <YAxis dataKey="y" type="number" tick={false} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
          <Tooltip content={<CityTooltip />} />
          <Scatter
            data={data}
            shape={(props: { cx?: number; cy?: number; payload?: UMAPPoint }) => (
              <CityDot {...props} onClick={handleCityClick} />
            )}
          >
            {data.map((d) => (
              <Cell key={d.city} fill={getEmissionColor(d.avg_co2e_kg)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-white/25 text-[11px] px-2 text-center">
        Cities positioned by freight network similarity (GraphSAGE embeddings → UMAP).
        Cities close together share similar emission patterns and route characteristics.
        <span className="text-white/40"> Click any city to highlight its lanes on the map.</span>
      </p>
    </div>
  )
}
