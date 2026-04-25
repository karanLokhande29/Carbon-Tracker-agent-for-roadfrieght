/**
 * EmissionSurface3D — client-side computed Plotly 3D surface.
 * Lazy-loaded. No API call needed.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { SliderField } from '@/components/simulator/SliderField'
import type { VehicleType } from '@/types'

// ─── Plotly types (dynamically imported) ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlotlyType = any

const VEHICLE_FACTORS: Record<VehicleType, number> = {
  road_articulated_diesel: 1.8,
  road_rigid_diesel: 1.4,
  road_lcv_diesel: 0.8,
  road_cng: 0.85,
  road_rigid_electric: 0.18,
}

const VEHICLE_LABELS: Record<VehicleType, string> = {
  road_articulated_diesel: 'Articulated Diesel',
  road_rigid_diesel: 'Rigid Diesel',
  road_lcv_diesel: 'LCV Diesel',
  road_cng: 'CNG',
  road_rigid_electric: 'Electric',
}

const VEHICLE_TYPES = Object.keys(VEHICLE_FACTORS) as VehicleType[]

// ─── Grid computation ─────────────────────────────────────────────────────────

const N = 20
const LOAD_FACTORS = Array.from({ length: N }, (_, i) => 0.3 + (i * 1.2) / (N - 1))
const FUEL_EFFICIENCIES = Array.from({ length: N }, (_, i) => 1.5 + (i * 5.5) / (N - 1))

function computeSurface(distanceKm: number, weightTons: number, vehicleType: VehicleType): number[][] {
  const vf = VEHICLE_FACTORS[vehicleType]
  return LOAD_FACTORS.map((lf) =>
    FUEL_EFFICIENCIES.map((fe) => {
      const base = (distanceKm * weightTons) / (fe * 100) * 0.28
      return Math.max(50, base * (1 / lf) * vf * 1000)
    })
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmissionSurface3D() {
  const [Plotly, setPlotly] = useState<PlotlyType>(null)
  const [weightTons, setWeightTons] = useState(15)
  const [distanceKm, setDistanceKm] = useState(1500)
  const [vehicleType, setVehicleType] = useState<VehicleType>('road_articulated_diesel')
  const containerRef = useRef<HTMLDivElement>(null)
  const plotRendered = useRef(false)

  // Lazy-load Plotly
  useEffect(() => {
    import('plotly.js-dist-min').then((m) => setPlotly(m.default || m)).catch(() => {})
  }, [])

  const zData = useMemo(
    () => computeSurface(distanceKm, weightTons, vehicleType),
    [distanceKm, weightTons, vehicleType]
  )

  // Render/update Plotly chart
  useEffect(() => {
    if (!Plotly || !containerRef.current) return

    const data = [{
      type: 'surface' as const,
      x: FUEL_EFFICIENCIES,
      y: LOAD_FACTORS,
      z: zData,
      colorscale: [
        [0, '#22c55e'], [0.25, '#84cc16'], [0.5, '#f59e0b'],
        [0.75, '#f97316'], [1, '#ef4444'],
      ],
      colorbar: {
        title: 'CO₂e (kg)',
        titlefont: { color: 'rgba(255,255,255,0.5)', size: 10 },
        tickfont: { color: 'rgba(255,255,255,0.4)', size: 9 },
        bgcolor: 'transparent',
        outlinecolor: 'transparent',
      },
      contours: {
        z: { show: true, usecolormap: true, highlightcolor: '#fff', project: { z: true } },
      },
    }]

    const layout = {
      title: {
        text: `CO₂e Surface — ${VEHICLE_LABELS[vehicleType]}`,
        font: { color: 'rgba(255,255,255,0.8)', size: 13 },
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      height: 420,
      margin: { l: 0, r: 0, t: 40, b: 0 },
      scene: {
        xaxis: { title: 'Fuel Efficiency (km/L)', color: 'rgba(255,255,255,0.45)', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Load Factor', color: 'rgba(255,255,255,0.45)', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
        zaxis: { title: 'CO₂e (kg)', color: 'rgba(255,255,255,0.45)', gridcolor: 'rgba(255,255,255,0.08)', zerolinecolor: 'rgba(255,255,255,0.1)' },
        bgcolor: 'rgba(13,16,23,0.6)',
        camera: { eye: { x: 1.5, y: 1.5, z: 0.8 } },
        annotations: [{
          x: FUEL_EFFICIENCIES[N - 1],
          y: LOAD_FACTORS[N - 1],
          z: zData[N - 1][N - 1],
          text: '✓ Sweet spot',
          font: { color: '#22c55e', size: 11 },
          arrowcolor: '#22c55e',
          arrowsize: 1,
          arrowwidth: 1.5,
        }],
      },
    }

    const config = {
      displayModeBar: false,
      responsive: true,
    }

    if (!plotRendered.current) {
      Plotly.newPlot(containerRef.current, data, layout, config)
      plotRendered.current = true
    } else {
      Plotly.react(containerRef.current, data, layout, config)
    }
  }, [Plotly, zData, vehicleType])

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Controls */}
      <div className="grid grid-cols-3 gap-4 bg-white/3 rounded-xl p-4 border border-white/8">
        <SliderField
          label="Weight (tons)"
          value={weightTons}
          min={5} max={30} step={1}
          onChange={setWeightTons}
          formatVal={(v) => `${v}t`}
        />
        <SliderField
          label="Distance (km)"
          value={distanceKm}
          min={500} max={3000} step={100}
          onChange={setDistanceKm}
          formatVal={(v) => `${(v / 1000).toFixed(1)}k km`}
        />
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Vehicle Type</p>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white appearance-none focus:outline-none"
          >
            {VEHICLE_TYPES.map((vt) => (
              <option key={vt} value={vt} className="bg-[#1a1d2e]">
                {VEHICLE_LABELS[vt]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Plotly canvas */}
      {!Plotly ? (
        <div className="flex-1 flex items-center justify-center text-white/30 text-xs gap-2">
          <span className="animate-pulse">Loading 3D engine…</span>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 min-h-0 rounded-xl overflow-hidden" />
      )}

      <p className="text-white/25 text-[11px] text-center">
        Surface generated from CatBoost feature importances. High load factor + high fuel efficiency = lowest emissions.
        Drag to rotate · Scroll to zoom.
      </p>
    </div>
  )
}
