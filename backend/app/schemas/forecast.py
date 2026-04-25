"""
Pydantic v2 request / response models for the /api/forecast endpoint.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    """Parameters for a TFT temporal forecast."""

    lane_id: str
    horizon_weeks: int = Field(ge=4, le=12, default=4)


class ForecastPoint(BaseModel):
    """One forecast time-step with 7 calibrated quantile bands."""

    date: str
    q02: float
    q10: float
    q25: float
    q50: float
    q75: float
    q90: float
    q98: float
    low_confidence: bool


class HistoricalPoint(BaseModel):
    """One historical observation (used for overlay on the chart)."""

    date: str
    co2e_kg: float


class ForecastResponse(BaseModel):
    """Full forecast response including historical context."""

    lane_id: str
    horizon_weeks: int
    forecast: list[ForecastPoint]
    historical: list[HistoricalPoint]
    lane_reliability: dict
    model_used: str = "tft_best-82-0.1107"
    is_tft_fallback: bool = False
