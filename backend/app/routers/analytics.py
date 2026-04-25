"""
/api/analytics — anomalies, vehicle breakdown, model metrics, entity MAPE.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends
import redis.asyncio as aioredis

from app.config import get_settings
from app.dependencies import get_redis
from app.schemas.analytics import (
    AnomalyWeek,
    EntityMapeItem,
    ModelMetrics,
    VehicleBreakdownMonth,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

# ── one-time data caches ──────────────────────────────────────────────────

_anomaly_cache: list[dict] | None = None
_breakdown_cache: list[dict] | None = None
_mape_cache: list[dict] | None = None


# ── routes ────────────────────────────────────────────────────────────────


@router.get("/anomalies", response_model=list[AnomalyWeek])
async def get_anomalies(
    rd: aioredis.Redis = Depends(get_redis),
):
    """Pre-computed anomaly weeks (from anomaly_data.json)."""
    global _anomaly_cache
    settings = get_settings()
    cache_key = "static:anomalies"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    if _anomaly_cache is None:
        with open(settings.resolved_data_dir / "anomaly_data.json") as f:
            _anomaly_cache = json.load(f)

    try:
        await rd.set(cache_key, json.dumps(_anomaly_cache), ex=settings.CACHE_TTL_STATIC)
    except Exception:
        pass

    return _anomaly_cache


@router.get("/vehicle-breakdown", response_model=list[VehicleBreakdownMonth])
async def get_vehicle_breakdown(
    rd: aioredis.Redis = Depends(get_redis),
):
    """
    Monthly CO₂e breakdown by vehicle type — includes per-km and
    per-tonne normalised values for the frontend chart.
    """
    global _breakdown_cache
    settings = get_settings()
    cache_key = "static:vehicle_breakdown"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    if _breakdown_cache is None:
        csv_path = settings.resolved_data_dir / "india_freight_emissions.csv"
        if not csv_path.exists():
            logger.warning("CSV %s not found — returning empty breakdown", csv_path)
            _breakdown_cache = []
        else:
            df = pd.read_csv(
                csv_path,
                usecols=["date", "vehicle_type", "co2e_kg", "distance_km", "weight_tons"],
                parse_dates=["date"],
            )
            df["year_month"] = df["date"].dt.to_period("M").astype(str)

            grouped = (
                df.groupby(["year_month", "vehicle_type"])
                .agg(
                    total_co2e_kg=("co2e_kg", "sum"),
                    total_distance=("distance_km", "sum"),
                    total_weight=("weight_tons", "sum"),
                    shipment_count=("co2e_kg", "count"),
                )
                .reset_index()
            )
            grouped["avg_co2e_per_km"] = (
                grouped["total_co2e_kg"] / grouped["total_distance"].replace(0, 1)
            ).round(4)
            grouped["avg_co2e_per_tonne"] = (
                grouped["total_co2e_kg"] / grouped["total_weight"].replace(0, 1)
            ).round(4)
            grouped["total_co2e_kg"] = grouped["total_co2e_kg"].round(1)

            _breakdown_cache = grouped[
                [
                    "year_month",
                    "vehicle_type",
                    "total_co2e_kg",
                    "avg_co2e_per_km",
                    "avg_co2e_per_tonne",
                    "shipment_count",
                ]
            ].to_dict(orient="records")

    try:
        await rd.set(
            cache_key, json.dumps(_breakdown_cache), ex=settings.CACHE_TTL_STATIC
        )
    except Exception:
        pass

    return _breakdown_cache


@router.get("/model-metrics", response_model=list[ModelMetrics])
async def get_model_metrics():
    """Performance metrics for all 3 ML models."""
    settings = get_settings()
    with open(settings.resolved_data_dir / "model_config.json") as f:
        raw = json.load(f)

    result: list[dict] = []
    for name, info in raw.items():
        result.append(
            {
                "name": name,
                "model_type": info.get("type", "unknown"),
                "best_for": info.get("best_for", ""),
                "inference_ms": info.get("inference_ms", 0),
                "metrics": info.get("metrics", {}),
            }
        )
    return result


@router.get("/entity-mape", response_model=list[EntityMapeItem])
async def get_entity_mape(
    rd: aioredis.Redis = Depends(get_redis),
):
    """Per-lane MAPE for the entity MAPE bar chart (sorted ascending)."""
    global _mape_cache
    settings = get_settings()
    cache_key = "static:entity_mape"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    if _mape_cache is None:
        with open(settings.resolved_data_dir / "entity_mape_lookup.json") as f:
            mape_raw = json.load(f)
        with open(settings.resolved_data_dir / "lane_metadata.json") as f:
            lane_meta = json.load(f)

        items: list[dict] = []
        for lid, entry in mape_raw.items():
            meta = lane_meta.get(lid, {})
            items.append(
                {
                    "lane_id": lid,
                    "origin": meta.get("origin", ""),
                    "destination": meta.get("destination", ""),
                    "mape": entry["mape"],
                    "reliability": entry["reliability"],
                    "bias_kg": entry["bias_kg"],
                }
            )
        items.sort(key=lambda x: x["mape"])
        _mape_cache = items

    try:
        await rd.set(cache_key, json.dumps(_mape_cache), ex=settings.CACHE_TTL_STATIC)
    except Exception:
        pass

    return _mape_cache
