# Carbon Tracker Agent — Complete Implementation Blueprint

> [!IMPORTANT]
> This document is the **sole source of truth** for an automated code-generation agent.
> Every file, class, method, prop, route, and cache key is specified. No ambiguity, no shortcuts.

---

## 1. COMPLETE FILE TREE

```
carbon-tracker/
├── backend/
│   ├── app/
│   │   ├── __init__.py                    # Empty — package marker
│   │   ├── main.py                        # FastAPI app factory + lifespan + CORS + router mounts
│   │   ├── config.py                      # Settings via pydantic-settings (env vars, paths, Redis URL)
│   │   ├── dependencies.py                # FastAPI Depends: get_redis, get_catboost, get_hybrid, get_tft, get_df
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py                 # ALL Pydantic request/response models (30+ models)
│   │   │   └── enums.py                   # VehicleType, Reliability, ImpactLevel, EffortLevel enums
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── catboost_service.py        # CatBoost inference + SHAP + virtual ensemble confidence
│   │   │   ├── hybrid_service.py          # GraphSAGE-CatBoost inference + cosine similarity
│   │   │   ├── tft_service.py             # TFT forecast with quantile bands + confidence flagging
│   │   │   ├── recommendation_service.py  # Counterfactual engine — generates top-5 actions
│   │   │   ├── fleet_service.py           # Fleet planner calculations (annual CO₂e, costs, payback)
│   │   │   ├── data_service.py            # DataFrame ops — lane stats, time series, aggregations
│   │   │   └── cache_service.py           # Redis get/set with JSON serialization + TTL management
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── predict.py                 # /api/predict/* — CatBoost & hybrid prediction endpoints
│   │   │   ├── forecast.py                # /api/forecast/* — TFT forecasting endpoints
│   │   │   ├── recommend.py               # /api/recommend/* — counterfactual recommendations
│   │   │   ├── fleet.py                   # /api/fleet/* — fleet planner endpoints
│   │   │   ├── data.py                    # /api/data/* — lanes, cities, stats, anomalies, embeddings
│   │   │   ├── shap.py                    # /api/shap/* — SHAP waterfall data
│   │   │   └── health.py                  # /api/health — liveness + model readiness check
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── feature_engineering.py     # Build feature vectors from simulator inputs
│   │       ├── fuel_costs.py              # Fuel cost estimation constants + calculator
│   │       └── validators.py              # Input range validators, slider bounds
│   ├── data/                              # ← EXISTING (11 files, untouched)
│   │   ├── india_freight_emissions.csv
│   │   ├── lane_metadata.json
│   │   ├── category_mappings.json
│   │   ├── feature_names.json
│   │   ├── scaler_params.json
│   │   ├── entity_mape_lookup.json
│   │   ├── city_coordinates.json
│   │   ├── anomaly_data.json
│   │   ├── dataset_stats.json
│   │   ├── model_config.json
│   │   └── tft_arch_config.json
│   ├── models/                            # ← EXISTING (4 files, untouched)
│   │   ├── catboost_best.cbm
│   │   ├── hybrid_graphsage_catboost_best.cbm
│   │   ├── city_embeddings_1.npy
│   │   └── tft_best-82-0.1107.ckpt
│   ├── requirements.txt                   # ← EXISTING (already correct)
│   └── .env                               # [NEW] REDIS_URL, HOST, PORT, LOG_LEVEL
│
├── frontend/
│   ├── public/
│   │   ├── favicon.svg                    # Carbon leaf icon SVG
│   │   └── india-topo.json                # India TopoJSON for react-simple-maps (30 states)
│   ├── src/
│   │   ├── main.tsx                       # React root + QueryClientProvider + StoreProvider
│   │   ├── App.tsx                        # Root layout — TopBar + TabRouter + Map/Simulator split
│   │   ├── index.css                      # Tailwind v4 imports + CSS custom properties + global styles
│   │   ├── vite-env.d.ts                  # Vite type declarations
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts                  # Axios instance + interceptors + base URL config
│   │   │   ├── endpoints.ts               # All API endpoint functions (typed, async)
│   │   │   └── hooks.ts                   # TanStack Query hooks (usePredict, useForecast, etc.)
│   │   │
│   │   ├── store/
│   │   │   ├── simulatorStore.ts          # Zustand: simulator inputs, scenario A/B, selected lane
│   │   │   ├── mapStore.ts                # Zustand: highlighted lane, hovered city, zoom level
│   │   │   ├── predictionStore.ts         # Zustand: last prediction result, SHAP data, recommendations
│   │   │   └── uiStore.ts                 # Zustand: active tab, active model pill, advanced panel open
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── TopBar.tsx             # App header — logo, model pill, tab navigation
│   │   │   │   ├── TabRouter.tsx          # Tab content switcher (Map|Forecast|Fleet|Explain|Advanced)
│   │   │   │   └── SplitPane.tsx          # Resizable left/right split (60/40 default)
│   │   │   │
│   │   │   ├── map/
│   │   │   │   ├── IndiaMap.tsx           # react-simple-maps base + D3 overlay container
│   │   │   │   ├── LaneArcs.tsx           # D3 quadratic bezier arcs for 140 lanes
│   │   │   │   ├── CityCircles.tsx        # City nodes sized by volume, colored by CO₂e
│   │   │   │   ├── FlowDots.tsx           # Animated dots travelling along arcs
│   │   │   │   ├── ReliabilityDots.tsx    # Midpoint reliability indicator dots
│   │   │   │   ├── MapTooltip.tsx         # Hover tooltip (lane info, city info)
│   │   │   │   └── mapUtils.ts            # Projection helpers, arc path generator, color scales
│   │   │   │
│   │   │   ├── simulator/
│   │   │   │   ├── SimulatorPanel.tsx     # Main simulator container — lane select, sliders, result
│   │   │   │   ├── LaneSelector.tsx       # shadcn Select with lane search + metadata preview
│   │   │   │   ├── VehicleTiles.tsx       # 5 radio tiles with vehicle icons
│   │   │   │   ├── SimSlider.tsx          # Reusable slider component with label + value display
│   │   │   │   ├── ScenarioToggle.tsx     # A/B compare toggle + side-by-side layout
│   │   │   │   ├── PredictionResult.tsx   # Animated number counter + confidence bar + warning
│   │   │   │   └── RecommendationCards.tsx # Top 5 counterfactual cards with staggered animation
│   │   │   │
│   │   │   ├── forecast/
│   │   │   │   ├── ForecastPanel.tsx      # TFT forecast container — chart + controls
│   │   │   │   ├── QuantileChart.tsx      # Recharts AreaChart with 5 quantile bands
│   │   │   │   └── ForecastControls.tsx   # Horizon slider, lane selector, reliability badge
│   │   │   │
│   │   │   ├── fleet/
│   │   │   │   ├── FleetPlanner.tsx       # Fleet mix container — sliders + output cards
│   │   │   │   ├── FleetMixSliders.tsx    # 5 linked sliders (sum=100% validation)
│   │   │   │   ├── FleetOutputCards.tsx   # Annual CO₂e, fuel cost, offset cost, trees, payback
│   │   │   │   └── FleetRadialChart.tsx   # RadialBarChart for fleet mix visualization
│   │   │   │
│   │   │   ├── explainability/
│   │   │   │   ├── ShapPanel.tsx          # SHAP explainer container
│   │   │   │   ├── WaterfallChart.tsx     # Horizontal waterfall chart (pos=red, neg=green)
│   │   │   │   ├── AnomalyCalendar.tsx    # D3 GitHub-style heatmap 2023-2027
│   │   │   │   └── CityEmbeddings.tsx     # Recharts ScatterChart of UMAP-projected cities
│   │   │   │
│   │   │   ├── advanced/
│   │   │   │   ├── AdvancedPanel.tsx      # Collapsible advanced research panel
│   │   │   │   ├── ModelComparison.tsx    # 3-model metrics comparison cards
│   │   │   │   ├── EmissionSurface3D.tsx  # Plotly 3D: load_factor × fuel_efficiency × CO₂e
│   │   │   │   ├── EntityMapeBar.tsx      # Recharts bar chart of per-entity MAPE
│   │   │   │   └── VehicleBreakdown.tsx   # Monthly CO₂e by vehicle type bar chart
│   │   │   │
│   │   │   └── ui/                        # shadcn/ui primitives (auto-generated)
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── tabs.tsx
│   │   │       ├── select.tsx
│   │   │       ├── slider.tsx
│   │   │       ├── badge.tsx
│   │   │       ├── tooltip.tsx
│   │   │       ├── progress.tsx
│   │   │       └── popover.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useDebounce.ts             # Generic debounce hook (300ms default)
│   │   │   ├── useDebouncedPredict.ts     # Debounced prediction trigger from simulator state
│   │   │   └── useAnimatedNumber.ts       # Framer Motion number counter hook
│   │   │
│   │   ├── lib/
│   │   │   ├── utils.ts                   # cn() helper, formatters, color scale functions
│   │   │   ├── constants.ts               # Vehicle labels, slider bounds, color palettes, fuel costs
│   │   │   └── types.ts                   # Shared TypeScript interfaces (Lane, City, Prediction, etc.)
│   │   │
│   │   └── assets/
│   │       └── vehicle-icons/             # 5 SVG vehicle type icons
│   │           ├── articulated-diesel.svg
│   │           ├── rigid-diesel.svg
│   │           ├── lcv-diesel.svg
│   │           ├── cng.svg
│   │           └── electric.svg
│   │
│   ├── components.json                    # shadcn/ui configuration
│   ├── index.html                         # Vite entry HTML
│   ├── package.json                       # All dependencies
│   ├── tsconfig.json                      # TypeScript strict config
│   ├── tsconfig.app.json                  # App-specific TS config
│   ├── tsconfig.node.json                 # Node-specific TS config
│   ├── vite.config.ts                     # Vite config + proxy to backend
│   ├── eslint.config.js                   # ESLint config
│   ├── postcss.config.js                  # PostCSS config (Tailwind v4)
│   └── tailwind.config.ts                 # Tailwind v4 config + custom theme
│
└── README.md                              # Project documentation
```

**Total: 82 files** (29 backend, 53 frontend)

---

## 2. BACKEND ARCHITECTURE

### 2.1 Startup Sequence (Lifespan)

```
main.py lifespan(app) →
  1. Load Settings from .env via config.py
  2. Connect Redis (async redis.from_url)           → app.state.redis
  3. Load DataFrame (pd.read_csv, parse dates)      → app.state.df (206k rows, ~400MB RAM)
  4. Load lane_metadata.json                         → app.state.lane_metadata
  5. Load category_mappings.json                     → app.state.category_mappings
  6. Load feature_names.json                         → app.state.feature_names
  7. Load scaler_params.json                         → app.state.scaler_params
  8. Load entity_mape_lookup.json                    → app.state.entity_mape
  9. Load city_coordinates.json                      → app.state.city_coords
  10. Load anomaly_data.json                         → app.state.anomaly_data
  11. Load dataset_stats.json                        → app.state.dataset_stats
  12. Load model_config.json                         → app.state.model_config
  13. Load tft_arch_config.json                      → app.state.tft_config
  14. Load CatBoost model (.cbm)                     → app.state.catboost_model
  15. Load Hybrid CatBoost model (.cbm)              → app.state.hybrid_model
  16. Load city_embeddings_1.npy                     → app.state.city_embeddings (29×D numpy)
  17. Compute UMAP projection (2D) from embeddings  → app.state.city_umap (29×2)
  18. Load TFT checkpoint (PyTorch Lightning)        → app.state.tft_model (eval mode, CPU)
  19. Create SHAP TreeExplainer(catboost_model)      → app.state.shap_explainer
  20. Log "All models loaded" — ready to serve
```

