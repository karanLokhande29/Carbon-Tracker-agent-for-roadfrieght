/**
 * ForecastReliabilityBadge — coloured pill + explanation for forecast quality.
 */
import { cn, getReliabilityColor } from '@/lib/utils'
import type { ReliabilityLevel } from '@/types'

interface ForecastReliabilityBadgeProps {
  reliability: ReliabilityLevel
  mape: number
  className?: string
}

const MESSAGES: Record<ReliabilityLevel, (mape: number) => string> = {
  good: (m) => `Good — MAPE ${m.toFixed(1)}%: forecast bands are tight`,
  medium: (m) => `Medium — MAPE ${m.toFixed(1)}%: use bands, not just midline`,
  low: (m) => `Low — MAPE ${m.toFixed(1)}%: treat as directional only`,
}

export function ForecastReliabilityBadge({ reliability, mape, className }: ForecastReliabilityBadgeProps) {
  const color = getReliabilityColor(reliability)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border"
        style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
      >
        {reliability.toUpperCase()}
      </span>
      <span className="text-xs text-white/40">{MESSAGES[reliability](mape)}</span>
    </div>
  )
}
