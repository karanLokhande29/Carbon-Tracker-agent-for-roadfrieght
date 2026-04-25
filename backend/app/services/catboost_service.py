"""
CatBoost prediction service — handles both the solo CatBoost model
and the hybrid GraphSAGE-CatBoost model.

Responsibilities:
  • Single-row & batch prediction via catboost.Pool
  • Virtual-ensemble confidence scoring
  • SHAP feature-attribution extraction
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from pathlib import Path
from typing import Any

import catboost
import numpy as np

logger = logging.getLogger(__name__)

# ── per-vehicle-type defaults for fuel_efficiency ─────────────────────────
_FUEL_EFFICIENCY_DEFAULTS: dict[str, float] = {
    "road_articulated_diesel": 2.8,
    "road_rigid_diesel": 4.0,
    "road_lcv_diesel": 8.0,
    "road_cng": 2.5,
    "road_rigid_electric": 4.2,
}

# ── fuel cost parameters for ₹ estimation ────────────────────────────────
_FUEL_COST: dict[str, dict] = {
    "road_articulated_diesel": {"km_per_unit": 3.5, "price_per_unit": 92},
    "road_rigid_diesel":       {"km_per_unit": 4.0, "price_per_unit": 92},
    "road_lcv_diesel":         {"km_per_unit": 8.0, "price_per_unit": 92},
    "road_cng":                {"km_per_unit": 2.5, "price_per_unit": 75},
    "road_rigid_electric":     {"km_per_unit": 1.2, "price_per_unit": 8},
}

# ── cyclical encoding constants ──────────────────────────────────────────
_ANNUAL_PERIOD = 365.25 / 7  # ≈ 52.178 weeks
_MONTHLY_PERIOD = 5          # 5-week short cycle


class CatBoostService:
    """CatBoost (solo) + hybrid (GraphSAGE-CatBoost) inference engine."""

    def __init__(self, model_path: str, hybrid_path: str, data_dir: str) -> None:
        t0 = time.time()

        # ── load CatBoost models ──────────────────────────────────────
        self._model = catboost.CatBoostRegressor()
        self._model.load_model(model_path)
        logger.info("Solo CatBoost loaded from %s", model_path)

        self._hybrid = catboost.CatBoostRegressor()
        self._hybrid.load_model(hybrid_path)
        logger.info("Hybrid CatBoost loaded from %s", hybrid_path)

        # ── load supporting JSON data ─────────────────────────────────
        data = Path(data_dir)

        with open(data / "feature_names.json") as f:
            fn = json.load(f)
        self._feature_names: list[str] = fn["catboost_features"]
        self._cat_features: list[str] = fn["categorical_features"]
        self._cat_indices: list[int] = [
            self._feature_names.index(c) for c in self._cat_features
        ]

        with open(data / "lane_metadata.json") as f:
            self._lane_meta: dict = json.load(f)

        with open(data / "category_mappings.json") as f:
            self._cat_mappings: dict = json.load(f)

        # ── virtual ensemble count from env ───────────────────────────
        self._ve_count = int(os.getenv("VIRTUAL_ENSEMBLE_COUNT", "10"))
        self._low_thresh = float(os.getenv("LOW_CONFIDENCE_THRESHOLD_KG", "1000.0"))

        logger.info(
            "CatBoostService ready in %.2fs  (features=%d, cat=%d, lanes=%d)",
            time.time() - t0,
            len(self._feature_names),
            len(self._cat_indices),
            len(self._lane_meta),
        )

    # ── public API ────────────────────────────────────────────────────

    def get_lane_metadata(self, lane_id: str) -> dict:
        """Return enriched lane info or raise KeyError."""
        if lane_id not in self._lane_meta:
            raise KeyError(f"Unknown lane_id: {lane_id}")
        return self._lane_meta[lane_id]

    def predict(self, req: Any) -> dict:
        """
        Run single-row CatBoost prediction with confidence scoring.

        Returns dict compatible with PredictResponse fields.
        """
        values, names = self._build_features(req)
        pool = self._make_pool([values])

        # ── point prediction ──────────────────────────────────────────
        pred_kg = float(self._model.predict(pool)[0])

        # ── confidence via virtual ensembles ───────────────────────────
        confidence_score, confidence_level = self._compute_confidence(pool)

        low_warn = pred_kg < self._low_thresh or confidence_level == "low"

        meta = self._lane_meta[req.lane_id]
        distance = meta["distance_km"]

        return {
            "prediction_kg": round(pred_kg, 2),
            "confidence_score": round(confidence_score, 4),
            "confidence_level": confidence_level,
            "low_confidence_warning": low_warn,
            "model_used": "catboost",
            "origin": meta["origin"],
            "destination": meta["destination"],
            "distance_km": distance,
            "fuel_cost_inr": round(self._fuel_cost(req.vehicle_type, distance), 2),
        }

    def predict_hybrid(self, req: Any, graphsage_service: Any = None) -> dict:
        """Predict using the hybrid GraphSAGE-CatBoost model (101 features)."""
        import math as _math

        meta = self._lane_meta[req.lane_id]
        week_of_month = ((req.week_of_year - 1) % 4) + 1
        fuel_eff = _FUEL_EFFICIENCY_DEFAULTS.get(req.vehicle_type, 3.5)
        avg_co2e = meta["avg_co2e_kg"]
        distance = meta["distance_km"]

        tw_inter = req.traffic_index * req.weather_index
        ft_inter = req.fuel_price_index * req.toll_cost_index
        rc_inter = req.route_risk_index * req.traffic_index
        dc_inter = req.driver_efficiency_index * req.weather_index
        tonne_km = req.weight_tons * distance
        fuel_consumed = distance / fuel_eff

        sin_week = _math.sin(2 * _math.pi * req.week_of_year / 5)
        cos_week = _math.cos(2 * _math.pi * req.week_of_year / 5)
        sin_month = _math.sin(2 * _math.pi * req.month / 12)
        cos_month = _math.cos(2 * _math.pi * req.month / 12)

        # GraphSAGE embeddings (32-dim each for origin + destination)
        orig_emb = [0.0] * 32
        dest_emb = [0.0] * 32
        if graphsage_service is not None:
            try:
                oe = graphsage_service.get_city_embedding(meta["origin"])
                de = graphsage_service.get_city_embedding(meta["destination"])
                if oe is not None:
                    orig_emb = oe.tolist()
                if de is not None:
                    dest_emb = de.tolist()
            except Exception:
                pass  # fallback: zeros

        # 101-feature vector matching hybrid model's feature_names_
        values = [
            req.lane_id,            # [0]  shipment_id  (use lane_id as proxy)
            req.lane_id,            # [1]  lane_id      (cat)
            meta["origin"],         # [2]  origin       (cat)
            meta["destination"],    # [3]  destination  (cat)
            distance,               # [4]  distance_km
            req.weight_tons,        # [5]  weight_tons
            req.vehicle_type,       # [6]  vehicle_type (cat)
            req.month,              # [7]  month
            req.week_of_year,       # [8]  week_of_year
            week_of_month,          # [9]  week_of_month
            sin_week,               # [10] sin_week
            cos_week,               # [11] cos_week
            req.traffic_index,      # [12] traffic_index
            req.weather_index,      # [13] weather_index
            req.load_factor,        # [14] load_factor
            fuel_eff,               # [15] fuel_efficiency
            req.fuel_price_index,   # [16] fuel_price_index
            req.toll_cost_index,    # [17] toll_cost_index
            req.driver_efficiency_index,  # [18]
            req.route_risk_index,   # [19] route_risk_index
            tw_inter,               # [20] traffic_weather_interaction
            ft_inter,               # [21] fuel_toll_interaction
            rc_inter,               # [22] risk_congestion_interaction
            dc_inter,               # [23] driver_context_interaction
            0,                      # [24] is_anomaly_week
            0,                      # [25] is_shipment_spike
            avg_co2e,               # [26] co2e_kg_lag_1
            avg_co2e,               # [27] co2e_kg_lag_4
            avg_co2e,               # [28] co2e_kg_lag_12
            avg_co2e,               # [29] co2e_kg_rollmean_4
            avg_co2e,               # [30] co2e_kg_rollmean_12
            0.0,                    # [31] co2e_kg_rollstd_4
            0.0,                    # [32] co2e_kg_rollstd_12
            sin_month,              # [33] sin_month
            cos_month,              # [34] cos_month
            tonne_km,               # [35] tonne_km
            fuel_consumed,          # [36] fuel_consumed_proxy
            *orig_emb,              # [37-68] orig_emb_0..31
            *dest_emb,              # [69-100] dest_emb_0..31
        ]

        # Build pool — hybrid has more cat features (shipment_id, lane_id, vehicle_type)
        hybrid_feature_names = self._hybrid.feature_names_
        cat_cols = ["shipment_id", "lane_id", "origin", "destination", "vehicle_type"]
        cat_idx = [hybrid_feature_names.index(c) for c in cat_cols if c in hybrid_feature_names]

        pool = catboost.Pool(
            data=[values],
            feature_names=hybrid_feature_names,
            cat_features=cat_idx,
        )

        pred_kg = float(self._hybrid.predict(pool)[0])
        confidence_score, confidence_level = 0.80, "medium"
        low_warn = pred_kg < self._low_thresh

        return {
            "prediction_kg": round(pred_kg, 2),
            "confidence_score": round(confidence_score, 4),
            "confidence_level": confidence_level,
            "low_confidence_warning": low_warn,
            "model_used": "hybrid_graphsage",
            "origin": meta["origin"],
            "destination": meta["destination"],
            "distance_km": distance,
            "fuel_cost_inr": round(self._fuel_cost(req.vehicle_type, distance), 2),
        }


    def predict_shap(self, req: Any) -> list[dict]:
        """
        Compute SHAP values for a single prediction. Returns top-10
        features sorted descending by |shap_value|.
        """
        values, _ = self._build_features(req)
        pool = self._make_pool([values])

        # CatBoost built-in SHAP — returns (n_samples, n_features + 1)
        # last column = base value (expected value / dataset mean)
        shap_matrix = self._model.get_feature_importance(
            type="ShapValues", data=pool
        )
        sv = shap_matrix[0]              # first (only) row
        feature_shap = sv[:-1]           # drop the base-value column

        pairs = []
        for idx, fname in enumerate(self._feature_names):
            val = float(feature_shap[idx])
            if abs(val) < 1e-8:
                continue
            pairs.append(
                {
                    "feature": fname,
                    "value": round(val, 4),
                    "direction": "increases" if val > 0 else "decreases",
                }
            )

        pairs.sort(key=lambda x: abs(x["value"]), reverse=True)
        return pairs[:10]

    def predict_batch(self, rows: list[dict]) -> list[float]:
        """
        Batch prediction for the counterfactual engine.
        Each dict in *rows* must contain the same keys as PredictRequest.
        Returns a flat list of CO₂e predictions in kg.
        """
        if not rows:
            return []

        all_values = []
        for row in rows:
            vals, _ = self._build_features_from_dict(row)
            all_values.append(vals)

        pool = self._make_pool(all_values)
        preds = self._model.predict(pool)
        return [round(float(p), 2) for p in preds]

    # ── internals ─────────────────────────────────────────────────────

    def _build_features(self, req: Any) -> tuple[list, list[str]]:
        """
        Construct a single feature vector (list of values) from a
        PredictRequest, matching the exact 32-column order in
        feature_names.json.
        """
        meta = self._lane_meta[req.lane_id]

        week_of_month = ((req.week_of_year - 1) % 4) + 1
        sin_time = math.sin(2 * math.pi * req.week_of_year / _ANNUAL_PERIOD)
        cos_time = math.cos(2 * math.pi * req.week_of_year / _ANNUAL_PERIOD)
        sin_week = math.sin(2 * math.pi * req.week_of_year / _MONTHLY_PERIOD)
        cos_week = math.cos(2 * math.pi * req.week_of_year / _MONTHLY_PERIOD)

        fuel_eff = _FUEL_EFFICIENCY_DEFAULTS.get(req.vehicle_type, 3.5)
        avg_co2e = meta["avg_co2e_kg"]

        # interaction terms (verified against original CSV data)
        tw_inter = req.traffic_index * req.weather_index
        ft_inter = req.fuel_price_index * req.toll_cost_index
        rc_inter = req.route_risk_index * req.traffic_index
        dc_inter = req.driver_efficiency_index * req.weather_index

        values = [
            req.lane_id,                    # lane_id            (cat)
            meta["origin"],                 # origin             (cat)
            meta["destination"],            # destination        (cat)
            req.vehicle_type,               # vehicle_type       (cat)
            meta["distance_km"],            # distance_km
            req.weight_tons,                # weight_tons
            req.month,                      # month
            req.week_of_year,               # week_of_year
            week_of_month,                  # week_of_month
            sin_time,                       # sin_time
            cos_time,                       # cos_time
            sin_week,                       # sin_week
            cos_week,                       # cos_week
            req.traffic_index,              # traffic_index
            req.weather_index,              # weather_index
            req.load_factor,                # load_factor
            fuel_eff,                       # fuel_efficiency
            req.fuel_price_index,           # fuel_price_index
            req.toll_cost_index,            # toll_cost_index
            req.driver_efficiency_index,    # driver_efficiency_index
            req.route_risk_index,           # route_risk_index
            tw_inter,                       # traffic_weather_interaction
            ft_inter,                       # fuel_toll_interaction
            rc_inter,                       # risk_congestion_interaction
            dc_inter,                       # driver_context_interaction
            avg_co2e,                       # co2e_kg_lag_1      (use lane avg)
            avg_co2e,                       # co2e_kg_lag_4
            avg_co2e,                       # co2e_kg_lag_12
            avg_co2e,                       # co2e_kg_rollmean_4
            avg_co2e,                       # co2e_kg_rollmean_12
            0,                              # is_anomaly_week
            0,                              # is_shipment_spike
        ]

        return values, self._feature_names

    def _build_features_from_dict(self, d: dict) -> tuple[list, list[str]]:
        """
        Same as _build_features but accepts a plain dict
        (used by predict_batch for counterfactuals).
        """
        lane_id = d["lane_id"]
        meta = self._lane_meta[lane_id]
        vehicle_type = d["vehicle_type"]
        month = d.get("month", 6)
        woy = d.get("week_of_year", 24)

        week_of_month = ((woy - 1) % 4) + 1
        sin_time = math.sin(2 * math.pi * woy / _ANNUAL_PERIOD)
        cos_time = math.cos(2 * math.pi * woy / _ANNUAL_PERIOD)
        sin_week = math.sin(2 * math.pi * woy / _MONTHLY_PERIOD)
        cos_week = math.cos(2 * math.pi * woy / _MONTHLY_PERIOD)

        fuel_eff = _FUEL_EFFICIENCY_DEFAULTS.get(vehicle_type, 3.5)
        avg_co2e = meta["avg_co2e_kg"]

        ti = d.get("traffic_index", 1.03)
        wi = d.get("weather_index", 1.0)
        fpi = d.get("fuel_price_index", 1.01)
        tci = d.get("toll_cost_index", 1.35)
        dei = d.get("driver_efficiency_index", 0.94)
        rri = d.get("route_risk_index", 1.08)
        lf = d.get("load_factor", 0.85)

        values = [
            lane_id,
            meta["origin"],
            meta["destination"],
            vehicle_type,
            meta["distance_km"],
            d.get("weight_tons", 15.0),
            month,
            woy,
            week_of_month,
            sin_time,
            cos_time,
            sin_week,
            cos_week,
            ti,
            wi,
            lf,
            fuel_eff,
            fpi,
            tci,
            dei,
            rri,
            ti * wi,
            fpi * tci,
            rri * ti,
            dei * wi,
            avg_co2e,
            avg_co2e,
            avg_co2e,
            avg_co2e,
            avg_co2e,
            0,
            0,
        ]
        return values, self._feature_names

    def _make_pool(self, rows: list[list]) -> catboost.Pool:
        """Create a catboost.Pool from a list of feature vectors."""
        return catboost.Pool(
            data=rows,
            feature_names=self._feature_names,
            cat_features=self._cat_indices,
        )

    def _compute_confidence(
        self, pool: catboost.Pool
    ) -> tuple[float, str]:
        """
        Virtual-ensemble uncertainty estimation.
        Returns (confidence_score, confidence_level).
        confidence_score = 1 - CV,  where CV = std / |mean|.
        """
        try:
            ve = self._model.virtual_ensembles_predict(
                pool,
                prediction_type="VirtualEnsembles",
                virtual_ensembles_count=self._ve_count,
            )
            # ve shape: (n_samples, ve_count)
            row = ve[0]
            mean_val = float(np.mean(row))
            std_val = float(np.std(row))
            cv = std_val / abs(mean_val) if abs(mean_val) > 1e-6 else 1.0
            score = max(0.0, min(1.0, 1.0 - cv))
        except Exception:
            logger.warning("Virtual ensemble failed — falling back to 0.80")
            score = 0.80

        if score >= 0.90:
            level = "high"
        elif score >= 0.80:
            level = "medium"
        else:
            level = "low"

        return score, level

    @staticmethod
    def _fuel_cost(vehicle_type: str, distance_km: float) -> float:
        """Estimate fuel cost in ₹ for a single shipment."""
        params = _FUEL_COST.get(vehicle_type)
        if params is None:
            return 0.0
        units_needed = distance_km / params["km_per_unit"]
        return units_needed * params["price_per_unit"]