### 2.2 config.py

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    """Application settings loaded from .env"""
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "info"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_PREDICTIONS: int = 300    # 5 min
    CACHE_TTL_STATIC: int = 3600        # 1 hr

    # Paths
    BASE_DIR: Path = Path(__file__).parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    MODELS_DIR: Path = BASE_DIR / "models"

    # Model files
    CATBOOST_PATH: str = "models/catboost_best.cbm"
    HYBRID_PATH: str = "models/hybrid_graphsage_catboost_best.cbm"
    TFT_PATH: str = "models/tft_best-82-0.1107.ckpt"
    EMBEDDINGS_PATH: str = "models/city_embeddings_1.npy"

    class Config:
        env_file = ".env"

settings = Settings()
```

### 2.3 models/enums.py

```python
from enum import Enum

class VehicleType(str, Enum):
    ARTICULATED_DIESEL = "road_articulated_diesel"
    RIGID_DIESEL = "road_rigid_diesel"
    LCV_DIESEL = "road_lcv_diesel"
    CNG = "road_cng"
    RIGID_ELECTRIC = "road_rigid_electric"

class Reliability(str, Enum):
    GOOD = "good"
    MEDIUM = "medium"
    LOW = "low"

class ImpactLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class EffortLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class RecommendationType(str, Enum):
    VEHICLE_SWITCH = "vehicle_switch"
    LOAD_INCREASE = "load_increase"
    TIMING_SHIFT = "timing_shift"
    DRIVER_EFFICIENCY = "driver_efficiency"
    LANE_SWITCH = "lane_switch"
```

### 2.4 models/schemas.py — ALL Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import Optional
from .enums import VehicleType, Reliability, ImpactLevel, EffortLevel, RecommendationType

# ─── Prediction ────────────────────────────────
class PredictRequest(BaseModel):
    lane_id: str
    vehicle_type: VehicleType
    weight_tons: float = Field(ge=1.0, le=40.0)
    load_factor: float = Field(ge=0.3, le=1.5)
    traffic_index: float = Field(ge=0.8, le=1.3)
    weather_index: float = Field(ge=0.8, le=1.2)
    fuel_price_index: float = Field(ge=0.9, le=1.2)
    driver_efficiency_index: float = Field(ge=0.8, le=1.1)
    # Optional overrides (auto-filled from lane metadata if omitted)
    toll_cost_index: Optional[float] = None
    route_risk_index: Optional[float] = None

class PredictResponse(BaseModel):
    co2e_kg: float
    confidence: str                    # "high" | "medium" | "low"
    confidence_score: float            # std/mean ratio from virtual ensembles
    model_used: str                    # "catboost" | "hybrid_graphsage"
    lane_id: str
    origin: str
    destination: str
    distance_km: float
    fuel_cost_inr: float
    low_confidence_warning: bool
    inference_ms: float

# ─── SHAP ──────────────────────────────────────
class ShapFeature(BaseModel):
    feature: str
    value: float                       # actual feature value used
    shap_value: float                  # SHAP contribution in kg CO₂e
    direction: str                     # "positive" | "negative"

class ShapResponse(BaseModel):
    base_value: float                  # expected value (dataset mean)
    prediction: float
    features: list[ShapFeature]        # top 10 by |shap_value|, sorted desc

# ─── Recommendations ──────────────────────────
class Recommendation(BaseModel):
    type: RecommendationType
    title: str
    description: str
    co2e_delta_kg: float               # negative = saving
    co2e_delta_pct: float
    cost_delta_inr: float              # negative = saving
    impact: ImpactLevel
    effort: EffortLevel
    applied_values: dict               # the changed simulator values
    similar_lane_id: Optional[str] = None    # for lane_switch type
    similar_lane_origin: Optional[str] = None
    similar_lane_destination: Optional[str] = None
    model_used: str                    # "catboost" or "hybrid_graphsage"

class RecommendationsResponse(BaseModel):
    baseline_co2e_kg: float
    baseline_cost_inr: float
    recommendations: list[Recommendation]   # top 5 sorted by co2e_delta_pct

# ─── Forecast ─────────────────────────────────
class ForecastRequest(BaseModel):
    lane_id: str
    vehicle_type: VehicleType
    horizon_weeks: int = Field(ge=4, le=12, default=4)

class ForecastPoint(BaseModel):
    week: int                          # 1-indexed forecast step
    date: str                          # ISO date string
    q02: float
    q10: float
    q25: float
    q50: float                         # median prediction
    q75: float
    q90: float
    q98: float
    low_confidence: bool               # True if q50 < 1000

class HistoricalPoint(BaseModel):
    date: str
    co2e_kg: float
    is_anomaly: bool

class ForecastResponse(BaseModel):
    lane_id: str
    vehicle_type: str
    origin: str
    destination: str
    reliability: Reliability
    mape: float
    forecast: list[ForecastPoint]
    historical: list[HistoricalPoint]   # last 12 weeks
    anomaly_weeks: list[str]            # dates of anomaly weeks in range

# ─── Fleet Planner ─────────────────────────────
class FleetMix(BaseModel):
    articulated_diesel_pct: float = Field(ge=0, le=100)
    rigid_diesel_pct: float = Field(ge=0, le=100)
    lcv_diesel_pct: float = Field(ge=0, le=100)
    cng_pct: float = Field(ge=0, le=100)
    electric_pct: float = Field(ge=0, le=100)

class FleetPlannerRequest(BaseModel):
    current_mix: FleetMix
    target_mix: FleetMix
    carbon_offset_price_inr: float = Field(ge=500, le=5000)
    annual_shipments: int = Field(ge=100, le=100000, default=10000)

class FleetPlannerResponse(BaseModel):
    current_annual_co2e_tonnes: float
    target_annual_co2e_tonnes: float
    annual_co2e_saved_tonnes: float
    annual_co2e_saved_pct: float
    fuel_cost_delta_inr: float
    offset_cost_saved_inr: float
    trees_equivalent: int              # 1 tree ≈ 21.77 kg CO₂/year
    payback_months: float
    fleet_mix_chart_data: list[dict]   # [{name, current, target, color}]

# ─── Data Endpoints ────────────────────────────
class LaneInfo(BaseModel):
    lane_id: str
    origin: str
    destination: str
    distance_km: float
    shipment_count: int
    avg_co2e_kg: float
    vehicle_types: list[str]
    reliability: Reliability
    mape: float
    bias_kg: float
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float

class CityInfo(BaseModel):
    name: str
    lat: float
    lon: float
    total_shipments: int
    avg_co2e_kg: float
    connected_lanes: int

class DatasetStatsResponse(BaseModel):
    total_rows: int
    date_range: list[str]
    lanes: int
    cities: int
    vehicle_types: list[str]
    co2e_range_kg: list[float]
    avg_co2e_kg: float
    anomaly_weeks: int
    shipment_spikes: int

class AnomalyWeek(BaseModel):
    date: str
    lane_count: int
    total_co2e: float
    vehicle_types: list[str]

class CityEmbeddingPoint(BaseModel):
    city: str
    x: float                           # UMAP dim 1
    y: float                           # UMAP dim 2
    avg_co2e_kg: float
    total_shipments: int

class ModelMetrics(BaseModel):
    name: str
    type: str
    best_for: str
    inference_ms: int
    metrics: dict

class VehicleBreakdownItem(BaseModel):
    month: str
    vehicle_type: str
    total_co2e_kg: float
    avg_co2e_per_km: float
    avg_co2e_per_tonne: float
    shipment_count: int

class EmissionSurfacePoint(BaseModel):
    load_factor: float
    fuel_efficiency: float
    co2e_kg: float

class HealthResponse(BaseModel):
    status: str
    models_loaded: dict[str, bool]
    redis_connected: bool
    dataset_rows: int
```

### 2.5 Service Layer — Full Method Signatures

---

#### `services/cache_service.py`

```python
class CacheService:
    def __init__(self, redis_client: redis.asyncio.Redis, settings: Settings): ...

    async def get(self, key: str) -> Optional[dict]:
        """Fetch JSON from Redis. Returns None on miss."""

    async def set(self, key: str, value: dict, ttl: int) -> None:
        """Serialize dict → JSON, store with TTL seconds."""

    def prediction_key(self, req: PredictRequest) -> str:
        """Returns 'pred:{lane_id}:{vehicle_type}:{weight}:{lf}:{ti}:{wi}:{fpi}:{dei}'"""

    def forecast_key(self, lane_id: str, vehicle_type: str, horizon: int) -> str:
        """Returns 'fc:{lane_id}:{vehicle_type}:{horizon}'"""

    def shap_key(self, req: PredictRequest) -> str:
        """Returns 'shap:{lane_id}:{vehicle_type}:{weight}:{lf}:{ti}:{wi}:{fpi}:{dei}'"""

    def recommendation_key(self, req: PredictRequest) -> str:
        """Returns 'rec:{lane_id}:{vehicle_type}:{weight}:{lf}:{ti}:{wi}:{fpi}:{dei}'"""

    def static_key(self, name: str) -> str:
        """Returns 'static:{name}' for static data endpoints."""
```

**Redis Cache Key Patterns:**

| Pattern | Example | TTL |
|---------|---------|-----|
| `pred:{lane_id}:{vtype}:{w}:{lf}:{ti}:{wi}:{fpi}:{dei}` | `pred:lane_042:road_cng:15.0:0.85:1.02:1.0:1.05:0.95` | 300s |
| `shap:{lane_id}:{vtype}:{w}:{lf}:{ti}:{wi}:{fpi}:{dei}` | `shap:lane_042:road_cng:15.0:0.85:1.02:1.0:1.05:0.95` | 300s |
| `rec:{lane_id}:{vtype}:{w}:{lf}:{ti}:{wi}:{fpi}:{dei}` | `rec:lane_042:road_cng:15.0:0.85:1.02:1.0:1.05:0.95` | 300s |
| `fc:{lane_id}:{vtype}:{horizon}` | `fc:lane_042:road_cng:8` | 300s |
| `static:lanes` | `static:lanes` | 3600s |
| `static:cities` | `static:cities` | 3600s |
| `static:anomalies` | `static:anomalies` | 3600s |
| `static:embeddings` | `static:embeddings` | 3600s |
| `static:vehicle_breakdown` | `static:vehicle_breakdown` | 3600s |
| `static:emission_surface` | `static:emission_surface` | 3600s |

---

#### `services/catboost_service.py`

