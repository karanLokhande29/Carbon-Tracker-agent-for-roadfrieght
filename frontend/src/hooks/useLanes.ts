import { useQuery } from '@tanstack/react-query'
import { getAllLanes, getLaneDetail, getForecast } from '@/lib/api'
import type { LaneSummary, LaneDetail, ForecastResponse } from '@/types'

const ONE_HOUR = 60 * 60 * 1000

export function useLanes() {
  return useQuery<LaneSummary[], Error>({
    queryKey: ['lanes'],
    queryFn: getAllLanes,
    staleTime: ONE_HOUR,
    retry: 2,
  })
}

export function useLaneDetail(laneId: string) {
  return useQuery<LaneDetail, Error>({
    queryKey: ['lane', laneId],
    queryFn: () => getLaneDetail(laneId),
    enabled: Boolean(laneId),
    staleTime: ONE_HOUR,
  })
}

export function useForecast(laneId: string, horizon: number) {
  return useQuery<ForecastResponse, Error>({
    queryKey: ['forecast', laneId, horizon],
    queryFn: () => getForecast(laneId, horizon),
    enabled: Boolean(laneId),
    staleTime: ONE_HOUR,
    retry: 1,
  })
}
