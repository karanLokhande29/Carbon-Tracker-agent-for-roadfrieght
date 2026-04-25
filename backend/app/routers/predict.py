"""
/api/predict — CO₂e prediction endpoints (CatBoost + Hybrid).
"""

from __future__ import annotations

import hashlib
import json
import logging
import time

from fastapi import APIRouter, Depends
import redis.asyncio as aioredis

from app.config import get_settings
from app.dependencies import get_catboost, get_redis, get_graphsage
from app.schemas.predict import (
    CompareRequest,
    CompareResponse,
    PredictRequest,
    PredictResponse,
    ShapFeature,
)
from app.services.catboost_service import CatBoostService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Prediction"])


def _cache_key(prefix: str, req: PredictRequest) -> str:
    """Deterministic cache key from the request payload."""
    raw = req.model_dump_json(exclude={"include_shap"})
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{prefix}:{digest}"


@router.post("/predict", response_model=PredictResponse)
async def predict(
    req: PredictRequest,
    cb: CatBoostService = Depends(get_catboost),
    rd: aioredis.Redis = Depends(get_redis),
    gs=Depends(get_graphsage),
):
    """
    Single-shipment CO₂e prediction with optional SHAP attribution.
    Uses CatBoost (default) or the hybrid GraphSAGE-CatBoost model.
    """
    settings = get_settings()
    key = _cache_key("predict", req)

    # ── cache check ───────────────────────────────────────────────
    try:
        cached = await rd.get(key)
        if cached:
            data = json.loads(cached)
            # re-attach SHAP if requested and not in cache
            if req.include_shap and data.get("shap_features") is None:
                pass  # fall through to compute
            else:
                return PredictResponse(**data)
    except Exception:
        pass  # Redis down → compute fresh

    # ── predict ───────────────────────────────────────────────────
    t0 = time.time()
    if req.model == "hybrid":
        result = cb.predict_hybrid(req, graphsage_service=gs)
    else:
        result = cb.predict(req)

    # ── optional SHAP (solo CatBoost only) ───────────────────────────────────
    shap_features = None
    if req.include_shap and req.model != "hybrid":
        raw_shap = cb.predict_shap(req)
        shap_features = [ShapFeature(**s) for s in raw_shap]
    result["shap_features"] = shap_features

    elapsed = time.time() - t0
    logger.info(
        "predict  lane=%s model=%s  %.0fkg  %.0fms",
        req.lane_id, req.model, result["prediction_kg"], elapsed * 1000,
    )

    # ── cache set ─────────────────────────────────────────────────
    try:
        await rd.set(key, json.dumps(result, default=str), ex=settings.CACHE_TTL_PREDICT)
    except Exception:
        pass

    return PredictResponse(**result)


@router.post("/predict/compare", response_model=CompareResponse)
async def predict_compare(
    body: CompareRequest,
    cb: CatBoostService = Depends(get_catboost),
    rd: aioredis.Redis = Depends(get_redis),
):
    """Run two scenarios side-by-side and return the delta."""
    result_a = cb.predict(body.scenario_a)
    result_b = cb.predict(body.scenario_b)

    delta_kg = result_b["prediction_kg"] - result_a["prediction_kg"]
    base = result_a["prediction_kg"] or 1.0
    delta_pct = round(delta_kg / base * 100, 2)

    result_a["shap_features"] = None
    result_b["shap_features"] = None

    return CompareResponse(
        a=PredictResponse(**result_a),
        b=PredictResponse(**result_b),
        delta_kg=round(delta_kg, 2),
        delta_pct=delta_pct,
    )