```python
class CatBoostService:
    def __init__(self, model: CatBoostRegressor, feature_names: dict,
                 category_mappings: dict, shap_explainer: shap.TreeExplainer): ...

    def predict(self, features: pd.DataFrame) -> tuple[float, float, str]:
        """
        Runs CatBoost .predict() on a single-row DataFrame.
        Also runs virtual_ensemble_predict for confidence.
        Returns: (co2e_kg, confidence_score, confidence_label)
        Calls: _build_pool(), _compute_confidence()
        """

    def _build_pool(self, features: pd.DataFrame) -> catboost.Pool:
        """
        Creates catboost.Pool with cat_features=[0,1,2,3] (indices of lane_id,
        origin, destination, vehicle_type in the feature vector).
        """

    def _compute_confidence(self, features: pd.DataFrame) -> tuple[float, str]:
        """
        Uses model.virtual_ensembles_predict(pool, prediction_type='TotalUncertainty')
        Returns (std/mean ratio, label).
        label: 'high' if ratio < 0.1, 'medium' if < 0.2, else 'low'.
        """

    def get_shap_values(self, features: pd.DataFrame) -> ShapResponse:
        """
        Calls shap_explainer.shap_values(pool).
        Extracts base_value from explainer.expected_value.
        Sorts by |value|, returns top 10.
        """
```

---

#### `services/hybrid_service.py`

```python
class HybridService:
    def __init__(self, model: CatBoostRegressor, embeddings: np.ndarray,
                 city_coords: dict, category_mappings: dict, feature_names: dict): ...

    def predict(self, features: pd.DataFrame) -> float:
        """
        Appends origin/destination city embeddings to feature vector, then .predict().
        Returns co2e_kg.
        """

    def find_similar_lanes(self, lane_id: str, lane_metadata: dict, top_k: int = 3) -> list[dict]:
        """
        Computes cosine similarity between origin_emb+dest_emb of target lane and all other lanes.
        Returns top_k most similar lanes: [{lane_id, origin, destination, distance_km, similarity}].
        Calls: _get_lane_embedding()
        """

    def _get_lane_embedding(self, origin: str, destination: str) -> np.ndarray:
        """
        Looks up origin and destination indices in category_mappings['origin'],
        fetches rows from self.embeddings, concatenates [emb_origin; emb_dest].
        """

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """np.dot(a,b) / (norm(a)*norm(b))"""
```

---

#### `services/tft_service.py`

```python
class TFTService:
    def __init__(self, model, tft_config: dict, scaler_params: dict): ...

    def forecast(self, df: pd.DataFrame, lane_id: str, vehicle_type: str,
                 horizon_weeks: int) -> ForecastResponse:
        """
        Filters df for lane+vehicle, takes last MAX_ENCODER_LENGTH weeks as encoder,
        runs model.predict() with mode='quantiles', extracts all 7 quantile columns.
        Clips horizon to horizon_weeks (up to MAX_PREDICTION_LENGTH=4, loop for 4-12).
        Flags low_confidence where q50 < 1000.
        Calls: _prepare_dataloader(), _extract_quantiles(), _get_historical()
        """

    def _prepare_dataloader(self, series: pd.DataFrame) -> DataLoader:
        """
        Creates pytorch_forecasting.TimeSeriesDataSet with exact TFT arch constants.
        Applies RobustScaler to traffic_index, weather_index using stored params.
        Returns DataLoader(batch_size=1, for_predict=True).
        """

    def _extract_quantiles(self, raw_output) -> list[ForecastPoint]:
        """
        raw_output shape: (1, horizon, 7) for 7 quantiles.
        Maps to ForecastPoint per step with q02,q10,q25,q50,q75,q90,q98.
        """

    def _get_historical(self, series: pd.DataFrame, n_weeks: int = 12) -> list[HistoricalPoint]:
        """Returns last n_weeks of actual co2e_kg + anomaly flags."""

    def _apply_robust_scale(self, df: pd.DataFrame) -> pd.DataFrame:
        """Applies (x - center) / scale to traffic_index and weather_index."""
```

> [!WARNING]
> **TFT sliding-window forecast for horizons > 4 weeks**: Since `MAX_PREDICTION_LENGTH=4`, for horizons 5–12, we must use an autoregressive loop:
> run predict(4 steps) → append predictions to encoder → shift window → predict next 4. This is approximate but the only option with fixed architecture. An alternative simpler approach: for the MVP, cap at 4 weeks and display a notice that longer horizons are extrapolated from the 4-week pattern.

---

#### `services/recommendation_service.py`

```python
class RecommendationService:
    def __init__(self, catboost_service: CatBoostService,
                 hybrid_service: HybridService, lane_metadata: dict): ...

    def generate(self, request: PredictRequest, baseline_co2e: float,
                 baseline_cost: float) -> RecommendationsResponse:
        """
        Generates all 6 counterfactual scenarios, predicts each, ranks by % saving.
        Returns top 5.
        Calls: _try_vehicle_switch(), _try_load_increase(), _try_timing_shift(),
               _try_driver_efficiency(), _try_lane_switch()
        """

    def _try_vehicle_switch(self, request: PredictRequest, target_type: VehicleType,
                            baseline: float) -> Optional[Recommendation]:
        """Switches vehicle type, predicts, computes delta. Skips if same type."""

    def _try_load_increase(self, request: PredictRequest, delta: float,
                           baseline: float) -> Optional[Recommendation]:
        """Increases load_factor by delta (capped at 1.4), predicts delta."""

    def _try_timing_shift(self, request: PredictRequest,
                          baseline: float) -> Optional[Recommendation]:
        """Sets traffic_index to 0.88 (off-peak), predicts delta."""

    def _try_driver_efficiency(self, request: PredictRequest,
                               baseline: float) -> Optional[Recommendation]:
        """Sets driver_efficiency_index to 1.08, predicts delta."""

    def _try_lane_switch(self, request: PredictRequest,
                         baseline: float) -> Optional[Recommendation]:
        """
        Uses hybrid_service.find_similar_lanes() to get best similar lane.
        Predicts on that lane with hybrid model. Computes delta.
        """

    def _classify_impact(self, delta_pct: float) -> ImpactLevel:
        """High if |delta| > 20%, Medium if 10-20%, Low if < 10%."""

    def _classify_effort(self, rec_type: RecommendationType) -> EffortLevel:
        """High: vehicle/lane switch. Medium: load/timing. Low: driver efficiency."""
```

---

#### `services/fleet_service.py`

```python
class FleetService:
    FUEL_COSTS = {
        "road_articulated_diesel": {"km_per_unit": 3.5, "cost_per_unit": 92, "unit": "L"},
        "road_rigid_diesel":       {"km_per_unit": 4.0, "cost_per_unit": 92, "unit": "L"},
        "road_lcv_diesel":         {"km_per_unit": 8.0, "cost_per_unit": 92, "unit": "L"},
        "road_cng":                {"km_per_unit": 2.5, "cost_per_unit": 75, "unit": "kg"},
        "road_rigid_electric":     {"km_per_unit": 1/1.2, "cost_per_unit": 8, "unit": "kWh"},
    }
    AVG_CO2E = {
        "road_articulated_diesel": 6200,
        "road_rigid_diesel":       4100,
        "road_lcv_diesel":         1800,
        "road_cng":                2100,
        "road_rigid_electric":     400,
    }
    TREE_CO2_KG_PER_YEAR = 21.77

    def calculate(self, request: FleetPlannerRequest) -> FleetPlannerResponse:
        """
        Computes weighted-average CO₂e for current vs target fleet mix.
        Calculates annual totals, fuel cost deltas, offset cost savings.
        """

    def _weighted_co2e(self, mix: FleetMix) -> float:
        """Returns weighted average CO₂e per shipment for the given mix percentages."""

    def _weighted_fuel_cost(self, mix: FleetMix, avg_distance: float) -> float:
        """Returns weighted average fuel cost per shipment for the given mix."""
```

---

#### `services/data_service.py`

```python
class DataService:
    def __init__(self, df: pd.DataFrame, lane_metadata: dict,
                 city_coords: dict, entity_mape: dict,
                 category_mappings: dict, anomaly_data: list,
                 dataset_stats: dict): ...

    def get_lanes(self) -> list[LaneInfo]:
        """Merges lane_metadata + entity_mape + city_coords into LaneInfo list."""

    def get_cities(self) -> list[CityInfo]:
        """Aggregates from lane_metadata to build per-city stats."""

    def get_anomalies(self) -> list[AnomalyWeek]:
        """Returns precomputed anomaly_data as typed list."""

    def get_dataset_stats(self) -> DatasetStatsResponse:
        """Returns precomputed dataset_stats."""

    def get_city_embeddings(self, umap_coords: np.ndarray) -> list[CityEmbeddingPoint]:
        """Pairs UMAP 2D coords with city stats for scatter plot."""

    def get_vehicle_breakdown(self) -> list[VehicleBreakdownItem]:
        """Groups df by month + vehicle_type, computes total/avg metrics."""

    def get_emission_surface(self, lane_id: str) -> list[EmissionSurfacePoint]:
        """Generates 20×20 grid of load_factor × fuel_efficiency predictions."""

    def get_lane_time_series(self, lane_id: str, vehicle_type: str) -> pd.DataFrame:
        """Filters df for lane+vehicle, sorts by date, returns weekly series."""

    def get_model_metrics(self, model_config: dict) -> list[ModelMetrics]:
        """Parses model_config.json into typed response."""
```

---

#### `utils/feature_engineering.py`

```python
def build_catboost_features(
    request: PredictRequest,
    lane_metadata: dict,
    df: pd.DataFrame,
    feature_names: list[str]
) -> pd.DataFrame:
    """
    Constructs a single-row DataFrame with all 32 CatBoost features from simulator inputs.

    Steps:
    1. Copy identifiers: lane_id, origin, destination (from lane_metadata[request.lane_id])
    2. Copy numerics: distance_km (from metadata), weight_tons, vehicle_type (from request)
    3. Compute temporal: month, week_of_year, week_of_month, sin_time, cos_time, sin_week, cos_week
       using current date (or dataset latest date as reference)
    4. Copy indices: traffic_index, weather_index, load_factor, fuel_price_index,
       driver_efficiency_index from request
    5. Compute fuel_efficiency from vehicle type defaults
    6. Auto-fill toll_cost_index, route_risk_index from lane averages if not provided
    7. Compute interactions:
       traffic_weather_interaction = traffic_index * weather_index
       fuel_toll_interaction = fuel_price_index * toll_cost_index
       risk_congestion_interaction = route_risk_index * traffic_index
       driver_context_interaction = driver_efficiency_index * (traffic_index + weather_index) / 2
    8. Compute lag features from df filter (last 1, 4, 12 weeks for lane+vehicle)
    9. Compute rolling means from df filter
    10. Set is_anomaly_week=0, is_shipment_spike=0 (simulator → normal conditions)
    11. Return DataFrame with columns in exact feature_names order
    """

def build_hybrid_features(
    request: PredictRequest,
    lane_metadata: dict,
    df: pd.DataFrame,
    feature_names: list[str],
    city_embeddings: np.ndarray,
    category_mappings: dict
) -> pd.DataFrame:
    """
    Like build_catboost_features but appends city embedding dimensions to the feature vector.
    The hybrid model was trained with original features + origin_emb_0..N + dest_emb_0..N.
    """
```

