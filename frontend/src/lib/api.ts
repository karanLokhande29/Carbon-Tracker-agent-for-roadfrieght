import axios from 'axios'
import type {
  PredictRequest,
  PredictResponse,
  CompareResponse,
  RecommendRequest,
  RecommendResponse,
  ForecastResponse,
  LaneSummary,
  LaneDetail,
  UMAPPoint,
  AnomalyWeek,
  VehicleBreakdownMonth,
  ModelMetrics,
  EntityMapeItem,
  HealthResponse,
} from '@/types'

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  timeout: 30_000,
})

api.interceptors.request.use((config) => {
  config.headers['Content-Type'] = 'application/json'
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const detail = err.response?.data?.detail
    const msg =
      detail
        ? typeof detail === 'string'
          ? detail
          : JSON.stringify(detail)
        : err.message ?? 'Unknown error'
    return Promise.reject(new Error(`[${status ?? 'Network'}] ${msg}`))
  },
)

// ─── Prediction ───────────────────────────────────────────────────────────────

export async function predictEmission(req: PredictRequest): Promise<PredictResponse> {
  const { data } = await api.post<PredictResponse>('/api/predict', req)
  return data
}

export async function predictCompare(
  a: PredictRequest,
  b: PredictRequest,
): Promise<CompareResponse> {
  const { data } = await api.post<CompareResponse>('/api/predict/compare', {
    scenario_a: a,
    scenario_b: b,
  })
  return data
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export async function getRecommendations(req: RecommendRequest): Promise<RecommendResponse> {
  const { data } = await api.post<RecommendResponse>('/api/recommend', req)
  return data
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export async function getForecast(laneId: string, horizon: number): Promise<ForecastResponse> {
  const { data } = await api.get<ForecastResponse>(`/api/forecast/${laneId}`, {
    params: { horizon },
  })
  return data
}

// ─── Lanes ────────────────────────────────────────────────────────────────────

export async function getAllLanes(): Promise<LaneSummary[]> {
  const { data } = await api.get<LaneSummary[]>('/api/lanes')
  return data
}

export async function getLaneDetail(laneId: string): Promise<LaneDetail> {
  const { data } = await api.get<LaneDetail>(`/api/lanes/${laneId}`)
  return data
}

export async function getCityEmbeddings(): Promise<UMAPPoint[]> {
  const { data } = await api.get<UMAPPoint[]>('/api/lanes/embeddings/umap')
  return data
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getAnomalies(): Promise<AnomalyWeek[]> {
  const { data } = await api.get<AnomalyWeek[]>('/api/analytics/anomalies')
  return data
}

export async function getVehicleBreakdown(): Promise<VehicleBreakdownMonth[]> {
  const { data } = await api.get<VehicleBreakdownMonth[]>('/api/analytics/vehicle-breakdown')
  return data
}

export async function getModelMetrics(): Promise<ModelMetrics[]> {
  const { data } = await api.get<ModelMetrics[]>('/api/analytics/model-metrics')
  return data
}

export async function getEntityMape(): Promise<EntityMapeItem[]> {
  const { data } = await api.get<EntityMapeItem[]>('/api/analytics/entity-mape')
  return data
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}
