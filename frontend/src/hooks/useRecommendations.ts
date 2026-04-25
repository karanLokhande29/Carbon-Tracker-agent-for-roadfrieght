import { useQuery } from '@tanstack/react-query'
import { getRecommendations } from '@/lib/api'
import type { SimulatorInputs, RecommendRequest, RecommendResponse } from '@/types'

export function useRecommendations(
  input: SimulatorInputs,
  baselineKg: number | null,
) {
  const req: RecommendRequest | null = baselineKg != null
    ? {
        lane_id: input.lane_id,
        vehicle_type: input.vehicle_type,
        weight_tons: input.weight_tons,
        load_factor: input.load_factor,
        traffic_index: input.traffic_index,
        weather_index: input.weather_index,
        fuel_price_index: input.fuel_price_index,
        toll_cost_index: input.toll_cost_index,
        driver_efficiency_index: input.driver_efficiency_index,
        route_risk_index: input.route_risk_index,
        month: input.month,
        week_of_year: input.week_of_year,
        model: input.model,
        include_shap: false,
        baseline_prediction_kg: baselineKg,
      }
    : null

  return useQuery<RecommendResponse, Error>({
    queryKey: ['recommend', req],
    queryFn: () => getRecommendations(req!),
    enabled: req != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
