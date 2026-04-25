"""
Recommendation engine — generates top-5 counterfactual actions.

Each variant modifies a single (or few) input parameters from the baseline
prediction, re-predicts with CatBoost, and ranks by CO₂e % saving.
"""

from __future__ import annotations

import copy
import logging
from typing import Any

from app.services.catboost_service import CatBoostService
from app.services.graphsage_service import GraphSAGEService

logger = logging.getLogger(__name__)

# ── fuel cost look-up (₹ per trip) ────────────────────────────────────────
_FUEL_COST: dict[str, dict] = {
    "road_articulated_diesel": {"km_per_unit": 3.5, "price_per_unit": 92},
    "road_rigid_diesel":       {"km_per_unit": 4.0, "price_per_unit": 92},
    "road_lcv_diesel":         {"km_per_unit": 8.0, "price_per_unit": 92},
    "road_cng":                {"km_per_unit": 2.5, "price_per_unit": 75},
    "road_rigid_electric":     {"km_per_unit": 1.2, "price_per_unit": 8},
}

_DIESEL_TYPES = {"road_articulated_diesel", "road_rigid_diesel", "road_lcv_diesel"}


class RecommendationService:
    """Counterfactual-based recommendation generator."""

    def __init__(
        self, catboost: CatBoostService, graphsage: GraphSAGEService
    ) -> None:
        self.catboost = catboost
        self.graphsage = graphsage

    # ── public ────────────────────────────────────────────────────────

    def generate(self, req: Any, baseline_kg: float) -> list[dict]:
        """
        Build up to 6 counterfactual variants, batch-predict, rank by
        CO₂e % saving, and return the top 5.
        """
        base_dict = self._req_to_dict(req)
        base_distance = self.catboost.get_lane_metadata(req.lane_id)["distance_km"]
        base_cost = self._compute_fuel_cost(req.vehicle_type, base_distance)

        variants: list[dict] = []  # {label, type, modified, dict}

        # 1. Switch to CNG (if current is diesel)
        if req.vehicle_type in _DIESEL_TYPES:
            d = copy.deepcopy(base_dict)
            d["vehicle_type"] = "road_cng"
            variants.append(
                {
                    "label": "Switch to CNG",
                    "type": "vehicle_switch",
                    "modified": {"vehicle_type": "road_cng"},
                    "dict": d,
                }
            )

        # 2. Switch to electric (if current is diesel)
        if req.vehicle_type in _DIESEL_TYPES:
            d = copy.deepcopy(base_dict)
            d["vehicle_type"] = "road_rigid_electric"
            variants.append(
                {
                    "label": "Switch to Electric",
                    "type": "vehicle_switch",
                    "modified": {"vehicle_type": "road_rigid_electric"},
                    "dict": d,
                }
            )

        # 3. Increase load_factor by +0.15 (cap at 1.4)
        new_lf = min(req.load_factor + 0.15, 1.4)
        if new_lf > req.load_factor + 0.01:
            d = copy.deepcopy(base_dict)
            d["load_factor"] = round(new_lf, 2)
            variants.append(
                {
                    "label": f"Increase load factor to {new_lf:.2f}",
                    "type": "load_increase",
                    "modified": {"load_factor": round(new_lf, 2)},
                    "dict": d,
                }
            )

        # 4. Off-peak routing (traffic_index → 0.88)
        if req.traffic_index > 0.89:
            d = copy.deepcopy(base_dict)
            d["traffic_index"] = 0.88
            variants.append(
                {
                    "label": "Shift to off-peak routing (traffic 0.88)",
                    "type": "timing_shift",
                    "modified": {"traffic_index": 0.88},
                    "dict": d,
                }
            )

        # 5. Improve driver efficiency (→ 1.08)
        if req.driver_efficiency_index < 1.07:
            d = copy.deepcopy(base_dict)
            d["driver_efficiency_index"] = 1.08
            variants.append(
                {
                    "label": "Optimise driver efficiency to 1.08",
                    "type": "driver_efficiency",
                    "modified": {"driver_efficiency_index": 1.08},
                    "dict": d,
                }
            )

        # ── batch predict all catboost variants ───────────────────────
        cb_dicts = [v["dict"] for v in variants]
        cb_preds = self.catboost.predict_batch(cb_dicts) if cb_dicts else []

        recommendations: list[dict] = []
        for i, v in enumerate(variants):
            pred_kg = cb_preds[i]
            delta_kg = pred_kg - baseline_kg
            delta_pct = (delta_kg / baseline_kg * 100) if baseline_kg else 0.0
            impact, effort = self._classify_impact_effort(delta_pct, v["type"])
            new_vtype = v["dict"]["vehicle_type"]
            new_cost = self._compute_fuel_cost(new_vtype, base_distance)

            recommendations.append(
                {
                    "rank": 0,  # filled later after sorting
                    "action": v["label"],
                    "action_type": v["type"],
                    "co2e_delta_kg": round(delta_kg, 2),
                    "co2e_delta_pct": round(delta_pct, 2),
                    "cost_delta_inr": round(new_cost - base_cost, 2),
                    "impact": impact,
                    "effort": effort,
                    "modified_inputs": v["modified"],
                    "model_used": "catboost",
                    "lane_info": None,
                }
            )

        # Lane-switch (reroute) recommendations are intentionally disabled.
        # The GraphSAGE similarity engine is still available for other uses.

        # ── filter to savings only, sort, rank, take top 5 ────────────
        savings = [r for r in recommendations if r["co2e_delta_kg"] < 0]
        savings.sort(key=lambda r: r["co2e_delta_pct"])  # most negative first
        for i, r in enumerate(savings):
            r["rank"] = i + 1

        return savings[:5]

    # ── helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _req_to_dict(req: Any) -> dict:
        """Convert a PredictRequest / RecommendRequest to a plain dict."""
        return {
            "lane_id": req.lane_id,
            "vehicle_type": req.vehicle_type,
            "weight_tons": req.weight_tons,
            "load_factor": req.load_factor,
            "traffic_index": req.traffic_index,
            "weather_index": req.weather_index,
            "fuel_price_index": req.fuel_price_index,
            "toll_cost_index": req.toll_cost_index,
            "driver_efficiency_index": req.driver_efficiency_index,
            "route_risk_index": req.route_risk_index,
            "month": req.month,
            "week_of_year": req.week_of_year,
        }

    @staticmethod
    def _compute_fuel_cost(vehicle_type: str, distance_km: float) -> float:
        """Fuel cost in ₹ for one trip."""
        p = _FUEL_COST.get(vehicle_type)
        if p is None:
            return 0.0
        return (distance_km / p["km_per_unit"]) * p["price_per_unit"]

    @staticmethod
    def _classify_impact_effort(
        delta_pct: float, action_type: str
    ) -> tuple[str, str]:
        """
        Impact:  High >20% | Med 10-20% | Low <10%  (absolute value)
        Effort:  High = vehicle/lane switch | Med = load/timing | Low = driver
        """
        abs_pct = abs(delta_pct)
        if abs_pct > 20:
            impact = "high"
        elif abs_pct > 10:
            impact = "medium"
        else:
            impact = "low"

        if action_type in ("vehicle_switch", "lane_switch"):
            effort = "high"
        elif action_type in ("load_increase", "timing_shift"):
            effort = "medium"
        else:
            effort = "low"

        return impact, effort
