import { create } from 'zustand'
import { getCurrentWeekOfYear } from '@/lib/utils'
import type {
  AppTab,
  ModelType,
  PredictResponse,
  LaneSummary,
  SimulatorInputs,
} from '@/types'

// ─── Default simulator inputs ─────────────────────────────────────────────────

const DEFAULT_INPUTS: SimulatorInputs = {
  lane_id: 'lane_000',
  vehicle_type: 'road_articulated_diesel',
  weight_tons: 16,
  load_factor: 0.8,
  traffic_index: 1.03,
  weather_index: 1.0,
  fuel_price_index: 1.01,
  toll_cost_index: 1.35,
  driver_efficiency_index: 0.94,
  route_risk_index: 1.08,
  month: new Date().getMonth() + 1,
  week_of_year: getCurrentWeekOfYear(),
  model: 'catboost',
  include_shap: true,
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface AppStore {
  // Lane selection
  selectedLane: LaneSummary | null
  highlightedLanes: string[]
  highlightedCity: string | null
  setSelectedLane: (lane: LaneSummary | null) => void
  setSelectedLaneId: (laneId: string) => void
  setHighlightedLanes: (ids: string[]) => void
  setHighlightedLaneIds: (ids: string[]) => void
  setHighlightedCity: (city: string | null) => void

  // Compare mode
  compareMode: boolean
  setCompareMode: (v: boolean) => void

  // Simulator inputs
  inputA: SimulatorInputs
  inputB: SimulatorInputs
  updateInputA: (patch: Partial<SimulatorInputs>) => void
  updateInputB: (patch: Partial<SimulatorInputs>) => void
  resetInputB: () => void

  // Prediction results
  predictionA: PredictResponse | null
  predictionB: PredictResponse | null
  setPredictionA: (p: PredictResponse | null) => void
  setPredictionB: (p: PredictResponse | null) => void

  // Active model
  activeModel: ModelType
  setActiveModel: (m: ModelType) => void

  // Tab navigation
  activeTab: AppTab
  setActiveTab: (t: AppTab) => void
}

// ─── Store implementation ─────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set) => ({
  // Lane selection
  selectedLane: null,
  highlightedLanes: [],
  highlightedCity: null,
  setSelectedLane: (lane) =>
    set((s) => ({
      selectedLane: lane,
      highlightedCity: null, // clear city highlight when a lane is explicitly selected
      inputA: lane
        ? { ...s.inputA, lane_id: lane.lane_id }
        : s.inputA,
    })),
  setSelectedLaneId: (laneId) =>
    set((s) => ({ inputA: { ...s.inputA, lane_id: laneId } })),
  setHighlightedLanes: (ids) => set({ highlightedLanes: ids }),
  setHighlightedLaneIds: (ids) => set({ highlightedLanes: ids }),
  setHighlightedCity: (city) => set({ highlightedCity: city }),

  // Compare mode
  compareMode: false,
  setCompareMode: (v) => set({ compareMode: v }),

  // Inputs
  inputA: { ...DEFAULT_INPUTS },
  inputB: { ...DEFAULT_INPUTS },
  updateInputA: (patch) =>
    set((s) => ({ inputA: { ...s.inputA, ...patch } })),
  updateInputB: (patch) =>
    set((s) => ({ inputB: { ...s.inputB, ...patch } })),
  resetInputB: () => set((s) => ({ inputB: { ...s.inputA } })),

  // Results
  predictionA: null,
  predictionB: null,
  setPredictionA: (p) => set({ predictionA: p }),
  setPredictionB: (p) => set({ predictionB: p }),

  // Model
  activeModel: 'catboost',
  setActiveModel: (m) => set({ activeModel: m }),

  // Tab
  activeTab: 'map',
  setActiveTab: (t) => set({ activeTab: t }),
}))
