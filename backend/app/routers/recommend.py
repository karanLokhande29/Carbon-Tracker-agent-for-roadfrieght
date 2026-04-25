"""
/api/recommend — counterfactual recommendation endpoint.
"""

from __future__ import annotations

import hashlib
import json
import logging

from fastapi import APIRouter, Depends
import redis.asyncio as aioredis

from app.config import get_settings
from app.dependencies import get_recommendations, get_redis
from app.schemas.recommend import (
    RecommendationItem,
    RecommendRequest,
    RecommendResponse,
)
from app.services.recommendation_service import RecommendationService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Recommendations"])


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    req: RecommendRequest,
    rec_svc: RecommendationService = Depends(get_recommendations),
    rd: aioredis.Redis = Depends(get_redis),
):
    """
    Generate top-5 CO₂e reduction recommendations for the given
    shipment parameters and baseline prediction.
    """
    settings = get_settings()

    # ── cache ─────────────────────────────────────────────────────
    raw = req.model_dump_json()
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    cache_key = f"recommend:{digest}"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return RecommendResponse(**json.loads(cached))
    except Exception:
        pass

    # ── generate ──────────────────────────────────────────────────
    recs_raw = rec_svc.generate(req, req.baseline_prediction_kg)
    recs = [RecommendationItem(**r) for r in recs_raw]

    best_kg = min((r.co2e_delta_kg for r in recs), default=0.0)
    best_pct = min((r.co2e_delta_pct for r in recs), default=0.0)

    response = RecommendResponse(
        baseline_kg=req.baseline_prediction_kg,
        recommendations=recs,
        best_saving_kg=round(abs(best_kg), 2),
        best_saving_pct=round(abs(best_pct), 2),
    )

    logger.info(
        "recommend  lane=%s  baseline=%.0fkg  recs=%d  best_save=%.1f%%",
        req.lane_id, req.baseline_prediction_kg, len(recs), abs(best_pct),
    )

    # ── cache set ─────────────────────────────────────────────────
    try:
        await rd.set(
            cache_key,
            response.model_dump_json(),
            ex=settings.CACHE_TTL_PREDICT,
        )
    except Exception:
        pass

    return response