---

#### `utils/fuel_costs.py`

```python
FUEL_PARAMS = {
    "road_articulated_diesel": {"km_per_unit": 3.5, "cost_per_unit_inr": 92, "unit": "L"},
    "road_rigid_diesel":       {"km_per_unit": 4.0, "cost_per_unit_inr": 92, "unit": "L"},
    "road_lcv_diesel":         {"km_per_unit": 8.0, "cost_per_unit_inr": 92, "unit": "L"},
    "road_cng":                {"km_per_unit": 2.5, "cost_per_unit_inr": 75, "unit": "kg"},
    "road_rigid_electric":     {"km_per_unit": 1/1.2, "cost_per_unit_inr": 8, "unit": "kWh"},
}

def estimate_fuel_cost(vehicle_type: str, distance_km: float) -> float:
    """Returns fuel cost in ₹ for a single trip on the given vehicle type."""

def estimate_fuel_efficiency(vehicle_type: str) -> float:
    """Returns the default fuel_efficiency value for the vehicle type."""
```

---

### 2.6 Router Layer — Full Route Signatures

#### `routers/predict.py`

```python
@router.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest, ...):
    """
    Main CatBoost prediction.
    1. Check Redis cache (key: prediction_key(request))
    2. Build feature vector via feature_engineering
    3. Call catboost_service.predict()
    4. Compute fuel cost via fuel_costs.estimate_fuel_cost()
    5. Cache result, return PredictResponse
    """

@router.post("/api/predict/hybrid", response_model=PredictResponse)
async def predict_hybrid(request: PredictRequest, ...):
    """
    Hybrid GraphSAGE-CatBoost prediction.
    Same flow but uses hybrid_service.predict().
    Confidence computed via CatBoost virtual ensembles (not available on hybrid).
    Falls back to entity_mape reliability for confidence label.
    """

@router.post("/api/predict/compare", response_model=dict)
async def predict_compare(scenario_a: PredictRequest, scenario_b: PredictRequest, ...):
    """
    Runs both scenarios through CatBoost, returns {a: PredictResponse, b: PredictResponse, delta_kg, delta_pct}.
    """
```

#### `routers/forecast.py`

```python
@router.post("/api/forecast", response_model=ForecastResponse)
async def forecast(request: ForecastRequest, ...):
    """
    TFT quantile forecast.
    1. Check Redis cache
    2. Filter df for lane+vehicle time series
    3. Call tft_service.forecast()
    4. Cache + return
    """
```

#### `routers/recommend.py`

```python
@router.post("/api/recommend", response_model=RecommendationsResponse)
async def recommend(request: PredictRequest, ...):
    """
    Generate top-5 counterfactual recommendations.
    1. Check Redis cache
    2. Get baseline prediction from catboost_service
    3. Call recommendation_service.generate()
    4. Cache + return
    """
```

#### `routers/shap.py`

```python
@router.post("/api/shap", response_model=ShapResponse)
async def get_shap(request: PredictRequest, ...):
    """
    SHAP waterfall data for the given input.
    1. Check Redis cache
    2. Build features, call catboost_service.get_shap_values()
    3. Cache + return
    """
```

#### `routers/fleet.py`

```python
@router.post("/api/fleet/plan", response_model=FleetPlannerResponse)
async def fleet_plan(request: FleetPlannerRequest, ...):
    """
    Fleet decarbonisation calculator. No caching (inputs too varied).
    Validates sum of mix percentages = 100 for both current and target.
    Calls fleet_service.calculate().
    """
```

#### `routers/data.py`

```python
@router.get("/api/data/lanes", response_model=list[LaneInfo])
async def get_lanes(...):
    """All 140 lanes with metadata + coordinates + reliability. Cached 1hr."""

@router.get("/api/data/cities", response_model=list[CityInfo])
async def get_cities(...):
    """All 30 cities with aggregate stats. Cached 1hr."""

@router.get("/api/data/stats", response_model=DatasetStatsResponse)
async def get_stats(...):
    """Dataset summary statistics. Cached 1hr."""

@router.get("/api/data/anomalies", response_model=list[AnomalyWeek])
async def get_anomalies(...):
    """Precomputed anomaly weeks. Cached 1hr."""

@router.get("/api/data/embeddings", response_model=list[CityEmbeddingPoint])
async def get_embeddings(...):
    """UMAP-projected city embeddings. Cached 1hr."""

@router.get("/api/data/vehicle-breakdown", response_model=list[VehicleBreakdownItem])
async def get_vehicle_breakdown(...):
    """Monthly CO₂e breakdown by vehicle type. Cached 1hr."""

@router.get("/api/data/emission-surface/{lane_id}", response_model=list[EmissionSurfacePoint])
async def get_emission_surface(lane_id: str, ...):
    """20×20 grid for 3D surface plot. Cached 1hr."""

@router.get("/api/data/models", response_model=list[ModelMetrics])
async def get_models(...):
    """All 3 models' metrics. Cached 1hr."""
```

#### `routers/health.py`

```python
@router.get("/api/health", response_model=HealthResponse)
async def health(...):
    """Liveness check. Reports model load status and Redis connectivity."""
```

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Zustand Store Shapes

#### `store/simulatorStore.ts`

```typescript
interface SimulatorInputs {
  lane_id: string;
  vehicle_type: VehicleType;
  weight_tons: number;
  load_factor: number;
  traffic_index: number;
  weather_index: number;
  fuel_price_index: number;
  driver_efficiency_index: number;
}

interface SimulatorState {
  // Scenario A (always active)
  scenarioA: SimulatorInputs;
  // Scenario B (active when compareMode is on)
  scenarioB: SimulatorInputs;
  compareMode: boolean;
  selectedLaneId: string | null;

  // Actions
  setScenarioA: (patch: Partial<SimulatorInputs>) => void;
  setScenarioB: (patch: Partial<SimulatorInputs>) => void;
  toggleCompare: () => void;
  prefillFromLane: (lane: LaneInfo) => void;
  applyRecommendation: (values: Record<string, any>) => void;
  resetToDefaults: () => void;
}
```

#### `store/mapStore.ts`

```typescript
interface MapState {
  highlightedLaneId: string | null;
  hoveredLaneId: string | null;
  hoveredCityName: string | null;
  zoomLevel: number;
  centerCoords: [number, number];

  setHighlightedLane: (id: string | null) => void;
  setHoveredLane: (id: string | null) => void;
  setHoveredCity: (name: string | null) => void;
  setZoom: (level: number, center: [number, number]) => void;
}
```

#### `store/predictionStore.ts`

```typescript
interface PredictionState {
  lastPrediction: PredictResponse | null;
  lastShap: ShapResponse | null;
  recommendations: RecommendationsResponse | null;
  isLoading: boolean;
  error: string | null;

  setPrediction: (p: PredictResponse) => void;
  setShap: (s: ShapResponse) => void;
  setRecommendations: (r: RecommendationsResponse) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  clear: () => void;
}
```

#### `store/uiStore.ts`

```typescript
type TabId = 'map' | 'forecast' | 'fleet' | 'explainability' | 'advanced';

interface UIState {
  activeTab: TabId;
  activeModel: 'catboost' | 'hybrid_graphsage' | 'tft';
  advancedPanelOpen: boolean;

  setActiveTab: (tab: TabId) => void;
  setActiveModel: (model: string) => void;
  toggleAdvanced: () => void;
}
```

### 3.2 TanStack Query Key Patterns

```typescript
// All query keys follow a consistent namespace convention
const queryKeys = {
  lanes:    ['data', 'lanes']    as const,   // staleTime: Infinity (loaded once)
  cities:   ['data', 'cities']   as const,
  stats:    ['data', 'stats']    as const,
  anomalies:['data', 'anomalies'] as const,
  embeddings:['data', 'embeddings'] as const,
  models:   ['data', 'models']   as const,
  vehicleBreakdown: ['data', 'vehicle-breakdown'] as const,

  predict:  (inputs: SimulatorInputs) =>
              ['predict', inputs.lane_id, inputs.vehicle_type,
               inputs.weight_tons, inputs.load_factor, inputs.traffic_index,
               inputs.weather_index, inputs.fuel_price_index,
               inputs.driver_efficiency_index] as const,

  predictHybrid: (inputs: SimulatorInputs) =>
              ['predict', 'hybrid', inputs.lane_id, ...] as const,

  shap:     (inputs: SimulatorInputs) =>
              ['shap', inputs.lane_id, inputs.vehicle_type, ...] as const,

  recommend:(inputs: SimulatorInputs) =>
              ['recommend', inputs.lane_id, ...] as const,

  forecast: (lane_id: string, vehicle_type: string, horizon: number) =>
              ['forecast', lane_id, vehicle_type, horizon] as const,

  emissionSurface: (lane_id: string) =>
              ['data', 'emission-surface', lane_id] as const,
};
```

### 3.3 Component Architecture — Full Detail

---

#### `App.tsx`

```
Props: none
Reads: uiStore.activeTab
Renders:
  <TopBar />
  if activeTab === 'map':
    <SplitPane left={<IndiaMap />} right={<SimulatorPanel />} />
  else:
    <TabRouter activeTab={activeTab} />
```

---

#### `components/layout/TopBar.tsx`

```
Props: none
Reads: uiStore.activeTab, uiStore.activeModel
Writes: uiStore.setActiveTab, uiStore.setActiveModel
Renders:
  - Logo + "Carbon Tracker Agent" title
  - Tab buttons: Map | Forecast | Fleet | Explainability | Advanced
  - Active model pill (CatBoost / Hybrid / TFT) with dot indicator
  - Uses Framer Motion for tab transition underline
```

#### `components/layout/TabRouter.tsx`

```
Props: { activeTab: TabId }
Reads: nothing
Renders: Framer Motion AnimatePresence switch:
  'map'            → null (handled by App.tsx split pane)
  'forecast'       → <ForecastPanel />
  'fleet'          → <FleetPlanner />
  'explainability' → <ShapPanel /> + <AnomalyCalendar /> + <CityEmbeddings /> (vertical stack)
  'advanced'       → <AdvancedPanel />
```

#### `components/layout/SplitPane.tsx`

```
Props: { left: ReactNode, right: ReactNode, defaultSplit?: number }
Renders: CSS grid with draggable divider, default 60/40 split
```

---

#### `components/map/IndiaMap.tsx`

```
Props: none
Reads: mapStore.*, simulatorStore.selectedLaneId
Uses: useLanes() query, useCities() query
Renders:
  - <ComposableMap> with India TopoJSON (react-simple-maps)
  - <Geographies> for state boundaries (light gray fill)
  - SVG <g> overlay for D3 elements:
    - <LaneArcs lanes={lanes} />
    - <CityCircles cities={cities} />
    - <FlowDots lanes={lanes} />
    - <ReliabilityDots lanes={lanes} />
  - <MapTooltip />
  - D3 zoom behavior attached via useEffect
```

#### `components/map/LaneArcs.tsx`

