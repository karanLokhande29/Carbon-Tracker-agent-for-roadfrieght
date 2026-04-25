"""
/api/lanes — lane metadata, detail, and UMAP embedding endpoints.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
import redis.asyncio as aioredis

from app.config import get_settings
from app.dependencies import get_graphsage, get_redis
from app.schemas.analytics import LaneSummary, UMAPPoint
from app.services.graphsage_service import GraphSAGEService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lanes", tags=["Lanes"])

# ── helpers to load static JSON (only once per process) ──────────────────

_lanes_cache: list[dict] | None = None


def _load_lanes() -> list[dict]:
    global _lanes_cache
    if _lanes_cache is not None:
        return _lanes_cache

    settings = get_settings()
    data = settings.resolved_data_dir

    with open(data / "lane_metadata.json") as f:
        lane_meta = json.load(f)
    with open(data / "entity_mape_lookup.json") as f:
        mape_lookup = json.load(f)
    with open(data / "city_coordinates.json") as f:
        city_coords = json.load(f)

    result: list[dict] = []
    for lid, meta in lane_meta.items():
        mape_entry = mape_lookup.get(
            lid, {"mape": 25.0, "reliability": "medium", "bias_kg": 0.0}
        )
        origin_geo = city_coords.get(meta["origin"], [0.0, 0.0])
        dest_geo = city_coords.get(meta["destination"], [0.0, 0.0])
        result.append(
            {
                "lane_id": lid,
                "origin": meta["origin"],
                "destination": meta["destination"],
                "distance_km": meta["distance_km"],
                "shipment_count": meta["shipment_count"],
                "avg_co2e_kg": meta["avg_co2e_kg"],
                "vehicle_types": meta["vehicle_types"],
                "reliability": mape_entry["reliability"],
                "mape": mape_entry["mape"],
                "bias_kg": mape_entry["bias_kg"],
                "origin_lat": origin_geo[0],
                "origin_lon": origin_geo[1],
                "dest_lat": dest_geo[0],
                "dest_lon": dest_geo[1],
            }
        )

    result.sort(key=lambda x: x["lane_id"])
    _lanes_cache = result
    return result


# ── routes ────────────────────────────────────────────────────────────────


@router.get("", response_model=list[LaneSummary])
async def get_lanes(
    rd: aioredis.Redis = Depends(get_redis),
):
    """Return all 140 lanes with metadata, coordinates, and reliability."""
    settings = get_settings()
    cache_key = "static:lanes"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    data = _load_lanes()

    try:
        await rd.set(cache_key, json.dumps(data), ex=settings.CACHE_TTL_STATIC)
    except Exception:
        pass

    return data


@router.get("/{lane_id}", response_model=LaneSummary)
async def get_lane_detail(lane_id: str):
    """Single lane full detail."""
    lanes = _load_lanes()
    for lane in lanes:
        if lane["lane_id"] == lane_id:
            return lane
    raise HTTPException(status_code=404, detail=f"Lane {lane_id} not found")


@router.get("/embeddings/umap", response_model=list[UMAPPoint])
async def get_umap(
    gs: GraphSAGEService = Depends(get_graphsage),
    rd: aioredis.Redis = Depends(get_redis),
):
    """UMAP 2-D projection of city embeddings for the scatter plot."""
    settings = get_settings()
    cache_key = "static:umap"

    try:
        cached = await rd.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    data = gs.get_umap_projection()

    try:
        await rd.set(cache_key, json.dumps(data), ex=settings.CACHE_TTL_STATIC * 24)
    except Exception:
        pass

    return data
