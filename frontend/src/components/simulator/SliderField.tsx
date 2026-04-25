/**
 * SliderField — reusable parameter slider with label, live value, optional normal-value tick,
 * and an optional hover tooltip showing simple + technical descriptions.
 */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TooltipContent {
  simple: string
  technical: string
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formatVal?: (v: number) => string
  normalValue?: number
  warnWhen?: 'high' | 'low'
  warnThreshold?: number
  compact?: boolean
  tooltip?: TooltipContent
}

// ─── Floating Tooltip Portal ────────────────────────────────────────────────

function FloatingTooltip({
  content,
  anchorRef,
}: {
  content: TooltipContent
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'left' as 'left' | 'right' })

  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const tooltipWidth = 240
    const spaceRight = window.innerWidth - rect.right
    const spaceLeft = rect.left

    let placement: 'left' | 'right' = 'left'
    let left = rect.left - tooltipWidth - 10
    if (spaceLeft < tooltipWidth + 10 && spaceRight > tooltipWidth + 10) {
      placement = 'right'
      left = rect.right + 10
    }

    setPos({
      top: rect.top + rect.height / 2,
      left,
      placement,
    })
  }, [anchorRef])

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
    >
      <div
        className="w-60 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(15,17,26,0.97)', backdropFilter: 'blur(16px)' }}
      >
        {/* Header accent */}
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent" />
        <div className="p-3 space-y-2.5">
          {/* Simple */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-emerald-400/70 mb-1">
              Simple
            </p>
            <p className="text-[11px] text-white/80 leading-relaxed">{content.simple}</p>
          </div>
          {/* Divider */}
          <div className="h-px bg-white/6" />
          {/* Technical */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-sky-400/70 mb-1">
              Technical
            </p>
            <p className="text-[11px] text-white/55 leading-relaxed font-mono">{content.technical}</p>
          </div>
        </div>
      </div>
      {/* Arrow */}
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={
          pos.placement === 'left'
            ? { right: -6, borderLeft: '6px solid rgba(255,255,255,0.08)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }
            : { left: -6, borderRight: '6px solid rgba(255,255,255,0.08)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }
        }
      />
    </div>,
    document.body,
  )
}

// ─── SliderField ─────────────────────────────────────────────────────────────

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatVal,
  normalValue,
  warnWhen,
  warnThreshold,
  compact = false,
  tooltip,
}: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100
  const normalPct = normalValue != null ? ((normalValue - min) / (max - min)) * 100 : null

  const isWarning =
    warnWhen === 'high' && warnThreshold != null
      ? value > warnThreshold
      : warnWhen === 'low' && warnThreshold != null
        ? value < warnThreshold
        : false

  const trackColor = isWarning ? '#f59e0b' : '#10b981'
  const displayed = formatVal ? formatVal(value) : value.toFixed(2)

  const [showTip, setShowTip] = useState(false)
  const iconRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={cn('group', compact ? 'py-1' : 'py-1.5')}>
      {/* Label + value */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-white/50 select-none">{label}</span>
          {tooltip && (
            <button
              ref={iconRef}
              className="relative flex items-center justify-center w-3.5 h-3.5 rounded-full text-white/20 hover:text-emerald-400 transition-colors focus:outline-none"
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              tabIndex={-1}
              aria-label={`Info about ${label}`}
            >
              <Info className="w-3 h-3" />
              {showTip && <FloatingTooltip content={tooltip} anchorRef={iconRef} />}
            </button>
          )}
        </div>
        <span
          className={cn(
            'text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded',
            isWarning
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-white/5 text-white/80',
          )}
        >
          {displayed}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-1.5 bg-white/8 rounded-full">
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, backgroundColor: trackColor }}
        />

        {/* Normal-value tick mark */}
        {normalPct != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/25 rounded-full"
            style={{ left: `${normalPct}%` }}
            title={`Normal: ${normalValue}`}
          />
        )}

        {/* Invisible range input overlay */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all duration-75 pointer-events-none shadow-md"
          style={{
            left: `calc(${pct}% - 6px)`,
            backgroundColor: trackColor,
            borderColor: '#0a0d14',
            boxShadow: `0 0 6px ${trackColor}60`,
          }}
        />
      </div>
    </div>
  )
}
