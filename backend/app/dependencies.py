"""
FastAPI dependency-injection helpers.

Each function extracts a pre-initialised service / connection from
``request.app.state`` (populated during the lifespan startup).

NOTE: We use ``from __future__ import annotations`` and avoid importing
torch-dependent modules at the top level so that the router modules can
be loaded even before torch is fully initialised.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Request
import redis.asyncio as aioredis

from app.services.catboost_service import CatBoostService
from app.services.graphsage_service import GraphSAGEService
from app.services.recommendation_service import RecommendationService

if TYPE_CHECKING:
    from app.services.tft_service import TFTService


def get_catboost(request: Request) -> CatBoostService:
    return request.app.state.catboost


def get_tft(request: Request) -> "TFTService":
    return request.app.state.tft


def get_graphsage(request: Request) -> GraphSAGEService:
    return request.app.state.graphsage


def get_recommendations(request: Request) -> RecommendationService:
    return request.app.state.recommendations


def get_redis(request: Request) -> aioredis.Redis:
    return request.app.state.redis
