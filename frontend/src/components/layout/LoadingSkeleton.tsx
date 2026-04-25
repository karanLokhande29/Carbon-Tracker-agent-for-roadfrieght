/**
 * LoadingSkeleton — reusable pulse skeleton variants for loading states.
 */
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

function Bone({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-white/6', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white/4 rounded-xl p-4 space-y-3 border border-white/8">
      <Bone className="h-3 w-1/3" />
      <Bone className="h-8 w-1/2" />
      <Bone className="h-2 w-2/3" />
      <Bone className="h-1.5 w-full rounded-full" />
    </div>
  )
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-xl overflow-hidden relative bg-white/3"
      style={{ height }}
    >
      {/* Fake bars */}
      <div className="absolute bottom-8 inset-x-6 flex items-end gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t-sm bg-white/8"
            style={{ height: `${30 + Math.random() * 60}%`, animationDelay: `${i * 0.05}s` }}
          />
        ))}
      </div>
      {/* Axis lines */}
      <div className="absolute bottom-8 inset-x-6 h-px bg-white/10" />
      <div className="absolute bottom-8 inset-y-4 left-6 w-px bg-white/10" />
    </div>
  )
}

export function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1017]">
      <div className="w-48 h-64 rounded-xl bg-white/4 animate-pulse" />
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <Bone className="h-4 w-1/2" />
      <Bone className="h-9 w-full" />
      <div className="grid grid-cols-3 gap-2">
        {[0,1,2].map((i) => <Bone key={i} className="h-16" />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0,1].map((i) => <Bone key={i} className="h-16" />)}
      </div>
      <div className="space-y-3">
        {[0,1,2,3,4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <Bone className="h-2 w-28" />
            <Bone className="h-2 w-10" />
          </div>
        ))}
      </div>
      <CardSkeleton />
    </div>
  )
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Bone key={c} className="h-6" style={{ animationDelay: `${(r * cols + c) * 0.03}s` }} />
          ))}
        </div>
      ))}
    </div>
  )
}
