"""
/api/forecast — TFT temporal forecasting endpoint.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Query
import redis.asyncio as aioredis

from app.config import get_settings
from app.dependencies import get_tft, get_redis
from app.schemas.forecast import ForecastResponse
from app.services.tft_service import TFTService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Forecast"])


@router.get("/forecast/{lane_id}", response_model=ForecastResponse)
async def forecast(
    lane_id: str,
    horizon: int = Query(4, ge=4, le=12, description="Forecast horizon in weeks"),
    tft: TFTService = Depends(get_tft),
    rd: aioredis.Redis = Depends(get_redis),
):
    """
    Produce a 4–12 week quantile forecast for the specified lane
    using the Temporal Fusion Transformer.
    """
    settings = get_settings()
    cache_key = f"forecast:{lane_id}:{horizon}"

    # ── cache check ───────────────────────────────────────────────
    try:
        cached = await rd.get(cache_key)
        if cached:
            return ForecastResponse(**json.loads(cached))
    except Exception:
        pass

    # ── run forecast ──────────────────────────────────────────────
    result = tft.forecast(lane_id, horizon_weeks=horizon)

    logger.info(
        "forecast  lane=%s  horizon=%dw  points=%d",
        lane_id, horizon, len(result.get("forecast", [])),
    )

    response = ForecastResponse(**result)

    # ── cache set (1 hr) ──────────────────────────────────────────
    try:
        await rd.set(
            cache_key,
            response.model_dump_json(),
            ex=settings.CACHE_TTL_STATIC,
        )
    except Exception:
        pass

    return response
