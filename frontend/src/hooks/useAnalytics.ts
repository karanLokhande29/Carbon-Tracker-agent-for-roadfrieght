import { useQuery } from '@tanstack/react-query'
import {
  getVehicleBreakdown,
  getAnomalies,
  getModelMetrics,
  getEntityMape,
  getCityEmbeddings,
  checkHealth,
} from '@/lib/api'
import type {
  VehicleBreakdownMonth,
  AnomalyWeek,
  ModelMetrics,
  EntityMapeItem,
  UMAPPoint,
  HealthResponse,
} from '@/types'

const ONE_HOUR = 60 * 60 * 1000

export function useVehicleBreakdown() {
  return useQuery<VehicleBreakdownMonth[], Error>({
    queryKey: ['vehicle-breakdown'],
    queryFn: getVehicleBreakdown,
    staleTime: ONE_HOUR,
  })
}

export function useAnomalies() {
  return useQuery<AnomalyWeek[], Error>({
    queryKey: ['anomalies'],
    queryFn: getAnomalies,
    staleTime: ONE_HOUR,
  })
}

export function useModelMetrics() {
  return useQuery<ModelMetrics[], Error>({
    queryKey: ['model-metrics'],
    queryFn: getModelMetrics,
    staleTime: ONE_HOUR,
  })
}

export function useEntityMape() {
  return useQuery<EntityMapeItem[], Error>({
    queryKey: ['entity-mape'],
    queryFn: getEntityMape,
    staleTime: ONE_HOUR,
  })
}

export function useCityEmbeddings() {
  return useQuery<UMAPPoint[], Error>({
    queryKey: ['city-embeddings'],
    queryFn: getCityEmbeddings,
    staleTime: ONE_HOUR * 24,
  })
}

export function useHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 0,
  })
}
