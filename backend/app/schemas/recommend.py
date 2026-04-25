"""
Pydantic v2 request / response models for the /api/recommend endpoint.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class RecommendRequest(BaseModel):
    """
    Inputs for generating counterfactual recommendations.
    Mirrors PredictRequest fields plus the baseline prediction result.
    """

    lane_id: str
    vehicle_type: Literal[
        "road_articulated_diesel",
        "road_rigid_diesel",
        "road_lcv_diesel",
        "road_cng",
        "road_rigid_electric",
    ]
    weight_tons: float = Field(ge=1.0, le=40.0)
    load_factor: float = Field(ge=0.3, le=1.5)
    traffic_index: float = Field(ge=0.8, le=1.3, default=1.03)
    weather_index: float = Field(ge=0.8, le=1.2, default=1.0)
    fuel_price_index: float = Field(ge=0.9, le=1.2, default=1.01)
    toll_cost_index: float = Field(ge=1.0, le=1.5, default=1.35)
    driver_efficiency_index: float = Field(ge=0.8, le=1.1, default=0.94)
    route_risk_index: float = Field(ge=0.9, le=1.2, default=1.08)
    month: int = Field(ge=1, le=12, default=6)
    week_of_year: int = Field(ge=1, le=52, default=24)

    baseline_prediction_kg: float = Field(
        gt=0,
        description="CO₂e in kg from the prior /api/predict call",
    )


class RecommendationItem(BaseModel):
    """A single counterfactual recommendation."""

    rank: int
    action: str
    action_type: Literal[
        "vehicle_switch",
        "load_increase",
        "timing_shift",
        "driver_efficiency",
        "lane_switch",
    ]
    co2e_delta_kg: float
    co2e_delta_pct: float
    cost_delta_inr: float
    impact: Literal["high", "medium", "low"]
    effort: Literal["high", "medium", "low"]
    modified_inputs: dict
    model_used: str
    lane_info: Optional[dict] = None


class RecommendResponse(BaseModel):
    """Top-5 ranked recommendations with baseline context."""

    baseline_kg: float
    recommendations: list[RecommendationItem]
    best_saving_kg: float
    best_saving_pct: float