```
Props: { lanes: LaneInfo[] }
Reads: mapStore.highlightedLaneId, mapStore.hoveredLaneId
Writes: mapStore.setHoveredLane, simulatorStore.prefillFromLane
Renders:
  - SVG <path> per lane using quadratic bezier (see §7.4)
  - Stroke color: d3.scaleSequential(d3.interpolateRdYlGn).domain([8000, 1000]) on avg_co2e_kg
  - Stroke width: d3.scaleLinear().domain([500, 2600]).range([1, 4]) on shipment_count
  - Highlighted lane: stroke-width +2, glow filter
  - onClick: prefillFromLane + setHighlightedLane
  - onMouseEnter/Leave: setHoveredLane
```

#### `components/map/CityCircles.tsx`

```
Props: { cities: CityInfo[] }
Reads: mapStore.hoveredCityName
Writes: mapStore.setHoveredCity
Renders:
  - SVG <circle> per city
  - Radius: d3.scaleSqrt().domain([0, maxShipments]).range([4, 16])
  - Fill: same color scale as lanes
  - Hover: pulse animation via CSS
```

#### `components/map/FlowDots.tsx`

```
Props: { lanes: LaneInfo[] }
Renders:
  - 3 small SVG <circle> per lane animated along the arc path
  - Uses requestAnimationFrame loop, 1.5s period per dot
  - Dots are staggered by 0.5s each (0, 0.5s, 1.0s offsets)
  - Color: white with 70% opacity
```

#### `components/map/ReliabilityDots.tsx`

```
Props: { lanes: LaneInfo[] }
Renders:
  - Small <circle r=3> at arc midpoint
  - Fill: green (#22c55e) for 'good', amber (#f59e0b) for 'medium', red (#ef4444) for 'low'
```

#### `components/map/MapTooltip.tsx`

```
Props: none
Reads: mapStore.hoveredLaneId, mapStore.hoveredCityName
Uses: useLanes() to find hovered lane data
Renders:
  - Floating tooltip near cursor (uses mouse position via useRef)
  - Lane tooltip: "Delhi → Mumbai | 1,400 km | 2,717 kg avg | Good reliability | 2,192 shipments"
  - City tooltip: "Mumbai | 15,400 total shipments | 3,200 kg avg"
```

#### `components/map/mapUtils.ts`

```typescript
export function generateArcPath(
  origin: [number, number],  // [lat, lon]
  destination: [number, number],
  projection: GeoProjection
): string
// Returns SVG path "M x0,y0 Q cx,cy x1,y1"

export const co2eColorScale: d3.ScaleSequential
// d3.scaleSequential(d3.interpolateRdYlGn).domain([8000, 1000])  (reversed: green=low, red=high)

export const shipmentWidthScale: d3.ScaleLinear
// d3.scaleLinear().domain([500, 2600]).range([1, 4])

export const cityRadiusScale: d3.ScalePower
// d3.scaleSqrt().domain([0, 5000]).range([4, 16])
```

---

#### `components/simulator/SimulatorPanel.tsx`

```
Props: none
Reads: simulatorStore.scenarioA, .compareMode, .selectedLaneId, predictionStore.*
Writes: simulatorStore.setScenarioA
Uses: useDebouncedPredict() hook
Renders:
  - <LaneSelector />
  - <VehicleTiles />
  - 6× <SimSlider /> (weight, load_factor, traffic, weather, fuel_price, driver_efficiency)
  - <ScenarioToggle />
  - <PredictionResult /> (appears after first prediction)
  - <RecommendationCards /> (appears after prediction)
```

#### `components/simulator/LaneSelector.tsx`

```
Props: { value: string, onChange: (laneId: string) => void }
Uses: useLanes() query
Renders:
  - shadcn Select with search/filter
  - Each option: "lane_042: Kanpur → Coimbatore (2,240 km)"
  - On select: fires onChange which calls prefillFromLane
```

#### `components/simulator/VehicleTiles.tsx`

```
Props: { value: VehicleType, onChange: (type: VehicleType) => void }
Renders:
  - 5 radio-style cards in a grid
  - Each: SVG vehicle icon + label + avg CO₂e badge
  - Selected: ring border + scale animation
  - Framer Motion layoutId for smooth selection animation
```

#### `components/simulator/SimSlider.tsx`

```
Props: {
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit?: string,
  onChange: (v: number) => void
}
Renders:
  - Label left-aligned, current value right-aligned
  - shadcn Slider
  - Uses TanStack Query's 300ms debounce via useDebouncedPredict parent
```

#### `components/simulator/ScenarioToggle.tsx`

```
Props: none
Reads: simulatorStore.compareMode
Writes: simulatorStore.toggleCompare
Renders:
  - Toggle switch "Compare A / B"
  - When active: shows second column of sliders for scenario B
```

#### `components/simulator/PredictionResult.tsx`

```
Props: none
Reads: predictionStore.lastPrediction, .isLoading
Renders:
  - Large animated CO₂e number (useAnimatedNumber hook, Framer Motion)
  - Confidence bar: colored progress bar (green/amber/red)
  - Fuel cost estimate in ₹
  - Low-confidence warning banner (amber alert) if prediction < 1000 or confidence === 'low'
  - Model badge showing which model produced the result
  - Framer Motion slide-in animation
```

#### `components/simulator/RecommendationCards.tsx`

```
Props: none
Reads: predictionStore.recommendations
Writes: simulatorStore.applyRecommendation, mapStore.setHighlightedLane
Renders:
  - Up to 5 cards with staggered Framer Motion animation (delay: i * 0.1s)
  - Each card:
    - Title (e.g. "Switch to Electric")
    - CO₂e delta: "-1,240 kg (-52%)" in green/red
    - Cost delta: "+₹800" or "-₹2,100"
    - Impact badge + Effort badge (colored)
    - Lane switch cards: distinct border color, shows similar corridor info + "via Hybrid Model" badge
  - Hover: mapStore.setHighlightedLane(similar_lane_id) for lane_switch type
  - Click: applyRecommendation(rec.applied_values)
```

---

#### `components/forecast/ForecastPanel.tsx`

```
Props: none
Reads: simulatorStore.selectedLaneId, uiStore.activeTab
Uses: useForecast() query hook
Renders:
  - <ForecastControls />
  - <QuantileChart />
  - Lane reliability badge
  - Low-confidence banner when any point < 1000
```

#### `components/forecast/QuantileChart.tsx`

```
Props: { forecast: ForecastPoint[], historical: HistoricalPoint[], anomalyWeeks: string[] }
Renders:
  - Recharts AreaChart:
    - Area: q10↔q90 (very light fill)
    - Area: q25↔q75 (medium fill)
    - Line: q50 (bold, primary color)
    - Line: historical actual (gray dashed)
    - ReferenceLine: one per anomaly week (amber vertical dashed)
  - Tooltip with all quantile values
  - X-axis: dates, Y-axis: CO₂e kg
```

#### `components/forecast/ForecastControls.tsx`

```
Props: none
Reads: simulatorStore.selectedLaneId
Writes: local state for horizon_weeks
Renders:
  - Lane selector (mirrors main simulator lane)
  - Vehicle type selector
  - Horizon slider (4-12 weeks)
  - Reliability badge (from entity_mape_lookup)
```

---

#### `components/fleet/FleetPlanner.tsx`

```
Props: none
Uses: useFleetPlan() mutation hook
Renders:
  - "Current Fleet" <FleetMixSliders />
  - "Target Fleet" <FleetMixSliders />
  - Carbon offset price slider (₹500-5000)
  - Annual shipments input
  - <FleetOutputCards />
  - <FleetRadialChart />
```

#### `components/fleet/FleetMixSliders.tsx`

```
Props: { mix: FleetMix, onChange: (mix: FleetMix) => void, label: string }
Renders:
  - 5 linked sliders, total displayed
  - Warning badge if sum ≠ 100%
  - sum=100% validation: auto-adjust last slider on change
```

#### `components/fleet/FleetOutputCards.tsx`

```
Props: { result: FleetPlannerResponse }
Renders:
  - 5 metric cards in grid:
    1. Annual CO₂e Saved (tonnes) with animated counter
    2. Fuel Cost Delta (₹) — savings or increase
    3. Offset Cost Saved (₹)
    4. Trees Equivalent 🌳
    5. Payback Period (months)
  - Each with Framer Motion number animation
```

#### `components/fleet/FleetRadialChart.tsx`

```
Props: { chartData: FleetPlannerResponse['fleet_mix_chart_data'] }
Renders:
  - Recharts RadialBarChart
  - 5 bars: current (outer) vs target (inner) per vehicle type
  - Custom legend with vehicle icons
```

---

#### `components/explainability/ShapPanel.tsx`

```
Props: none
Reads: predictionStore.lastShap
Renders:
  - Title: "Feature Attribution — Last Prediction"
  - <WaterfallChart />
  - If no prediction yet: empty state with "Run a prediction to see SHAP values"
```

#### `components/explainability/WaterfallChart.tsx`

```
Props: { data: ShapResponse }
Renders:
  - Horizontal bar chart (Recharts BarChart, layout="vertical")
  - 10 bars: red for positive SHAP (increases CO₂e), green for negative (reduces)
  - Base value line + final prediction line
  - Feature name + actual value label on each bar
```

#### `components/explainability/AnomalyCalendar.tsx`

```
Props: none
Uses: useAnomalies() query hook
Renders:
  - D3 calendar heatmap (GitHub contribution style)
  - 5 years (2023-2027), 52 weeks each
  - Cell color: white → amber → red by total_co2e (d3.scaleQuantize)
  - Click cell → shadcn Popover with lane_count, total CO₂e, vehicle types
  - Year labels on left, month labels on top
```

#### `components/explainability/CityEmbeddings.tsx`

```
Props: none
Uses: useEmbeddings() query hook
Reads: mapStore
Writes: mapStore.setHighlightedLane (on city click → highlight all city lanes)
Renders:
  - Recharts ScatterChart
  - Point size: proportional to avg_co2e_kg
  - Point color: co2eColorScale
  - Hover tooltip: city name, avg CO₂e, total shipments
  - Click: highlight all lanes for that city on map, switch to map tab
```

---

#### `components/advanced/AdvancedPanel.tsx`

```
Props: none
Reads: uiStore.advancedPanelOpen
Renders:
  - Collapsible container
  - Inner tabs: Model Comparison | 3D Surface | Entity MAPE | Vehicle Breakdown
  - Each rendered on demand (lazy)
```

#### `components/advanced/ModelComparison.tsx`

```
Props: none
Uses: useModels() query hook
Renders:
  - 3 cards side-by-side for CatBoost, Hybrid, TFT
  - Each: model name, best_for tag, inference time, key metrics table
  - Highlight best metric per row (lowest RMSE, highest R², etc.)
```

#### `components/advanced/EmissionSurface3D.tsx`

```
Props: none
Uses: useEmissionSurface(selectedLaneId) query hook
Renders:
  - react-plotly.js <Plot> with type='surface'
  - X: load_factor (0.3–1.5), Y: fuel_efficiency (1–10), Z: co2e_kg
  - Colorscale: Viridis
  - Responsive container
```

#### `components/advanced/EntityMapeBar.tsx`

