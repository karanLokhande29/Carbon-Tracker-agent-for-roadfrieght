/**
 * IndiaLaneMap — D3 + SVG interactive freight lane visualization.
 *
 * Renders India state boundaries from TopoJSON, 140 freight lane arcs
 * with emission-based colouring, animated flow dots, city nodes, and
 * reliability midpoint indicators.  Full D3-zoom pan/zoom support.
 *
 * NOTE: We use pure D3 geo rendering instead of react-simple-maps
 * because the latter does not yet support React 19.
 */
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as d3 from 'd3'
import { useQuery } from '@tanstack/react-query'
import * as topojson from 'topojson-client'
import { AnimatePresence } from 'framer-motion'

import { useProjection } from './useProjection'
import { LaneTooltip } from './LaneTooltip'
import { getEmissionColor, getReliabilityColor } from '@/lib/utils'
import type { LaneSummary } from '@/types'
import { Loader2, X, MapPin } from 'lucide-react'
import { useAppStore } from '@/store'

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIA_TOPO_URL =
  'https://raw.githubusercontent.com/udit-001/india-maps-data/main/topojson/india.json'

const MAJOR_CITIES = new Set([
  'Delhi',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Hyderabad',
  'Ahmedabad',
  'Pune',
  'Jaipur',
  'Lucknow',
  'Kanpur',
  'Nagpur',
  'Coimbatore',
])

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndiaLaneMapProps {
  lanes: LaneSummary[]
  selectedLaneId: string | null
  highlightedLaneIds: string[]
  highlightedCity: string | null
  onLaneSelect: (laneId: string) => void
}

interface ArcDatum extends LaneSummary {
  pathD: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
  color: string
  strokeW: number
}

