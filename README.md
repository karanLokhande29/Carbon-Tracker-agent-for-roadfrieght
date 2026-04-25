# Carbon Tracker Agent 🌿

A production-grade freight emissions intelligence dashboard powered by **CatBoost**, **GraphSAGE**, and **TFT** (Temporal Fusion Transformer).

![Dashboard](docs/preview.png)

## Features

| Feature | Description |
|---|---|
| 🗺️ **India Lane Map** | Interactive D3 map of 140 freight lanes with live emission flow animation |
| 🔮 **Emission Simulator** | Real-time CO₂e prediction with 8-parameter sliders + A/B compare mode |
| 📋 **Recommendations** | AI-generated ranked action plan to cut emissions per shipment |
| 📈 **TFT Forecast** | Quantile forecast (q10–q90) with anomaly week overlays |
| 🚛 **Fleet Planner** | Mix optimiser with carbon offset ROI and radial chart |
| 🧠 **SHAP Explainer** | Dual waterfall + magnitude chart for feature attribution |
| 📅 **Anomaly Calendar** | GitHub-style D3 calendar of 50+ anomaly weeks (2023–2027) |
| 🔬 **3D Emission Surface** | Interactive Plotly surface of CO₂e vs load factor × fuel efficiency |
| 🌐 **City Embeddings** | UMAP projection of 29 cities from GraphSAGE freight network embeddings |
| 📊 **Model Comparison** | Metrics table + TFT calibration chart + per-lane MAPE bars |

---

## Quick Start (Docker)

```bash
# 1. Place model files in backend/models/
# 2. Copy and fill the env file
cp backend/.env.example backend/.env

# 3. Launch all services
docker-compose up
```

Open **http://localhost:4173**

---

## Manual Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Runs at **http://localhost:8000**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:5173**

---

## Model Files Required

Place these in `backend/models/`:

| File | Size | Description |
|---|---|---|
| `catboost_best.cbm` | ~22 MB | CatBoost solo — best for per-shipment accuracy |
| `hybrid_graphsage_catboost_best.cbm` | ~18 MB | GraphSAGE hybrid — best for network analysis |
| `tft_best-82-0.1107.ckpt` | ~35 MB | TFT epoch 82 — best for temporal forecasting |
| `city_embeddings_1.npy` | ~4 KB | City graph embeddings for UMAP visualization |

> **Note:** TFT requires Linux/macOS due to PyTorch DLL constraints. On Windows, the backend falls back to CatBoost for all predictions and shows a clear notice in the Forecast tab.

---

## Architecture

```
carbon-tracker/
├── backend/              # FastAPI + models
│   ├── app/
│   │   ├── routers/      # /predict, /recommend, /forecast, /analytics
│   │   ├── models/       # CatBoost, TFT, GraphSAGE wrappers
│   │   └── data/         # Lane metadata, city coordinates
│   └── run.py
├── frontend/             # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # Map, Simulator, Forecast, Advanced panels
│   │   ├── hooks/        # TanStack Query wrappers
│   │   ├── store/        # Zustand global state
│   │   └── lib/          # API client, utilities
│   └── vite.config.ts
└── docker-compose.yml
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Backend status + model availability |
| `POST` | `/api/predict` | Single prediction |
| `POST` | `/api/predict/compare` | A/B scenario comparison |
| `POST` | `/api/recommend` | Ranked emission reduction recommendations |
| `GET` | `/api/forecast/{lane_id}` | TFT quantile forecast |
| `GET` | `/api/lanes` | All 140 lane summaries with coordinates |
| `GET` | `/api/analytics/vehicle-breakdown` | Monthly CO₂e by vehicle type |
| `GET` | `/api/analytics/anomalies` | Anomaly weeks 2023–2027 |
| `GET` | `/api/analytics/model-metrics` | CatBoost / TFT / hybrid metrics |
| `GET` | `/api/analytics/entity-mape` | Per-lane MAPE + reliability |
| `GET` | `/api/lanes/embeddings/umap` | 29 city UMAP coordinates |

---

## Model Performance

| Model | RMSE | MAPE | Best For |
|---|---|---|---|
| **CatBoost** | ~145 kg | ~17.6% | Per-shipment point estimates |
| **GraphSAGE Hybrid** | ~162 kg | ~20.7% | Network-aware route analysis |
| **TFT** | ~198 kg | ~22.3% | Temporal forecasting with quantiles |

TFT is **near-perfectly calibrated**: the 80% CI contains ~80% of actual observations.

---

*Built as a capstone project demonstrating production-grade ML systems engineering.*