```
Props: none
Uses: useLanes() (extracts mape from LaneInfo[])
Renders:
  - Recharts BarChart, horizontal
  - 140 bars sorted by MAPE
  - Color coded by reliability (green/amber/red)
  - Click bar → prefill simulator with that lane
```

#### `components/advanced/VehicleBreakdown.tsx`

```
Props: none
Uses: useVehicleBreakdown() query hook
Renders:
  - Recharts BarChart with stacked/grouped toggle
  - X: month, Y: CO₂e
  - Per-km and per-tonne normalized view toggle
  - Animated bars with Framer Motion
```

---

### 3.4 API Hook Layer (`api/hooks.ts`)

```typescript
// Static data — fetched once, stale forever
export function useLanes(): UseQueryResult<LaneInfo[]>
  // queryKey: ['data', 'lanes'], staleTime: Infinity

export function useCities(): UseQueryResult<CityInfo[]>
  // queryKey: ['data', 'cities'], staleTime: Infinity

export function useDatasetStats(): UseQueryResult<DatasetStatsResponse>

export function useAnomalies(): UseQueryResult<AnomalyWeek[]>

export function useEmbeddings(): UseQueryResult<CityEmbeddingPoint[]>

export function useModels(): UseQueryResult<ModelMetrics[]>

export function useVehicleBreakdown(): UseQueryResult<VehicleBreakdownItem[]>

export function useEmissionSurface(laneId: string): UseQueryResult<EmissionSurfacePoint[]>
  // queryKey: ['data', 'emission-surface', laneId], enabled: !!laneId

// Prediction — triggered by debounced inputs
export function usePredict(inputs: SimulatorInputs, enabled: boolean): UseQueryResult<PredictResponse>
  // queryKey: ['predict', ...inputs], enabled: enabled && !!inputs.lane_id

export function useShap(inputs: SimulatorInputs, enabled: boolean): UseQueryResult<ShapResponse>
  // queryKey: ['shap', ...inputs], triggered after prediction succeeds

export function useRecommendations(inputs: SimulatorInputs, enabled: boolean): UseQueryResult<RecommendationsResponse>
  // queryKey: ['recommend', ...inputs], triggered after prediction succeeds

// Forecast — triggered on tab open with lane selected
export function useForecast(laneId: string, vehicleType: string, horizon: number, enabled: boolean): UseQueryResult<ForecastResponse>

// Fleet — mutation (not a query, since inputs are complex)
export function useFleetPlan(): UseMutationResult<FleetPlannerResponse, Error, FleetPlannerRequest>

// Compare — mutation
export function usePredictCompare(): UseMutationResult<CompareResponse, Error, {a: SimulatorInputs, b: SimulatorInputs}>
```

---

## 4. API CONTRACT TABLE

| # | Method | Path | Request Body | Response Body | Model Called | Cache TTL |
|---|--------|------|-------------|---------------|-------------|-----------|
| 1 | `POST` | `/api/predict` | `PredictRequest` | `PredictResponse` | CatBoost | 300s |
| 2 | `POST` | `/api/predict/hybrid` | `PredictRequest` | `PredictResponse` | Hybrid GraphSAGE-CatBoost | 300s |
| 3 | `POST` | `/api/predict/compare` | `{scenario_a: PredictRequest, scenario_b: PredictRequest}` | `{a: PredictResponse, b: PredictResponse, delta_kg: float, delta_pct: float}` | CatBoost ×2 | 300s |
| 4 | `POST` | `/api/forecast` | `ForecastRequest` | `ForecastResponse` | TFT | 300s |
| 5 | `POST` | `/api/recommend` | `PredictRequest` | `RecommendationsResponse` | CatBoost + Hybrid | 300s |
| 6 | `POST` | `/api/shap` | `PredictRequest` | `ShapResponse` | CatBoost (SHAP) | 300s |
| 7 | `POST` | `/api/fleet/plan` | `FleetPlannerRequest` | `FleetPlannerResponse` | None (math only) | None |
| 8 | `GET` | `/api/data/lanes` | — | `LaneInfo[]` | None | 3600s |
| 9 | `GET` | `/api/data/cities` | — | `CityInfo[]` | None | 3600s |
| 10 | `GET` | `/api/data/stats` | — | `DatasetStatsResponse` | None | 3600s |
| 11 | `GET` | `/api/data/anomalies` | — | `AnomalyWeek[]` | None | 3600s |
| 12 | `GET` | `/api/data/embeddings` | — | `CityEmbeddingPoint[]` | None (UMAP precomputed) | 3600s |
| 13 | `GET` | `/api/data/vehicle-breakdown` | — | `VehicleBreakdownItem[]` | None | 3600s |
| 14 | `GET` | `/api/data/emission-surface/{lane_id}` | — | `EmissionSurfacePoint[]` | CatBoost (400 preds) | 3600s |
| 15 | `GET` | `/api/data/models` | — | `ModelMetrics[]` | None | 3600s |
| 16 | `GET` | `/api/health` | — | `HealthResponse` | None | None |

---

## 5. DATA FLOW DIAGRAMS

### 5a. Slider Change → Prediction

```
User drags weight_tons slider
    │
    ▼
SimSlider.onChange(18.5)
    │
    ▼
simulatorStore.setScenarioA({ weight_tons: 18.5 })
    │
    ▼
useDebouncedPredict() hook: debounce 300ms
    │  (cancels previous timer if another slider moves within 300ms)
    ▼
After 300ms silence:
    │
    ├─► usePredict(inputs) fires TanStack Query
    │      queryKey: ['predict', 'lane_042', 'road_cng', 18.5, 0.85, ...]
    │      │
    │      ▼
    │   axios.post('/api/predict', inputs)
    │      │
    │      ▼
    │   FastAPI router → predict()
    │      │
    │      ├─► cache_service.get(prediction_key) → MISS
    │      │
    │      ├─► feature_engineering.build_catboost_features(request, ...)
    │      │      └─► Returns 1×32 DataFrame with all features
    │      │
    │      ├─► catboost_service.predict(features)
    │      │      ├─► _build_pool(features, cat_features=[0,1,2,3])
    │      │      ├─► model.predict(pool) → co2e_kg = 2,847.3
    │      │      └─► _compute_confidence(features)
    │      │             └─► model.virtual_ensembles_predict(pool, 'TotalUncertainty')
    │      │             └─► std/mean = 0.08 → "high" confidence
    │      │
    │      ├─► fuel_costs.estimate_fuel_cost('road_cng', 2240) → ₹67,200
    │      │
    │      ├─► cache_service.set(key, result, ttl=300)
    │      │
    │      └─► Returns PredictResponse
    │
    ├─► On prediction success:
    │      predictionStore.setPrediction(response)
    │      │
    │      ▼
    │   PredictionResult re-renders:
    │      useAnimatedNumber: 0 → 2,847.3 (smooth count-up, 800ms)
    │      Confidence bar fills to "High" (green)
    │      Fuel cost: ₹67,200
    │
    ├─► useShap(inputs) fires parallel
    │      └─► POST /api/shap → ShapResponse
    │      └─► predictionStore.setShap(response)
    │
    └─► useRecommendations(inputs) fires parallel
           └─► POST /api/recommend → RecommendationsResponse
           └─► predictionStore.setRecommendations(response)
           └─► RecommendationCards renders 5 cards with stagger animation
```

### 5b. Forecast Tab Open

```
User clicks "Forecast" tab in TopBar
    │
    ▼
uiStore.setActiveTab('forecast')
    │
    ▼
App.tsx → TabRouter renders <ForecastPanel />
    │
    ▼
ForecastPanel mounts, reads simulatorStore.selectedLaneId + vehicle_type
    │
    ├─► If no lane selected: show "Select a lane from the map" empty state
    │
    └─► useForecast(lane_id, vehicle_type, horizon=4, enabled=true)
           │
           ▼
        queryKey: ['forecast', 'lane_042', 'road_cng', 4]
           │
           ▼
        axios.post('/api/forecast', { lane_id, vehicle_type, horizon_weeks: 4 })
           │
           ▼
        FastAPI router → forecast()
           │
           ├─► cache_service.get(forecast_key) → MISS
           │
           ├─► data_service.get_lane_time_series('lane_042', 'road_cng')
           │      └─► Filters 206k rows → ~260 weekly rows for this lane+vehicle
           │
           ├─► tft_service.forecast(series_df, 'lane_042', 'road_cng', 4)
           │      │
           │      ├─► _apply_robust_scale(df)
           │      │      └─► traffic_index = (x - 1.0107) / 0.0155
           │      │      └─► weather_index = (x - 1.0035) / 0.0166
           │      │
           │      ├─► _prepare_dataloader(last 52+4 rows)
           │      │      └─► TimeSeriesDataSet with exact TFT arch constants
           │      │      └─► Returns DataLoader(batch_size=1)
           │      │
           │      ├─► model.predict(dataloader, mode='quantiles')
           │      │      └─► Output shape: (1, 4, 7) — 4 weeks × 7 quantiles
           │      │
           │      ├─► _extract_quantiles(raw_output) → 4 ForecastPoints
           │      │      └─► Flag low_confidence where q50 < 1000
           │      │
           │      └─► _get_historical(series, n_weeks=12) → 12 HistoricalPoints
           │
           ├─► cache_service.set(key, result, ttl=300)
           │
           └─► Returns ForecastResponse
                  │
                  ▼
        ForecastPanel renders:
           QuantileChart:
              - Gray line: 12-week historical
              - Light blue area: q10 ↔ q90
              - Medium blue area: q25 ↔ q75
              - Bold blue line: q50 (median)
              - Amber vertical dashes: anomaly weeks
           ForecastControls:
              - Reliability badge: "medium" (amber)
              - MAPE: 22.2%
              - Horizon slider set to 4
```

### 5c. Recommendation Click

```
User clicks "Switch to Electric" recommendation card
    │
    ▼
RecommendationCards.onClick(recommendation)
    │
    ├─► simulatorStore.applyRecommendation(rec.applied_values)
    │      applied_values = { vehicle_type: "road_rigid_electric" }
    │      │
    │      ▼
    │   simulatorStore.scenarioA merges:
    │      { ...current, vehicle_type: "road_rigid_electric" }
    │
    ├─► mapStore.setHighlightedLane(null)  // clear any highlight
    │
    └─► The Zustand state change triggers re-render of SimulatorPanel
           │
           ▼
        VehicleTiles: Electric tile now selected (ring border animates)
           │
           ▼
        useDebouncedPredict: new inputs detected, 300ms debounce starts
           │
           ▼
        After 300ms: fires new prediction cycle (same as Flow 5a)
           │
           ▼
        New prediction: 400 kg CO₂e (was 2,847)
        New recommendations generated (now from electric baseline)
        SHAP values updated for new prediction

For lane_switch type recommendation:
    │
    ├─► rec.applied_values = { lane_id: "lane_087", vehicle_type: "road_cng" }
    │      (lane is changed, simulator re-populates distance from new lane metadata)
    │
    └─► simulatorStore.prefillFromLane(lane_metadata["lane_087"])
           Updates: lane_id, distance_km auto-set, defaults from lane averages
```

---

## 6. BUILD ORDER

### Phase 0 — Project Scaffolding (Day 1, ~2h)

