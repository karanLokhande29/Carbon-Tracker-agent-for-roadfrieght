/**
 * Floating tooltip that follows the cursor when a lane is hovered.
 * Uses Framer Motion for smooth entrance animation.
 */
import { motion } from 'framer-motion'
import { formatCO2e, getReliabilityColor, cn } from '@/lib/utils'
import type { LaneSummary } from '@/types'

interface LaneTooltipProps {
  lane: LaneSummary
  mouseX: number
  mouseY: number
}

export function LaneTooltip({ lane, mouseX, mouseY }: LaneTooltipProps) {
  // Keep tooltip within viewport
  const tooltipW = 280
  const tooltipH = 150
  const x = Math.min(mouseX + 16, window.innerWidth - tooltipW - 16)
  const y = Math.min(Math.max(mouseY - 8, 8), window.innerHeight - tooltipH - 16)

  const relColor = getReliabilityColor(lane.reliability)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      className="fixed z-[100] pointer-events-none"
      style={{ left: x, top: y }}
    >
      <div className="bg-[#141720]/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 min-w-[240px]">
        {/* Route name */}
        <p className="text-white text-sm font-semibold leading-tight">
          {lane.origin} → {lane.destination}
        </p>

        {/* Distance + reliability */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-white/50 text-xs">
            {lane.distance_km.toLocaleString('en-IN')} km
          </span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
            style={{
              backgroundColor: `${relColor}18`,
              color: relColor,
              border: `1px solid ${relColor}30`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: relColor }}
            />
            {lane.reliability}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs">
          <div>
            <span className="text-white/40">Avg CO₂e</span>
            <p className="text-white/90 font-medium">{formatCO2e(lane.avg_co2e_kg)}</p>
          </div>
          <div>
            <span className="text-white/40">Shipments</span>
            <p className="text-white/90 font-medium">
              {lane.shipment_count.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* CTA hint */}
        <p className="text-emerald-400/60 text-[10px] mt-2.5 tracking-wide">
          Click to simulate →
        </p>
      </div>
    </motion.div>
  )
}
