/**
 * AnomalyCalendar — GitHub-style D3 contribution calendar for anomaly weeks.
 * 2023–2027, scrollable horizontal layout.
 *
 * Tooltip is portalled to document.body so it escapes framer-motion's
 * CSS transform containers (which break position:fixed).
 */
import { useRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { useAnomalies } from '@/hooks/useAnalytics'
import { Loader2 } from 'lucide-react'
import type { AnomalyWeek } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL = 12    // cell size px
const GAP  = 2     // gap between cells
const STEP = CELL + GAP

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfYear(year: number) {
  return new Date(year, 0, 1)
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Monday-aligned week number within year (0-indexed)
function weekOfYear(d: Date) {
  const jan1 = startOfYear(d.getFullYear())
  const dayOfWeek = (jan1.getDay() + 6) % 7 // 0=Mon
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000)
  return Math.floor((dayOfYear + dayOfWeek) / 7)
}

function dayOfWeek(d: Date) {
  return (d.getDay() + 6) % 7 // 0=Mon, 6=Sun
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  week: AnomalyWeek
}

function CalTooltip({ tip }: { tip: TooltipData }) {
  const vehicleLabel = (vt: string) => vt.replace('road_', '').replace(/_/g, ' ')

  // Clamp tooltip so it doesn't overflow the viewport edges
  const tooltipW = 200
  const tooltipH = 120
  const left = Math.min(tip.x + 12, window.innerWidth - tooltipW - 16)
  const top = Math.min(Math.max(tip.y - 8, 8), window.innerHeight - tooltipH - 16)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[9999] pointer-events-none"
      style={{ left, top }}
    >
      <div className="bg-[#141720]/95 border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl text-xs min-w-[180px]">
        <p className="text-white/70 font-semibold">{tip.week.date}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
          <span className="text-white/40">Anomaly lanes</span>
          <span className="text-white/80">{tip.week.lane_count}</span>
          <span className="text-white/40">Total CO₂e</span>
          <span className="text-white/80">{(tip.week.total_co2e / 1000).toFixed(1)} t</span>
        </div>
        {tip.week.vehicle_types?.slice(0, 2).map((vt) => (
          <span
            key={vt}
            className="inline-block mt-2 mr-1 text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full"
          >
            {vehicleLabel(vt)}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnomalyCalendar() {
  const { data, isLoading, isError } = useAnomalies()
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  // Build day → week map: each anomaly entry is keyed to a Monday (week start).
  // Expand so that every day within that week maps to the same entry, ensuring
  // all 7 cells in an anomaly week are coloured (not just the Monday cell).
  const anomalyMap = useMemo(() => {
    if (!data) return new Map<string, AnomalyWeek>()
    const map = new Map<string, AnomalyWeek>()
    data.forEach((w) => {
      const monday = new Date(w.date + 'T00:00:00')
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday)
        day.setDate(monday.getDate() + i)
        map.set(isoDate(day), w)
      }
    })
    return map
  }, [data])

  const maxCount = useMemo(() => {
    if (!data?.length) return 1
    return Math.max(...data.map((w) => w.lane_count), 1)
  }, [data])

  // Color scale: white → orange → red
  const colorScale = useMemo(() =>
    d3.scaleSequential([0, maxCount], d3.interpolateOranges),
  [maxCount])

  // ── Use refs for the D3 callback data so closures always see current values ──
  const anomalyMapRef = useRef(anomalyMap)
  anomalyMapRef.current = anomalyMap

  const colorScaleRef = useRef(colorScale)
  colorScaleRef.current = colorScale

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !data) return

    d3.select(svg).selectAll('*').remove()

    const YEARS = [2023, 2024, 2025, 2026, 2027]
    const YEAR_PAD_LEFT = 36   // for day-of-week labels
    const YEAR_PAD_TOP = 28    // for month labels
    const YEAR_SPACING = 20    // horizontal gap between years

    // Compute width of one year block (53 weeks max)
    const maxWeeks = 54
    const yearW = maxWeeks * STEP + YEAR_PAD_LEFT + YEAR_SPACING

    const totalW = YEARS.length * yearW
    const totalH = YEAR_PAD_TOP + 7 * STEP + 24 // 24 for year label at bottom

    svg.setAttribute('width', String(totalW))
    svg.setAttribute('height', String(totalH))

    const g = d3.select(svg).append('g')

    YEARS.forEach((year, yi) => {
      const xBase = yi * yearW + YEAR_PAD_LEFT

      const yearGroup = g.append('g').attr('transform', `translate(${xBase}, ${YEAR_PAD_TOP})`)

      // Year label
      yearGroup.append('text')
        .attr('x', maxWeeks * STEP / 2)
        .attr('y', 7 * STEP + 16)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.3)')
        .attr('font-size', 11)
        .text(year)

      // Day-of-week labels
      DAY_LABELS.forEach((label, di) => {
        if (!label) return
        yearGroup.append('text')
          .attr('x', -4)
          .attr('y', di * STEP + CELL * 0.85)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(255,255,255,0.25)')
          .attr('font-size', 9)
          .text(label)
      })

      // Month labels
      let currentMonth = -1
      const jan1 = startOfYear(year)

      // Iterate all days in year
      const endDate = new Date(year, 11, 31)
      let cursor = new Date(jan1)
      const cellsData: { date: string; week: number; day: number; d: Date }[] = []

      while (cursor <= endDate) {
        cellsData.push({
          date: isoDate(cursor),
          week: weekOfYear(cursor),
          day: dayOfWeek(cursor),
          d: new Date(cursor),
        })
        cursor.setDate(cursor.getDate() + 1)
      }

      // Month labels
      cellsData.forEach(({ d, week }) => {
        const m = d.getMonth()
        if (m !== currentMonth) {
          currentMonth = m
          yearGroup.append('text')
            .attr('x', week * STEP)
            .attr('y', -8)
            .attr('fill', 'rgba(255,255,255,0.3)')
            .attr('font-size', 9)
            .text(MONTH_NAMES[m])
        }
      })

      // Cells — use refs for data lookups to avoid stale closures
      yearGroup.selectAll('rect.cell')
        .data(cellsData)
        .join('rect')
        .attr('class', 'cell')
        .attr('x', (d) => d.week * STEP)
        .attr('y', (d) => d.day * STEP)
        .attr('width', CELL)
        .attr('height', CELL)
        .attr('rx', 2)
        .attr('fill', (d) => {
          const week = anomalyMapRef.current.get(d.date)
          if (!week) return 'rgba(255,255,255,0.04)'
          return colorScaleRef.current(week.lane_count)
        })
        .attr('opacity', 0.9)
        .style('cursor', (d) => anomalyMapRef.current.has(d.date) ? 'pointer' : 'default')
        .on('mouseenter', function (event: MouseEvent, d) {
          const week = anomalyMapRef.current.get(d.date)
          if (!week) return
          d3.select(this).attr('opacity', 1).attr('stroke', 'white').attr('stroke-width', 1)
          setTooltip({ x: event.clientX, y: event.clientY, week })
        })
        .on('mousemove', function (event: MouseEvent) {
          setTooltip((prev) => prev ? { ...prev, x: event.clientX, y: event.clientY } : prev)
        })
        .on('mouseleave', function () {
          d3.select(this).attr('opacity', 0.9).attr('stroke', 'none')
          setTooltip(null)
        })
    })

    // Colour legend
    const legendG = g.append('g').attr('transform', `translate(${totalW - 180}, ${totalH - 16})`)
    legendG.append('text')
      .attr('x', 0).attr('y', 0)
      .attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)
      .text('Less')
    const steps = 10
    for (let i = 0; i <= steps; i++) {
      legendG.append('rect')
        .attr('x', 28 + i * (CELL + 1))
        .attr('y', -CELL + 1)
        .attr('width', CELL).attr('height', CELL).attr('rx', 2)
        .attr('fill', colorScale((i / steps) * maxCount))
    }
    legendG.append('text')
      .attr('x', 28 + (steps + 1) * (CELL + 1) + 4).attr('y', 0)
      .attr('fill', 'rgba(255,255,255,0.3)').attr('font-size', 9)
      .text('More')

  }, [data, anomalyMap, colorScale, maxCount])

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-white/40 gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-xs">Loading anomaly calendar…</span>
    </div>
  )

  if (isError) return (
    <div className="flex items-center justify-center h-full text-red-400/60 text-xs">
      Failed to load anomaly data
    </div>
  )

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <div>
          <h3 className="text-white text-sm font-semibold">Anomaly Calendar</h3>
          <p className="text-white/40 text-xs">Weeks with elevated emissions — hover to inspect</p>
        </div>
        {data && (
          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-1 rounded-full">
            {data.length} anomaly weeks
          </span>
        )}
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6">
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>

      {/* Portal tooltip to document.body to escape framer-motion transform containers
          that break position:fixed rendering */}
      {createPortal(
        <AnimatePresence>
          {tooltip && <CalTooltip key="cal-tip" tip={tooltip} />}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
