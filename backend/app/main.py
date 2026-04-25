"""
Carbon Tracker Agent — FastAPI application entry-point.

Startup sequence (lifespan):
  1. Redis connection
  2. CatBoost solo + hybrid models  (~1 s)
  3. GraphSAGE city embeddings       (<1 s)
  4. Recommendation service          (instant)
  5. TFT temporal model              (~45 s)
"""

from __future__ import annotations

import logging
import os
import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load every model and connection once; store on app.state."""
    logger.info("═══ Starting Carbon Tracker Agent backend ═══")
    t0 = time.time()

    from app.config import get_settings

    settings = get_settings()

    # ── CI_MODE: skip all model loading, inject stubs ─────────────────
    if os.getenv("CI_MODE", "").lower() in ("1", "true", "yes"):
        logger.info("CI_MODE=true — skipping model loading, injecting stubs")
        app.state.redis = _DummyRedis()
        app.state.catboost = _DummyCatBoost()
        app.state.graphsage = _DummyGraphSAGE()
        app.state.recommendations = _DummyRecommendations()
        app.state.tft = _DummyTFT()
        logger.info("═══ CI stubs ready (%.1fs) ═══", time.time() - t0)
        yield
        logger.info("Backend shutdown complete.")
        return

    # ── 1. Redis ──────────────────────────────────────────────────
    logger.info("Connecting to Redis @ %s …", settings.REDIS_URL)
    try:
        app.state.redis = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
        await app.state.redis.ping()
        logger.info("Redis connected (%.1fs)", time.time() - t0)
    except Exception:
        logger.warning(
            "Redis unavailable — running without cache. "
            "Start Redis to enable caching."
        )
        # Provide a dummy async redis that silently no-ops
        app.state.redis = _DummyRedis()

    # ── 2. CatBoost ───────────────────────────────────────────────
    logger.info("Loading CatBoost models …")
    from app.services.catboost_service import CatBoostService

    app.state.catboost = CatBoostService(
        str(settings.resolved_catboost_path),
        str(settings.resolved_hybrid_path),
        str(settings.resolved_data_dir),
    )
    logger.info("CatBoost ready (%.1fs)", time.time() - t0)

    # ── 3. GraphSAGE embeddings ───────────────────────────────────
    logger.info("Loading GraphSAGE embeddings …")
    from app.services.graphsage_service import GraphSAGEService

    app.state.graphsage = GraphSAGEService(
        str(settings.resolved_embeddings_path),
        str(settings.resolved_data_dir),
    )
    logger.info("GraphSAGE ready (%.1fs)", time.time() - t0)

    # ── 4. Recommendation service ─────────────────────────────────
    from app.services.recommendation_service import RecommendationService

    app.state.recommendations = RecommendationService(
        app.state.catboost, app.state.graphsage
    )
    logger.info("Recommendation engine ready")

    # ── 5. TFT (slow — loaded last, fully isolated) ───────────────
    try:
        logger.info("Loading TFT checkpoint … (may take ~45s; gracefully handles Windows DLL failures)")
        from app.services.tft_service import TFTService
        app.state.tft = TFTService(
            str(settings.resolved_tft_path), str(settings.resolved_data_dir)
        )
        status = "available" if app.state.tft.available else "unavailable (historical fallback active)"
        logger.info("TFT status: %s", status)
    except Exception as e:
        logger.error("TFT service init failed entirely (%s: %s) — using stub", type(e).__name__, e)
        from app.services.tft_service import TFTServiceStub
        app.state.tft = TFTServiceStub()

    elapsed = time.time() - t0
    logger.info("═══ All models loaded. Total startup: %.1fs ═══", elapsed)

    yield  # ── application runs here ──

    # ── shutdown ──────────────────────────────────────────────────
    try:
        await app.state.redis.close()
    except Exception:
        pass
    logger.info("Backend shutdown complete.")


# ── FastAPI app ───────────────────────────────────────────────────────────

app = FastAPI(
    title="Carbon Tracker Agent API",
    description="AI-powered CO₂e emission prediction for India road freight",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── mount routers ─────────────────────────────────────────────────────────

from app.routers import predict, recommend, forecast, lanes, analytics  # noqa: E402

app.include_router(predict.router)
app.include_router(recommend.router)
app.include_router(forecast.router)
app.include_router(lanes.router)
app.include_router(analytics.router)


# ── health endpoint ──────────────────────────────────────────────────────


@app.get("/health")
async def health():
    """Liveness + model readiness check."""
    models = []
    for name in ("catboost", "graphsage", "tft", "recommendations", "redis"):
        loaded = hasattr(app.state, name) and not isinstance(
            getattr(app.state, name), (_DummyRedis, _DummyTFT)
        )
        models.append({"name": name, "loaded": loaded})
    return {"status": "ok", "models": models}


# ── fallback stubs for non-critical services ─────────────────────────────


class _DummyRedis:
    """No-op Redis stand-in so the app runs without a Redis server."""

    async def get(self, *a, **kw):
        return None

    async def set(self, *a, **kw):
        pass

    async def ping(self, *a, **kw):
        return True

    async def close(self):
        pass


class _DummyCatBoost:
    """CI stub — returns zero prediction without loading any model file."""

    _lane_meta: dict = {}

    def get_lane_metadata(self, lane_id: str) -> dict:
        return self._lane_meta.get(lane_id, {})

    def predict(self, req) -> dict:
        return {"prediction_kg": 0.0, "confidence_score": 0.0,
                "confidence_level": "low", "low_confidence_warning": True,
                "model_used": "ci_stub", "origin": "", "destination": "",
                "distance_km": 0.0, "fuel_cost_inr": 0.0}

    def predict_hybrid(self, req, graphsage_service=None) -> dict:
        return self.predict(req)

    def predict_shap(self, req) -> list:
        return []

    def predict_batch(self, rows) -> list:
        return [0.0] * len(rows)


class _DummyGraphSAGE:
    """CI stub for GraphSAGE embeddings."""

    def get_city_embedding(self, city: str):
        return None

    def get_all_embeddings(self) -> dict:
        return {}


class _DummyRecommendations:
    """CI stub for recommendation service."""

    def get_recommendations(self, req) -> list:
        return []


class _DummyTFT:
    """Stub returned when TFT fails to load."""

    def forecast(self, lane_id: str, horizon_weeks: int = 4) -> dict:
        return {
            "lane_id": lane_id,
            "horizon_weeks": horizon_weeks,
            "forecast": [],
            "historical": [],
            "lane_reliability": {"mape": 0, "reliability": "low", "bias_kg": 0},
            "model_used": "tft_unavailable",
        }

    def get_lane_reliability(self, lane_id: str) -> dict:
        return {"mape": 0, "reliability": "low", "bias_kg": 0}