**Dependencies: None**

```
Tasks:
  [ ] Create backend/.env
  [ ] Create backend/app/__init__.py and all sub-packages
  [ ] Create backend/app/config.py (Settings class)
  [ ] Create backend/app/models/enums.py
  [ ] Create backend/app/models/schemas.py (all Pydantic models)
  [ ] Initialize frontend with Vite + React + TypeScript (npx create-vite)
  [ ] Install all frontend dependencies (package.json)
  [ ] Configure Tailwind v4 + shadcn/ui
  [ ] Set up Vite proxy to backend (port 8000)
  [ ] Install shadcn components: button, card, tabs, select, slider, badge, tooltip, progress, popover
  [ ] Create frontend/src/lib/types.ts (all TypeScript interfaces)
  [ ] Create frontend/src/lib/constants.ts (slider bounds, colors, vehicle labels)
```

### Phase 1 — Backend Core (Day 1-2, ~6h)

**Dependencies: Phase 0**

```
Tasks:
  [ ] Create backend/app/main.py — lifespan loader + CORS + router mounts
  [ ] Create backend/app/dependencies.py
  [ ] Create backend/app/utils/fuel_costs.py
  [ ] Create backend/app/utils/validators.py
  [ ] Create backend/app/services/cache_service.py
  [ ] Create backend/app/services/data_service.py
  [ ] Create backend/app/routers/health.py
  [ ] Create backend/app/routers/data.py (GET endpoints only)
  [ ] TEST: Start server, hit /api/health, /api/data/lanes, /api/data/cities
```

### Phase 2 — CatBoost Prediction Pipeline (Day 2-3, ~4h)

**Dependencies: Phase 1**

```
Tasks:
  [ ] Create backend/app/utils/feature_engineering.py — build_catboost_features()
  [ ] Create backend/app/services/catboost_service.py — predict() + SHAP + confidence
  [ ] Create backend/app/routers/predict.py — POST /api/predict
  [ ] Create backend/app/routers/shap.py — POST /api/shap
  [ ] TEST: POST /api/predict with sample input, verify ~5ms response
  [ ] TEST: POST /api/shap, verify 10 features returned
```

### Phase 3 — Frontend Shell + API Layer (Day 3, ~4h)

**Dependencies: Phase 1 (backend data endpoints working)**

```
Tasks:
  [ ] Create frontend/src/api/client.ts — Axios instance
  [ ] Create frontend/src/api/endpoints.ts — all API functions
  [ ] Create frontend/src/api/hooks.ts — TanStack Query hooks
  [ ] Create frontend/src/store/ — all 4 Zustand stores
  [ ] Create frontend/src/components/layout/ — TopBar, SplitPane, TabRouter
  [ ] Create frontend/src/main.tsx + App.tsx — root layout
  [ ] Create frontend/src/index.css — design system CSS
  [ ] TEST: Frontend renders shell, TopBar shows tabs, split pane visible
```

### Phase 4 — Map + Simulator (Day 3-4, ~8h) ⟵ THE CRITICAL PATH

**Dependencies: Phase 2 + Phase 3**

```
Tasks:
  [ ] Download India TopoJSON → frontend/public/india-topo.json
  [ ] Create frontend/src/components/map/mapUtils.ts
  [ ] Create frontend/src/components/map/IndiaMap.tsx
  [ ] Create frontend/src/components/map/LaneArcs.tsx
  [ ] Create frontend/src/components/map/CityCircles.tsx
  [ ] Create frontend/src/components/map/FlowDots.tsx
  [ ] Create frontend/src/components/map/ReliabilityDots.tsx
  [ ] Create frontend/src/components/map/MapTooltip.tsx
  [ ] Create frontend/src/hooks/useDebounce.ts
  [ ] Create frontend/src/hooks/useDebouncedPredict.ts
  [ ] Create frontend/src/hooks/useAnimatedNumber.ts
  [ ] Create vehicle SVG icons (5 files)
  [ ] Create frontend/src/components/simulator/SimSlider.tsx
  [ ] Create frontend/src/components/simulator/LaneSelector.tsx
  [ ] Create frontend/src/components/simulator/VehicleTiles.tsx
  [ ] Create frontend/src/components/simulator/PredictionResult.tsx
  [ ] Create frontend/src/components/simulator/ScenarioToggle.tsx
  [ ] Create frontend/src/components/simulator/SimulatorPanel.tsx
  [ ] TEST: Click lane on map → simulator prefills → prediction animates in
```

### Phase 5 — Recommendations Engine (Day 4-5, ~4h)

**Dependencies: Phase 2 (CatBoost) + Phase 4 (Simulator)**

```
Tasks:
  [ ] Create backend/app/services/hybrid_service.py
  [ ] Create backend/app/routers/predict.py (add /hybrid endpoint)
  [ ] Create backend/app/services/recommendation_service.py
  [ ] Create backend/app/routers/recommend.py
  [ ] Create frontend/src/components/simulator/RecommendationCards.tsx
  [ ] TEST: Full E2E flow — predict → recommendations appear → click → re-predict
```

### Phase 6 — TFT Forecasting (Day 5-6, ~5h)

**Dependencies: Phase 1 (data service)**

```
Tasks:
  [ ] Create backend/app/services/tft_service.py
  [ ] Create backend/app/routers/forecast.py
  [ ] Create frontend/src/components/forecast/ForecastControls.tsx
  [ ] Create frontend/src/components/forecast/QuantileChart.tsx
  [ ] Create frontend/src/components/forecast/ForecastPanel.tsx
  [ ] TEST: Select lane → Forecast tab → quantile bands render correctly
```

### Phase 7 — Fleet Planner (Day 6, ~3h)

**Dependencies: Phase 0 (schemas only)**

```
Tasks:
  [ ] Create backend/app/services/fleet_service.py
  [ ] Create backend/app/routers/fleet.py
  [ ] Create frontend/src/components/fleet/* (all 4 files)
  [ ] TEST: Adjust fleet mix → outputs recalculate
```

### Phase 8 — Explainability Tab (Day 6-7, ~4h)

**Dependencies: Phase 2 (SHAP), Phase 1 (anomaly data), Phase 3 (embeddings)**

```
Tasks:
  [ ] Create frontend/src/components/explainability/WaterfallChart.tsx
  [ ] Create frontend/src/components/explainability/ShapPanel.tsx
  [ ] Create frontend/src/components/explainability/AnomalyCalendar.tsx
  [ ] Create frontend/src/components/explainability/CityEmbeddings.tsx
  [ ] TEST: Predict → Explainability tab → waterfall chart shows SHAP values
```

### Phase 9 — Advanced Panel (Day 7, ~3h)

**Dependencies: Phase 1 (data endpoints)**

```
Tasks:
  [ ] Create frontend/src/components/advanced/ModelComparison.tsx
  [ ] Create frontend/src/components/advanced/EmissionSurface3D.tsx
  [ ] Create frontend/src/components/advanced/EntityMapeBar.tsx
  [ ] Create frontend/src/components/advanced/VehicleBreakdown.tsx
  [ ] Create frontend/src/components/advanced/AdvancedPanel.tsx
  [ ] TEST: Advanced tab → all 4 sub-panels render
```

### Phase 10 — Polish + Integration (Day 7-8, ~4h)

```
Tasks:
  [ ] Framer Motion transitions on all tab switches
  [ ] Recommendation hover → map lane highlight
  [ ] Number counter animations on all metrics
  [ ] Dark mode styling pass
  [ ] Responsive layout for 1920-1280px widths
  [ ] Error boundaries + loading skeletons
  [ ] Create README.md
```

---

## 7. CRITICAL IMPLEMENTATION PATTERNS

### 7.1 CatBoost Pool Creation with `cat_features`

```python
import catboost
import pandas as pd
import numpy as np

def build_catboost_pool(features_df: pd.DataFrame, feature_names: dict) -> catboost.Pool:
    """
    Critical: CatBoost requires categorical feature indices (not names) when
    creating a Pool for inference. The indices must match the column positions
    in the feature DataFrame, not the original training data.
    """
    cat_cols = feature_names["categorical_features"]
    # ["lane_id", "origin", "destination", "vehicle_type"]

    all_cols = feature_names["catboost_features"]
    # 32 features in exact training order

    # Ensure DataFrame columns match training order
    features_df = features_df[all_cols]

    # Get integer indices of categorical columns
    cat_feature_indices = [all_cols.index(c) for c in cat_cols]
    # Result: [0, 1, 2, 3]

    # Categorical columns must be string type
    for col in cat_cols:
        features_df[col] = features_df[col].astype(str)

    pool = catboost.Pool(
        data=features_df,
        cat_features=cat_feature_indices,
        feature_names=all_cols
    )
    return pool
```

### 7.2 TFT Checkpoint Loading with PyTorch Lightning

```python
import pytorch_lightning as pl
from pytorch_forecasting import TemporalFusionTransformer

def load_tft_model(checkpoint_path: str) -> TemporalFusionTransformer:
    """
    Key pitfall: You CANNOT simply do TemporalFusionTransformer.load_from_checkpoint()
    without the original training dataset to infer architecture. Use the arch config instead.

    The correct approach: load with map_location='cpu' to avoid GPU dependency,
    and use the saved hyperparameters embedded in the checkpoint.
    """
    # pytorch-forecasting saves hparams in the checkpoint
    model = TemporalFusionTransformer.load_from_checkpoint(
        checkpoint_path,
        map_location="cpu"
    )
    model.eval()
    model.freeze()
    return model

# For inference:
def tft_predict(model, dataloader):
    """
    pytorch_forecasting models use a custom predict() method that handles
    the quantile output format.
    """
    import torch

    with torch.no_grad():
        predictions = model.predict(
            dataloader,
            mode="quantiles",     # Returns all 7 quantiles
            return_x=False,
            trainer_kwargs={"accelerator": "cpu"}
        )
    # predictions shape: (batch_size, prediction_length, n_quantiles)
    # predictions shape: (1, 4, 7) for single-lane forecast
    return predictions
```

> [!IMPORTANT]
> **Fallback if `load_from_checkpoint` fails**: If the checkpoint doesn't contain full hparams (some pytorch-forecasting versions), you must reconstruct the TimeSeriesDataSet from data first, then call `TemporalFusionTransformer.load_from_checkpoint(path, dataset=training_dataset)`. This requires creating a dummy dataset with the exact same structure as training. Use `tft_arch_config.json` values.

### 7.3 SHAP Waterfall Data Extraction

```python
import shap
import numpy as np

def extract_shap_waterfall(
    explainer: shap.TreeExplainer,
    pool: catboost.Pool,
    feature_names: list[str],
    features_df: pd.DataFrame,
    top_k: int = 10
) -> dict:
    """
    SHAP TreeExplainer produces raw numpy arrays. This function extracts the
    waterfall data needed for the frontend horizontal bar chart.
    """
    # Get SHAP values for single instance
    shap_values = explainer.shap_values(pool)
    # shap_values shape: (1, 32) — one row, 32 features

    base_value = float(explainer.expected_value)
    # This is the mean prediction across the training set

    sv = shap_values[0]  # First (only) row
    prediction = base_value + np.sum(sv)

    # Create feature-SHAP pairs
    feature_data = []
    for i, fname in enumerate(feature_names):
        feature_data.append({
            "feature": fname,
            "value": float(features_df.iloc[0][fname]) if fname in features_df.columns else 0.0,
            "shap_value": float(sv[i]),
            "direction": "positive" if sv[i] > 0 else "negative"
        })

    # Sort by absolute SHAP value, take top_k
    feature_data.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    top_features = feature_data[:top_k]

    return {
        "base_value": base_value,
        "prediction": float(prediction),
        "features": top_features
    }
```

