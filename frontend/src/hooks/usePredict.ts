import { useQuery } from '@tanstack/react-query'
import { predictEmission } from '@/lib/api'
import { useDebounce } from './useDebounce'
import type { SimulatorInputs, PredictRequest, PredictResponse } from '@/types'

export function usePrediction(input: SimulatorInputs, enabled = true) {
  const debounced = useDebounce(input, 300)

  const req: PredictRequest = {
    lane_id: debounced.lane_id,
    vehicle_type: debounced.vehicle_type,
    weight_tons: debounced.weight_tons,
    load_factor: debounced.load_factor,
    traffic_index: debounced.traffic_index,
    weather_index: debounced.weather_index,
    fuel_price_index: debounced.fuel_price_index,
    toll_cost_index: debounced.toll_cost_index,
    driver_efficiency_index: debounced.driver_efficiency_index,
    route_risk_index: debounced.route_risk_index,
    month: debounced.month,
    week_of_year: debounced.week_of_year,
    model: debounced.model,
    include_shap: debounced.include_shap,
  }

  return useQuery<PredictResponse, Error>({
    queryKey: ['predict', req],
    queryFn: () => predictEmission(req),
    enabled: enabled && Boolean(debounced.lane_id),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}
