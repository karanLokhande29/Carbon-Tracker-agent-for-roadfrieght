"""
Pydantic v2 request / response models for the /api/predict endpoints.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy-loaded lane metadata (read once, reused for every request validation)
# ---------------------------------------------------------------------------
_lane_metadata: dict | None = None
_LANE_META_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "lane_metadata.json"


def _get_lane_metadata() -> dict:
    global _lane_metadata
    if _lane_metadata is None:
        with open(_LANE_META_PATH, "r") as f:
            _lane_metadata = json.load(f)
    return _lane_metadata


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ShapFeature(BaseModel):
    """Single SHAP feature attribution."""
    feature: str
    value: float
    direction: Literal["increases", "decreases"]


class PredictRequest(BaseModel):
    """Input parameters for a single CO₂e prediction."""

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

    model: Literal["catboost", "hybrid"] = "catboost"
    include_shap: bool = False

    @model_validator(mode="before")
    @classmethod
    def fill_lane_defaults(cls, values: dict) -> dict:
        """
        Validate that lane_id exists in lane_metadata.json.
        No mutation needed — origin / destination / distance are resolved
        at prediction time by the service layer.
        """
        lane_id = values.get("lane_id")
        if lane_id is not None:
            meta = _get_lane_metadata()
            if lane_id not in meta:
                valid = sorted(meta.keys())[:5]
                raise ValueError(
                    f"Unknown lane_id '{lane_id}'. "
                    f"Valid examples: {valid}"
                )
        return values


class PredictResponse(BaseModel):
    """Result of a single CO₂e prediction."""

    prediction_kg: float
    confidence_score: float
    confidence_level: Literal["high", "medium", "low"]
    low_confidence_warning: bool
    model_used: str
    origin: str
    destination: str
    distance_km: float
    fuel_cost_inr: float
    shap_features: Optional[list[ShapFeature]] = None


class CompareRequest(BaseModel):
    """Side-by-side scenario comparison."""
    scenario_a: PredictRequest
    scenario_b: PredictRequest


class CompareResponse(BaseModel):
    """Result of an A/B scenario comparison."""
    a: PredictResponse
    b: PredictResponse
    delta_kg: float
    delta_pct: float
