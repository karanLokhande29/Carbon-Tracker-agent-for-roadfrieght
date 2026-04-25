/**
 * MapPanel — data-fetching wrapper around IndiaLaneMap.
 * Connects the map to Zustand store and TanStack Query data.
 */
import { useCallback } from 'react'
import { Loader2 } from 'lucide-react'

import { IndiaLaneMap } from '@/components/map/IndiaLaneMap'
import { useLanes } from '@/hooks/useLanes'
import { useAppStore } from '@/store'

export function MapPanel() {
  const { data: lanes, isLoading, isError, error } = useLanes()

  const selectedLane = useAppStore((s) => s.selectedLane)
  const highlightedLanes = useAppStore((s) => s.highlightedLanes)
  const highlightedCity = useAppStore((s) => s.highlightedCity)
  const setSelectedLane = useAppStore((s) => s.setSelectedLane)
  const updateInputA = useAppStore((s) => s.updateInputA)

  const handleLaneSelect = useCallback(
    (laneId: string) => {
      const lane = lanes?.find((l) => l.lane_id === laneId) ?? null
      setSelectedLane(lane)
      if (lane) {
        updateInputA({ lane_id: lane.lane_id })
      }
    },
    [lanes, setSelectedLane, updateInputA],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading 140 freight lanes…</span>
      </div>
    )
  }

  if (isError || !lanes) {
    return (
      <div className="flex items-center justify-center h-full text-red-400/70 text-sm">
        Failed to load lanes: {error?.message ?? 'Unknown error'}
      </div>
    )
  }

  return (
    <IndiaLaneMap
      lanes={lanes}
      selectedLaneId={selectedLane?.lane_id ?? null}
      highlightedLaneIds={highlightedLanes}
      highlightedCity={highlightedCity}
      onLaneSelect={handleLaneSelect}
    />
  )
}
