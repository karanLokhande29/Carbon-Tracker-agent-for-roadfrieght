// ─── Domain Enums / Literals ─────────────────────────────────────────────────

export type VehicleType =
  | 'road_articulated_diesel'
  | 'road_rigid_diesel'
  | 'road_lcv_diesel'
  | 'road_cng'
  | 'road_rigid_electric'

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type ReliabilityLevel = 'good' | 'medium' | 'low'
export type ActionType =
  | 'vehicle_switch'
  | 'load_increase'
  | 'timing_shift'
  | 'driver_efficiency'
  | 'lane_switch'
export type ImpactLevel = 'high' | 'medium' | 'low'
export type ModelType = 'catboost' | 'hybrid' | 'tft'
export type AppTab = 'map' | 'forecast' | 'fleet' | 'explainability' | 'advanced'

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface ShapFeature {
  feature: string
  value: number
  direction: 'increases' | 'decreases'
}

export interface PredictRequest {
  lane_id: string
  vehicle_type: VehicleType
  weight_tons: number
  load_factor: number
  traffic_index: number
  weather_index: number
  fuel_price_index: number
  toll_cost_index: number
  driver_efficiency_index: number
  route_risk_index: number
  month: number
  week_of_year: number
  model?: 'catboost' | 'hybrid'
  include_shap?: boolean
}

export interface PredictResponse {
  prediction_kg: number
  confidence_score: number
  confidence_level: ConfidenceLevel
  low_confidence_warning: boolean
  model_used: string
  origin: string
  destination: string
  distance_km: number
  fuel_cost_inr: number
  shap_features: ShapFeature[] | null
}

export interface CompareResponse {
  a: PredictResponse
  b: PredictResponse
  delta_kg: number
  delta_pct: number
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export interface RecommendRequest extends PredictRequest {
  baseline_prediction_kg: number
}

export interface RecommendationItem {
  rank: number
  action: string
  action_type: ActionType
  co2e_delta_kg: number
  co2e_delta_pct: number
  cost_delta_inr: number
  impact: ImpactLevel
  effort: ImpactLevel
  modified_inputs: Record<string, unknown>
  model_used: string
  lane_info: Record<string, unknown> | null
}

export interface RecommendResponse {
  baseline_kg: number
  recommendations: RecommendationItem[]
  best_saving_kg: number
  best_saving_pct: number
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  date: string
  q02: number
  q10: number
  q25: number
  q50: number
  q75: number
  q90: number
  q98: number
  low_confidence: boolean
}

export interface HistoricalPoint {
  date: string
  co2e_kg: number
}

export interface LaneReliability {
  mape: number
  reliability: ReliabilityLevel
  bias_kg: number
}

export interface ForecastResponse {
  lane_id: string
  horizon_weeks: number
  forecast: ForecastPoint[]
  historical: HistoricalPoint[]
  lane_reliability: LaneReliability
  model_used: string
  is_tft_fallback?: boolean
}

// ─── Lanes ────────────────────────────────────────────────────────────────────

export interface LaneSummary {
  lane_id: string
  origin: string
  destination: string
  distance_km: number
  shipment_count: number
  avg_co2e_kg: number
  vehicle_types: VehicleType[]
  reliability: ReliabilityLevel
  mape: number
  bias_kg: number
  origin_lat: number
  origin_lon: number
  dest_lat: number
  dest_lon: number
}

export type LaneDetail = LaneSummary

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnomalyWeek {
  date: string
  lane_count: number
  total_co2e: number
  vehicle_types: string[]
}

export interface VehicleBreakdownMonth {
  year_month: string
  vehicle_type: VehicleType
  total_co2e_kg: number
  avg_co2e_per_km: number
  avg_co2e_per_tonne: number
  shipment_count: number
}

export interface ModelMetrics {
  name: string
  model_type: string
  best_for: string
  inference_ms: number
  metrics: Record<string, number | string>
}

export interface UMAPPoint {
  city: string
  x: number
  y: number
  avg_co2e_kg: number
  total_shipments: number
  lat: number
  lon: number
}

export interface EntityMapeItem {
  lane_id: string
  origin: string
  destination: string
  mape: number
  reliability: ReliabilityLevel
  bias_kg: number
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface SimulatorInputs {
  lane_id: string
  vehicle_type: VehicleType
  weight_tons: number
  load_factor: number
  traffic_index: number
  weather_index: number
  fuel_price_index: number
  toll_cost_index: number
  driver_efficiency_index: number
  route_risk_index: number
  month: number
  week_of_year: number
  model: 'catboost' | 'hybrid'
  include_shap: boolean
}

export interface HealthModel {
  name: string
  loaded: boolean
}

export interface HealthResponse {
  status: string
  models: HealthModel[]
}