### 7.4 D3 Arc Path Generation for Lane Map

```typescript
import { geoMercator, type GeoProjection } from 'd3-geo';

/**
 * Generates a quadratic bezier SVG path for a lane arc between two cities.
 *
 * The control point is offset perpendicular to the midpoint of the straight line
 * between origin and destination. The offset distance is proportional to the
 * straight-line distance to create a consistent arc curvature.
 */
export function generateArcPath(
  originCoords: [number, number],   // [lat, lon]
  destCoords: [number, number],     // [lat, lon]
  projection: GeoProjection
): string {
  // Project geographic coordinates to screen coordinates
  // Note: projection expects [lon, lat] (reversed from our storage)
  const [x0, y0] = projection([originCoords[1], originCoords[0]])!;
  const [x1, y1] = projection([destCoords[1], destCoords[0]])!;

  // Midpoint
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;

  // Perpendicular offset for control point
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Offset = 20% of distance, perpendicular direction
  const offset = dist * 0.2;

  // Perpendicular vector (rotate 90°): (-dy, dx) normalized
  const nx = -dy / dist;
  const ny = dx / dist;

  // Control point
  const cx = mx + nx * offset;
  const cy = my + ny * offset;

  return `M ${x0},${y0} Q ${cx},${cy} ${x1},${y1}`;
}

/**
 * Gets the projection configured for India's bounding box.
 */
export function getIndiaProjection(width: number, height: number): GeoProjection {
  return geoMercator()
    .center([82, 22])        // Center of India [lon, lat]
    .scale(width * 1.3)      // Scale to fit
    .translate([width / 2, height / 2]);
}

/**
 * Gets a point at parameter t (0-1) along a quadratic bezier curve.
 * Used for animating flow dots along arcs.
 */
export function getPointOnQuadBezier(
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  t: number
): [number, number] {
  const mt = 1 - t;
  const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
  const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
  return [x, y];
}
```

### 7.5 Virtual Ensemble Confidence Score Computation

```python
import catboost
import numpy as np

def compute_virtual_ensemble_confidence(
    model: catboost.CatBoostRegressor,
    pool: catboost.Pool
) -> tuple[float, float, str]:
    """
    CatBoost's virtual ensembles provide uncertainty estimation without
    training multiple models. It splits the ensemble of trees into
    pseudo-independent sub-ensembles.

    Returns: (mean_prediction, cv_ratio, confidence_label)
    cv_ratio = std / mean — lower is more confident
    """
    # virtual_ensembles_predict returns an array of shape (n_samples, 2)
    # Column 0: mean prediction (same as .predict())
    # Column 1: estimated standard deviation
    result = model.virtual_ensembles_predict(
        pool,
        prediction_type='TotalUncertainty',
        virtual_ensembles_count=10  # Number of sub-ensembles
    )

    mean_pred = float(result[0, 0])
    std_pred = float(result[0, 1])

    # Coefficient of variation: lower = more confident
    if abs(mean_pred) < 1e-6:
        cv_ratio = 1.0
    else:
        cv_ratio = std_pred / abs(mean_pred)

    # Classification thresholds
    if cv_ratio < 0.10:
        label = "high"
    elif cv_ratio < 0.20:
        label = "medium"
    else:
        label = "low"

    return mean_pred, cv_ratio, label
```

### 7.6 GraphSAGE Cosine Similarity Computation from .npy File

```python
import numpy as np
from typing import Optional

def compute_lane_similarities(
    target_lane_id: str,
    lane_metadata: dict,
    city_embeddings: np.ndarray,       # shape: (29, embedding_dim)
    category_mappings: dict,
    top_k: int = 3
) -> list[dict]:
    """
    The city_embeddings_1.npy file contains learned GraphSAGE embeddings
    for 29 cities (indexed by position in category_mappings['origin']).

    For each lane, we create a lane embedding by concatenating the
    origin city embedding and destination city embedding.
    Then we compute cosine similarity between the target lane and all others.
    """
    origin_cities = category_mappings["origin"]        # 30 cities
    destination_cities = category_mappings["destination"]  # 29 cities

    # Note: embeddings are for 29 cities — need to figure out mapping.
    # The .npy has 29 rows. We use a combined list of unique cities.
    # From the data: 30 origins, 29 destinations — likely the 29 common ones in dest
    # plus one origin-only city (Raipur is origin-only based on category_mappings)

    # Build city→index mapping from embeddings
    # The embeddings correspond to the cities in alphabetical order (matching both lists)
    all_cities = sorted(set(origin_cities) | set(destination_cities))
    # This gives us 30 cities. The .npy has 29 rows.
    # We need to identify which 29. Compare with destination list (29 cities).
    emb_cities = destination_cities  # 29 cities — the embedding indices

    city_to_emb_idx = {city: i for i, city in enumerate(emb_cities)}

    def get_lane_embedding(lane_id: str) -> Optional[np.ndarray]:
        meta = lane_metadata[lane_id]
        origin = meta["origin"]
        dest = meta["destination"]
        if origin not in city_to_emb_idx or dest not in city_to_emb_idx:
            return None
        origin_emb = city_embeddings[city_to_emb_idx[origin]]
        dest_emb = city_embeddings[city_to_emb_idx[dest]]
        return np.concatenate([origin_emb, dest_emb])

    target_emb = get_lane_embedding(target_lane_id)
    if target_emb is None:
        return []

    similarities = []
    for lane_id, meta in lane_metadata.items():
        if lane_id == target_lane_id:
            continue
        lane_emb = get_lane_embedding(lane_id)
        if lane_emb is None:
            continue

        # Cosine similarity
        dot = np.dot(target_emb, lane_emb)
        norm_a = np.linalg.norm(target_emb)
        norm_b = np.linalg.norm(lane_emb)
        if norm_a < 1e-8 or norm_b < 1e-8:
            continue
        cos_sim = float(dot / (norm_a * norm_b))

        similarities.append({
            "lane_id": lane_id,
            "origin": meta["origin"],
            "destination": meta["destination"],
            "distance_km": meta["distance_km"],
            "similarity": cos_sim,
            "avg_co2e_kg": meta["avg_co2e_kg"]
        })

    # Sort by descending similarity, return top-k
    similarities.sort(key=lambda x: x["similarity"], reverse=True)
    return similarities[:top_k]
```

---

## 8. KEY DESIGN DECISIONS

> [!NOTE]
> **Why no WebSocket?** The prediction latency is ~5ms (CatBoost) and ~2s (TFT). HTTP POST with 300ms debounce is sufficient. WebSocket adds complexity without meaningful UX gain at this scale.

> [!NOTE]
> **Why UMAP at startup, not on-demand?** The city embeddings are only 29×D — UMAP on 29 points takes <100ms. Computing it once at startup avoids repeated computation and simplifies the API.

> [!NOTE]
> **Why Redis instead of in-memory cache?** Redis provides TTL management, atomic operations, and survives server restarts. For a single-server deployment, `functools.lru_cache` would work but Redis is already in the stack and scales to multi-worker uvicorn.

> [!WARNING]
> **TFT horizon > 4 weeks**: The model was trained with `MAX_PREDICTION_LENGTH=4`. For horizons 5–12, use repeated autoregressive prediction (predict 4 → shift encoder window → predict next 4). This degrades accuracy progressively. Display a warning badge for weeks 5+.

> [!IMPORTANT]
> **Hybrid model feature vector**: The hybrid GraphSAGE-CatBoost model expects additional embedding columns appended to the standard 32 CatBoost features. The exact column count depends on `embedding_dim` from the .npy file. Load the .npy, check `shape[1]`, and append `origin_emb_0`, `origin_emb_1`, ..., `dest_emb_0`, `dest_emb_1`, ... columns to the feature DataFrame.

---

## 9. FRONTEND DEPENDENCIES (`package.json`)

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-simple-maps": "^3.0.0",
    "recharts": "^2.13.0",
    "react-plotly.js": "^2.6.0",
    "plotly.js-dist-min": "^2.35.0",
    "d3": "^7.9.0",
    "d3-geo": "^3.1.0",
    "topojson-client": "^3.1.0",
    "framer-motion": "^11.5.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.59.0",
    "axios": "^1.7.0",
    "lucide-react": "^0.451.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-slider": "^1.2.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/d3": "^7.4.0",
    "@types/topojson-client": "^3.1.0",
    "@types/react-plotly.js": "^2.6.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "eslint": "^9.0.0",
    "globals": "^15.0.0"
  }
}
```

---

## 10. VERIFICATION PLAN

### Automated Tests (backend)

```bash
# Start Redis
redis-server

# Start backend
cd backend && uvicorn app.main:app --reload --port 8000

# Health check
curl http://localhost:8000/api/health

# Data endpoints
curl http://localhost:8000/api/data/lanes | python -m json.tool | head -20
curl http://localhost:8000/api/data/cities
curl http://localhost:8000/api/data/stats

# Prediction
curl -X POST http://localhost:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{"lane_id":"lane_042","vehicle_type":"road_cng","weight_tons":15,"load_factor":0.85,"traffic_index":1.02,"weather_index":1.0,"fuel_price_index":1.05,"driver_efficiency_index":0.95}'

# SHAP
curl -X POST http://localhost:8000/api/shap \
  -H "Content-Type: application/json" \
  -d '{"lane_id":"lane_042","vehicle_type":"road_cng","weight_tons":15,"load_factor":0.85,"traffic_index":1.02,"weather_index":1.0,"fuel_price_index":1.05,"driver_efficiency_index":0.95}'

# Forecast
curl -X POST http://localhost:8000/api/forecast \
  -H "Content-Type: application/json" \
  -d '{"lane_id":"lane_042","vehicle_type":"road_cng","horizon_weeks":4}'

# Recommendations
curl -X POST http://localhost:8000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"lane_id":"lane_042","vehicle_type":"road_cng","weight_tons":15,"load_factor":0.85,"traffic_index":1.02,"weather_index":1.0,"fuel_price_index":1.05,"driver_efficiency_index":0.95}'
```

### Browser Tests

```
1. Open http://localhost:5173
2. Verify map renders with 140 lane arcs and 30 city circles
3. Click a lane → simulator prefills, verify distance auto-populated
4. Adjust weight slider → prediction appears after 300ms
5. Verify recommendation cards appear with staggered animation
6. Hover recommendation → map lane highlights
7. Click recommendation → simulator updates → new prediction fires
8. Click Forecast tab → quantile chart renders
9. Click Fleet tab → adjust sliders → output cards update
10. Click Explainability tab → SHAP waterfall shows
11. Open Advanced panel → all 4 sub-panels render
```
