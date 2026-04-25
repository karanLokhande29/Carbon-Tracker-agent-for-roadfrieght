"""
Pydantic v2 models for analytics / data exploration endpoints.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class LaneSummary(BaseModel):
    """Enriched lane metadata for the map and selectors."""

    lane_id: str
    origin: str
    destination: str
    distance_km: float
    shipment_count: int
    avg_co2e_kg: float
    vehicle_types: list[str]
    reliability: Literal["good", "medium", "low"]
    mape: float
    bias_kg: float
    origin_lat: float
    origin_lon: float
    dest_lat: float
    dest_lon: float


class AnomalyWeek(BaseModel):
    """Pre-computed anomaly week summary."""

    date: str
    lane_count: int
    total_co2e: float
    vehicle_types: list[str]


class VehicleBreakdownMonth(BaseModel):
    """Monthly CO₂e aggregates split by vehicle type."""

    year_month: str
    vehicle_type: str
    total_co2e_kg: float
    avg_co2e_per_km: float
    avg_co2e_per_tonne: float
    shipment_count: int


class ModelMetrics(BaseModel):
    """Performance summary for a single ML model."""

    name: str
    model_type: str
    best_for: str
    inference_ms: int
    metrics: dict


class UMAPPoint(BaseModel):
    """2-D UMAP projection of a city embedding for the scatter plot."""

    city: str
    x: float
    y: float
    avg_co2e_kg: float
    total_shipments: int
    lat: float
    lon: float


class EntityMapeItem(BaseModel):
    """Per-lane MAPE entry for the entity MAPE bar chart."""

    lane_id: str
    origin: str
    destination: str
    mape: float
    reliability: Literal["good", "medium", "low"]
    bias_kg: float