interface CityNode {
  name: string
  x: number
  y: number
  totalShipments: number
  totalCo2e: number
  laneCount: number
  lat: number
  lon: number
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Fetch and cache India TopoJSON → GeoJSON features */
function useIndiaGeo() {
  return useQuery({
    queryKey: ['india-topo'],
    queryFn: async () => {
      const res = await fetch(INDIA_TOPO_URL)
      const topo = await res.json()
      const objectKey = Object.keys(topo.objects)[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fc = topojson.feature(topo as any, topo.objects[objectKey] as any) as any
      return fc.features as GeoJSON.Feature[]
    },
    staleTime: Infinity,
    retry: 2,
  })
}

/** ResizeObserver-backed container dimensions */
function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

// ─── Component ────────────────────────────────────────────────────────────────

export const IndiaLaneMap = memo(function IndiaLaneMap({
  lanes,
  selectedLaneId,
  highlightedLaneIds,
  highlightedCity,
  onLaneSelect,
}: IndiaLaneMapProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Dimensions & projection
  const { width, height } = useContainerSize(containerRef)
  const { project, pathGen } = useProjection(width, height)

  // India geo data
  const { data: indiaFeatures, isLoading: geoLoading } = useIndiaGeo()

  // Zoom state  (transform object stored in state for reactivity)
  const [transform, setTransform] = useState(d3.zoomIdentity)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Hover state (local — not in global store, changes every mouse move)
  const [hoveredLaneId, setHoveredLaneId] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // ── Shipment extent (for scales) ────────────────────────────────────────
  const shipmentExtent = useMemo(() => {
    if (!lanes.length) return [0, 1] as [number, number]
    return d3.extent(lanes, (l) => l.shipment_count) as [number, number]
  }, [lanes])

  // ── Arc computations ──────────────────────────────────────────────────────
  const arcData: ArcDatum[] = useMemo(() => {
    if (!lanes.length || width === 0) return []

    const wScale = d3
      .scaleLinear()
      .domain(shipmentExtent)
      .range([0.8, 3.5])
      .clamp(true)

    return lanes.map((lane) => {
      const [x1, y1] = project(lane.origin_lon, lane.origin_lat)
      const [x2, y2] = project(lane.dest_lon, lane.dest_lat)

      const dx = x2 - x1
      const dy = y2 - y1
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Perpendicular curvature — keep arcs close to landmass
      const curvature = Math.min(lane.distance_km / 100, dist * 0.15, 40)
      const nx = dist > 0 ? -dy / dist : 0
      const ny = dist > 0 ? dx / dist : 0

      const mx = (x1 + x2) / 2 + nx * curvature
      const my = (y1 + y2) / 2 + ny * curvature

      const pathD = `M ${x1},${y1} Q ${mx},${my} ${x2},${y2}`

      return {
        ...lane,
        pathD,
        x1,
        y1,
        x2,
        y2,
        mx,
        my,
        color: getEmissionColor(lane.avg_co2e_kg),
        strokeW: wScale(lane.shipment_count),
      }
    })
  }, [lanes, project, width, shipmentExtent])

  // ── City nodes ────────────────────────────────────────────────────────────
  const cityNodes: CityNode[] = useMemo(() => {
    if (!lanes.length || width === 0) return []

    const map = new Map<string, CityNode>()

    for (const lane of lanes) {
      // Origin
      if (!map.has(lane.origin)) {
        const [x, y] = project(lane.origin_lon, lane.origin_lat)
        map.set(lane.origin, {
          name: lane.origin,
          x,
          y,
          totalShipments: 0,
          totalCo2e: 0,
          laneCount: 0,
          lat: lane.origin_lat,
          lon: lane.origin_lon,
        })
      }
      const o = map.get(lane.origin)!
      o.totalShipments += lane.shipment_count
      o.totalCo2e += lane.avg_co2e_kg * lane.shipment_count
      o.laneCount += 1

      // Destination
      if (!map.has(lane.destination)) {
        const [x, y] = project(lane.dest_lon, lane.dest_lat)
        map.set(lane.destination, {
          name: lane.destination,
          x,
          y,
          totalShipments: 0,
          totalCo2e: 0,
          laneCount: 0,
          lat: lane.dest_lat,
          lon: lane.dest_lon,
        })
      }
      const d = map.get(lane.destination)!
      d.totalShipments += lane.shipment_count
      d.totalCo2e += lane.avg_co2e_kg * lane.shipment_count
      d.laneCount += 1
    }

    return Array.from(map.values())
  }, [lanes, project, width])

  // City radius scale
  const cityRadiusScale = useMemo(() => {
    if (!cityNodes.length) return (_: number) => 5
    const ext = d3.extent(cityNodes, (c) => c.totalShipments) as [number, number]
    return d3.scaleSqrt().domain(ext).range([4, 15]).clamp(true)
  }, [cityNodes])

  // Flow dot duration scale (high shipments → faster → shorter duration)
  const dotDurScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain(shipmentExtent)
      .range([8, 3])
      .clamp(true)
  }, [shipmentExtent])

  // ── D3 zoom behaviour ──────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || width === 0) return

    const svg = d3.select(svgRef.current)

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 5])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        setTransform(event.transform)
      })

    svg.call(zoom)
    zoomRef.current = zoom

    // Double-click resets
    svg.on('dblclick.zoom', null)
    svg.on('dblclick', () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity)
    })

    return () => {
      svg.on('.zoom', null)
      svg.on('dblclick', null)
    }
  }, [width, height])

  // ── Event handlers ─────────────────────────────────────────────────────
  const handleLaneMouseEnter = useCallback((laneId: string) => {
    setHoveredLaneId(laneId)
  }, [])

  const handleLaneMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleLaneMouseLeave = useCallback(() => {
    setHoveredLaneId(null)
  }, [])

  const handleLaneClick = useCallback(
    (laneId: string) => {
      onLaneSelect(laneId)
    },
    [onLaneSelect],
  )

  const handleCityClick = useCallback(
    (cityName: string) => {
      // Highlight all lanes involving this city
      const ids = lanes
        .filter((l) => l.origin === cityName || l.destination === cityName)
        .map((l) => l.lane_id)
      // Select first lane as primary
      if (ids.length) onLaneSelect(ids[0])
    },
    [lanes, onLaneSelect],
  )

  // ── Hovered lane data ──────────────────────────────────────────────────
  const hoveredLane = useMemo(
    () => (hoveredLaneId ? lanes.find((l) => l.lane_id === hoveredLaneId) : null),
    [hoveredLaneId, lanes],
  )

  // ── Label visibility ──────────────────────────────────────────────────
  const showAllLabels = transform.k >= 1.5

  // ── Loading state ──────────────────────────────────────────────────────
  if (width === 0 || height === 0) {
    return <div ref={containerRef} className="w-full h-full" />
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-grab active:cursor-grabbing"
      >
        {/* ── Defs: filters & gradients ─────────────────────────────── */}
        <defs>
          {/* Glow filter for highlighted lanes */}
          <filter id="lane-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Glow filter for highlighted city node */}
          <filter id="city-highlight-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Subtle radial gradient for city nodes */}
          <radialGradient id="city-glow">
            <stop offset="0%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Transformed group (zoom + pan) ──────────────────────── */}
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>

          {/* LAYER 1: India state boundaries */}
          {indiaFeatures?.map((feature, i) => (
            <path
              key={i}
              d={pathGen(feature) ?? ''}
              fill="#1a2235"
              stroke="#2a3550"
              strokeWidth={0.8}
              className="pointer-events-none"
            />
          ))}

          {geoLoading && (
            <text x={width / 2} y={height / 2} textAnchor="middle" fill="#ffffff40" fontSize={12}>
              Loading map…
            </text>
          )}

          {/* LAYER 2: Lane arc hit-areas (invisible, wide for easy hovering) */}
          {arcData.map((arc) => (
            <path
              key={`hit-${arc.lane_id}`}
              d={arc.pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(12 / transform.k, 8)}
              style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
              onMouseEnter={() => handleLaneMouseEnter(arc.lane_id)}
              onMouseMove={handleLaneMouseMove}
              onMouseLeave={handleLaneMouseLeave}
              onClick={() => handleLaneClick(arc.lane_id)}
            />
          ))}

          {/* LAYER 3: Lane arcs (visible) */}
          {arcData.map((arc) => {
            const isSelected = selectedLaneId === arc.lane_id
            const isHighlighted = highlightedLaneIds.includes(arc.lane_id)
            const isHovered = hoveredLaneId === arc.lane_id
            const noSelection = !selectedLaneId

            let opacity = 0.55
            if (isSelected) opacity = 1
            else if (isHighlighted) opacity = 0.9
            else if (isHovered) opacity = 0.95
            else if (!noSelection) opacity = 0.12

            let sw = arc.strokeW / Math.sqrt(transform.k)
            if (isHighlighted) sw *= 1.8
            if (isHovered) sw += 0.5

            return (
              <path
                key={arc.lane_id}
                d={arc.pathD}
                fill="none"
                stroke={arc.color}
                strokeWidth={sw}
                opacity={opacity}
                strokeLinecap="round"
                filter={isHighlighted ? 'url(#lane-glow)' : undefined}
                className="pointer-events-none transition-opacity duration-200"
              />
            )
          })}

          {/* LAYER 4: Animated flow dots (ambient mode only) */}
          {!selectedLaneId &&
            arcData.map((arc) => {
              const dur = dotDurScale(arc.shipment_count)
              return (
                <g key={`dots-${arc.lane_id}`} className="pointer-events-none">
                  {[0, 1, 2].map((i) => (
                    <circle key={i} r={2.5 / transform.k} fill="white" opacity="0.6">
                      <animateMotion
                        dur={`${dur}s`}
                        repeatCount="indefinite"
                        path={arc.pathD}
                        begin={`-${(dur * i) / 3}s`}
                      />
                    </circle>
                  ))}
                </g>
              )
            })}

          {/* LAYER 5: Reliability midpoint dots (only for selected/hovered lane) */}
          {arcData.map((arc) => {
            const show =
              selectedLaneId === arc.lane_id ||
              hoveredLaneId === arc.lane_id ||
              highlightedLaneIds.includes(arc.lane_id)
            if (!show) return null

            return (
              <circle
                key={`rel-${arc.lane_id}`}
                cx={arc.mx}
                cy={arc.my}
                r={4 / transform.k}
                fill={getReliabilityColor(arc.reliability)}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1 / transform.k}
                opacity={0.9}
                className="pointer-events-none"
              />
            )
          })}

          {/* LAYER 6: City glow halos */}
          {cityNodes.map((city) => {
            const isHighlightedCity = highlightedCity === city.name
            return (
              <circle
                key={`glow-${city.name}`}
                cx={city.x}
                cy={city.y}
                r={cityRadiusScale(city.totalShipments) * (isHighlightedCity ? 5 : 2.5)}
                fill="url(#city-glow)"
                opacity={isHighlightedCity ? 1 : (highlightedCity ? 0.3 : 1)}
                className="pointer-events-none"
              />
            )
          })}

          {/* LAYER 7: City nodes */}
          {cityNodes.map((city) => {
            const avgCo2e =
              city.totalShipments > 0
                ? city.totalCo2e / city.totalShipments
                : 2000
            const r = cityRadiusScale(city.totalShipments)
            const isHighlightedCity = highlightedCity === city.name
            const isDimmed = !!highlightedCity && !isHighlightedCity
            const nodeColor = getEmissionColor(avgCo2e)
            const scaledR = r / Math.sqrt(transform.k)
            return (
              <g key={`city-${city.name}`}>
                {/* Pulsing ring — only for the highlighted city */}
                {isHighlightedCity && (
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={scaledR * 2.2}
                    fill="none"
                    stroke="white"
                    strokeWidth={2 / transform.k}
                    opacity={0}
                    className="pointer-events-none"
                  >
                    <animate attributeName="r" values={`${scaledR * 1.4};${scaledR * 3.2};${scaledR * 1.4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* City node circle */}
                <circle
                  cx={city.x}
                  cy={city.y}
                  r={scaledR * (isHighlightedCity ? 1.5 : 1)}
                  fill={nodeColor}
                  stroke={isHighlightedCity ? 'white' : 'rgba(255,255,255,0.8)'}
                  strokeWidth={(isHighlightedCity ? 3 : 1.5) / transform.k}
                  opacity={isDimmed ? 0.25 : 1}
                  filter={isHighlightedCity ? 'url(#city-highlight-glow)' : undefined}
                  className="cursor-pointer transition-all duration-150 hover:brightness-125"
                  onClick={() => handleCityClick(city.name)}
                />
              </g>
            )
          })}

          {/* LAYER 8: City labels */}
          {cityNodes.map((city) => {
            const isMajor = MAJOR_CITIES.has(city.name)
            if (!isMajor && !showAllLabels) return null

            const r = cityRadiusScale(city.totalShipments)
            return (
              <text
                key={`label-${city.name}`}
                x={city.x}
                y={city.y - (r + 6) / transform.k}
                textAnchor="middle"
                fill="rgba(255,255,255,0.75)"
                fontSize={isMajor ? 11 / transform.k : 9 / transform.k}
                fontWeight={isMajor ? 600 : 400}
                fontFamily="Inter, system-ui, sans-serif"
                className="pointer-events-none select-none"
                style={{
                  textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                }}
              >
                {city.name}
              </text>
            )
          })}
        </g>
      </svg>

      {/* ── City focus banner (shown when coming from City Embeddings) ── */}
      {highlightedCity && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1a2235]/90 backdrop-blur-sm border border-white/15 rounded-full px-3.5 py-1.5 shadow-xl z-10">
          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
          <span className="text-white text-xs font-semibold">{highlightedCity}</span>
          <span className="text-white/40 text-[10px]">
            {highlightedLaneIds.length} connected lane{highlightedLaneIds.length !== 1 ? 's' : ''} highlighted
          </span>
          <button
            onClick={() => {
              useAppStore.getState().setHighlightedCity(null)
              useAppStore.getState().setHighlightedLaneIds([])
            }}
            className="ml-1 text-white/40 hover:text-white/80 transition-colors"
            aria-label="Clear city highlight"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Zoom indicator (bottom-left) ─────────────────────────── */}
      {transform.k !== 1 && (
        <div className="absolute bottom-4 left-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white/50 select-none">
          {(transform.k * 100).toFixed(0)}%
        </div>
      )}

      {/* ── Lane tooltip ──────────────────────────────────────────── */}
      <AnimatePresence>
        {hoveredLane && (
          <LaneTooltip
            key="lane-tooltip"
            lane={hoveredLane}
            mouseX={mousePos.x}
            mouseY={mousePos.y}
          />
        )}
      </AnimatePresence>

      {/* ── Loading overlay ───────────────────────────────────────── */}
      {geoLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading India map…
          </div>
        </div>
      )}
    </div>
  )
})
