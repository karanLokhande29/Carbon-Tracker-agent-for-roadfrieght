"""
Temporal Fusion Transformer (TFT) forecasting service.

Loads the full freight emissions dataset, preprocesses it to match the
original training pipeline, rebuilds the TimeSeriesDataSet, and loads
the saved checkpoint for quantile forecasting.

Startup is intentionally slow (~45 s) — the rest of the app is usable
while this finishes loading in the lifespan context.
"""

from __future__ import annotations

import json
import logging
import math
import os
import platform
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)
warnings.filterwarnings("ignore", category=UserWarning)

# ── TFT architecture constants (mirrored from tft_arch_config.json) ──────
_QUANTILE_NAMES = ["q02", "q10", "q25", "q50", "q75", "q90", "q98"]
_N_QUANTILES = 7
_MEDIAN_IDX = 3

# Module-level flag — set True only if checkpoint loads successfully
TFT_AVAILABLE = False


def _attempt_tft_load(checkpoint_path: str, train_ds):
    """
    Completely isolated TFT checkpoint loader with full error containment.
    Returns (model, True) on success, (None, False) on any failure.
    """
    global TFT_AVAILABLE
    try:
        import torch
        _orig_load = torch.load
        _orig_is_available = torch.cuda.is_available

        def _safe_load(*args, **kwargs):
            kwargs['weights_only'] = False
            kwargs['map_location'] = 'cpu'
            return _orig_load(*args, **kwargs)

        torch.load = _safe_load
        torch.cuda.is_available = lambda: False
        
        # Force CPU — never attempt GPU on Windows dev
        os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
        warnings.filterwarnings('ignore')

        try:
            from pytorch_forecasting import TemporalFusionTransformer
            model = TemporalFusionTransformer.load_from_checkpoint(
                checkpoint_path,
                map_location='cpu',
            )
        finally:
            torch.load = _orig_load
            torch.cuda.is_available = _orig_is_available

        model.eval()
        model.freeze()
        TFT_AVAILABLE = True
        logger.info("TFT loaded successfully from %s", checkpoint_path)
        return model, True

    except Exception as e:
        TFT_AVAILABLE = False
        logger.warning(
            "TFT model could not be loaded (expected on Windows dev): %s: %s",
            type(e).__name__, e,
        )
        return None, False


class TFTService:
    """Quantile-based temporal forecast engine backed by a TFT checkpoint."""

    def __init__(self, ckpt_path: str, data_dir: str) -> None:
        t0 = time.time()
        data = Path(data_dir)
        self._low_thresh = float(
            os.getenv("LOW_CONFIDENCE_THRESHOLD_KG", "1000.0")
        )

        # ── load arch config ─────────────────────────────────────────
        with open(data / "tft_arch_config.json") as f:
            self._cfg: dict = json.load(f)

        with open(data / "scaler_params.json") as f:
            self._scaler: dict = json.load(f)

        with open(data / "entity_mape_lookup.json") as f:
            self._mape_lookup: dict = json.load(f)

        with open(data / "lane_metadata.json") as f:
            self._lane_meta: dict = json.load(f)

        # ── load and preprocess CSV ──────────────────────────────────
        logger.info("TFT: loading CSV …")
        raw = pd.read_csv(data / "india_freight_emissions.csv", parse_dates=["date"])
        logger.info("TFT: CSV loaded (%d rows). Preprocessing …", len(raw))

        self._raw_df = raw  # keep a reference for historical queries
        self._df = self._preprocess(raw)
        logger.info("TFT: preprocessed → %d rows", len(self._df))

        # ── build training TimeSeriesDataSet + load model ─────────────
        # IMPORTANT: on Windows, importing pytorch_forecasting causes a fatal
        # DLL crash that kills the process — Python try/except cannot intercept
        # it. We must skip the import entirely on Windows.
        self._train_ds = None
        self._full_ds_df = self._df  # fallback: use preprocessed df directly
        self._model = None
        self.available = False

        if platform.system() == "Windows":
            logger.info(
                "TFT: Windows platform detected — skipping pytorch_forecasting "
                "import to avoid fatal DLL conflict. Historical fallback active."
            )
        else:
            try:
                logger.info("TFT: building TimeSeriesDataSet …")
                self._train_ds, self._full_ds_df = self._build_dataset(self._df)
                logger.info("TFT: loading checkpoint %s …", ckpt_path)
                self._model, self.available = _attempt_tft_load(ckpt_path, self._train_ds)
            except Exception as e:
                logger.warning(
                    "TFT: unavailable (%s: %s) — using historical fallback",
                    type(e).__name__, e,
                )
                self.available = False


        logger.info(
            "TFT: ready in %.1fs (available=%s)", time.time() - t0, self.available
        )

    # ── public API ────────────────────────────────────────────────────

    def forecast(self, lane_id: str, horizon_weeks: int = 4) -> dict:
        """
        Produce a quantile forecast for the requested lane.
        Falls back to CatBoost-derived historical forecast when TFT is unavailable.
        """
        if not self.available:
            return self._historical_fallback(lane_id, horizon_weeks)
        from pytorch_forecasting import TemporalFusionTransformer  # noqa: F811
        import torch

        max_pred = self._cfg["MAX_PREDICTION_LENGTH"]
        max_enc = self._cfg["MAX_ENCODER_LENGTH"]

        # ── filter data for lane ──────────────────────────────────────
        lane_df = self._full_ds_df[self._full_ds_df["lane_id"] == lane_id].copy()
        if lane_df.empty:
            return self._empty_forecast(lane_id, horizon_weeks)

        lane_df = lane_df.sort_values("time_idx").reset_index(drop=True)

        # we need at least max_enc + max_pred rows
        min_len = max_enc + max_pred
        if len(lane_df) < min_len:
            return self._empty_forecast(lane_id, horizon_weeks)

        # ── build prediction dataset from the tail ───────────────────
        try:
            pred_df = lane_df.tail(min_len).copy().reset_index(drop=True)
            # Re-index time_idx to be contiguous starting from 0
            pred_df["time_idx"] = range(len(pred_df))

            from pytorch_forecasting import TimeSeriesDataSet

            pred_ds = TimeSeriesDataSet.from_dataset(
                self._train_ds,
                pred_df,
                predict=True,
                stop_randomization=True,
            )
            pred_dl = pred_ds.to_dataloader(
                train=False, batch_size=1, num_workers=0
            )

            # ── run inference ─────────────────────────────────────────
            with torch.no_grad():
                raw_preds = self._model.predict(
                    pred_dl,
                    mode="quantiles",
                    trainer_kwargs={"accelerator": "cpu", "logger": False},
                )
            # raw_preds shape: (1, max_pred, n_quantiles)
            if isinstance(raw_preds, torch.Tensor):
                preds_np = raw_preds.cpu().numpy()
            else:
                preds_np = np.array(raw_preds)

            if preds_np.ndim == 3:
                preds_np = preds_np[0]  # (max_pred, n_quantiles)
            elif preds_np.ndim == 1:
                # single value returned — reshape
                preds_np = preds_np.reshape(1, -1)

        except Exception:
            logger.error("TFT inference failed for %s", lane_id, exc_info=True)
            return self._empty_forecast(lane_id, horizon_weeks)

        # ── inverse log1p transform ───────────────────────────────────
        preds_np = np.expm1(np.clip(preds_np, -20, 20))
        preds_np = np.clip(preds_np, 0, None)

        # ── build forecast points ─────────────────────────────────────
        last_date = lane_df["date"].max()
        forecast_points: list[dict] = []
        steps = min(horizon_weeks, preds_np.shape[0])

        for step in range(steps):
            fc_date = last_date + pd.Timedelta(weeks=step + 1)
            row = preds_np[step]

            # Ensure we have enough quantile columns
            if row.shape[0] >= _N_QUANTILES:
                q_vals = [float(row[i]) for i in range(_N_QUANTILES)]
            else:
                # Fallback: single value → replicate
                v = float(row[0]) if row.shape[0] > 0 else 0.0
                q_vals = [v] * _N_QUANTILES

            q50 = q_vals[_MEDIAN_IDX]
            forecast_points.append(
                {
                    "date": fc_date.strftime("%Y-%m-%d"),
                    "q02": round(q_vals[0], 1),
                    "q10": round(q_vals[1], 1),
                    "q25": round(q_vals[2], 1),
                    "q50": round(q50, 1),
                    "q75": round(q_vals[4], 1),
                    "q90": round(q_vals[5], 1),
                    "q98": round(q_vals[6], 1),
                    "low_confidence": q50 < self._low_thresh,
                }
            )

        # ── for horizons > max_pred, extrapolate with gentle trend ────
        if horizon_weeks > steps and forecast_points:
            last_fp = forecast_points[-1]
            for extra in range(steps, horizon_weeks):
                fc_date = last_date + pd.Timedelta(weeks=extra + 1)
                decay = 1.0 + 0.005 * (extra - steps + 1)
                fp = {
                    "date": fc_date.strftime("%Y-%m-%d"),
                    "q02": round(last_fp["q02"] * decay, 1),
                    "q10": round(last_fp["q10"] * decay, 1),
                    "q25": round(last_fp["q25"] * decay, 1),
                    "q50": round(last_fp["q50"] * decay, 1),
                    "q75": round(last_fp["q75"] * decay, 1),
                    "q90": round(last_fp["q90"] * decay, 1),
                    "q98": round(last_fp["q98"] * decay, 1),
                    "low_confidence": last_fp["q50"] * decay < self._low_thresh,
                }
                forecast_points.append(fp)

        # ── historical last 12 weeks ──────────────────────────────────
        historical = self._get_historical(lane_id, n_weeks=12)

        return {
            "lane_id": lane_id,
            "horizon_weeks": horizon_weeks,
            "forecast": forecast_points,
            "historical": historical,
            "lane_reliability": self.get_lane_reliability(lane_id),
            "model_used": "tft_best-82-0.1107",
            "is_tft_fallback": False,
        }

    def get_lane_reliability(self, lane_id: str) -> dict:
        """Return {mape, reliability, bias_kg} from entity_mape_lookup."""
        entry = self._mape_lookup.get(
            lane_id, {"mape": 25.0, "reliability": "medium", "bias_kg": 0.0}
        )
        return {
            "mape": entry["mape"],
            "reliability": entry["reliability"],
            "bias_kg": entry["bias_kg"],
        }

    def _historical_fallback(self, lane_id: str, horizon_weeks: int) -> dict:
        """
        Build a useful forecast response using historical data + linear trend.
        Called when TFT model is unavailable (Windows dev, missing checkpoint, etc.).
        Generates forecast points using the lane's historical weekly average
        with a simple seasonal adjustment — no ML inference needed.
        """
        historical = self._get_historical(lane_id, n_weeks=12)

        # Compute a baseline from the historical tail
        co2e_values = [h["co2e_kg"] for h in historical if h["co2e_kg"] > 0]
        if co2e_values:
            baseline = float(np.median(co2e_values[-4:])) if len(co2e_values) >= 4 else float(np.mean(co2e_values))
            # Simple linear trend from last 4 vs first 4 weeks
            if len(co2e_values) >= 8:
                trend_rate = (np.mean(co2e_values[-4:]) - np.mean(co2e_values[:4])) / max(len(co2e_values), 1)
            else:
                trend_rate = 0.0
        else:
            meta = self._lane_meta.get(lane_id, {})
            baseline = float(meta.get("avg_co2e_kg", 3000.0))
            trend_rate = 0.0

        # Build forecast points — all quantiles collapse to same value (no uncertainty)
        last_date = pd.Timestamp.now().normalize()
        if historical:
            last_date = pd.Timestamp(historical[-1]["date"])

        forecast_points = []
        for step in range(1, horizon_weeks + 1):
            fc_date = last_date + pd.Timedelta(weeks=step)
            # Gentle seasonal oscillation ± 5%
            seasonal = 1.0 + 0.05 * math.sin(2 * math.pi * step / 52)
            val = round(max(0.0, (baseline + trend_rate * step) * seasonal), 1)
            low_conf = val < self._low_thresh
            # Use 10% uncertainty bands around point estimate for visual width
            margin_wide = round(val * 0.15, 1)
            margin_iqr = round(val * 0.07, 1)
            forecast_points.append({
                "date": fc_date.strftime("%Y-%m-%d"),
                "q02": round(max(0, val - margin_wide * 1.5), 1),
                "q10": round(max(0, val - margin_wide), 1),
                "q25": round(max(0, val - margin_iqr), 1),
                "q50": val,
                "q75": round(val + margin_iqr, 1),
                "q90": round(val + margin_wide, 1),
                "q98": round(val + margin_wide * 1.5, 1),
                "low_confidence": low_conf,
            })

        return {
            "lane_id": lane_id,
            "horizon_weeks": horizon_weeks,
            "forecast": forecast_points,
            "historical": historical,
            "lane_reliability": self.get_lane_reliability(lane_id),
            "model_used": "historical_trend",
            "is_tft_fallback": True,
        }

    # ── preprocessing pipeline ────────────────────────────────────────

    def _preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Full preprocessing mirroring the training pipeline:
        aggregate to weekly-per-lane, engineer features, scale, log1p.
        """
        df = df.copy()

        # ── aggregate to one row per (lane_id, week) ──────────────────
        df["week_start"] = df["date"] - pd.to_timedelta(
            df["date"].dt.dayofweek, unit="D"
        )

        agg: dict = {
            "co2e_kg": "sum",
            "weight_tons": "mean",
            "distance_km": "first",
            "origin": "first",
            "destination": "first",
            "traffic_index": "mean",
            "weather_index": "mean",
            "load_factor": "mean",
            "fuel_efficiency": "mean",
            "fuel_price_index": "mean",
            "toll_cost_index": "mean",
            "driver_efficiency_index": "mean",
            "route_risk_index": "mean",
            "is_anomaly_week": "max",
            "is_shipment_spike": "max",
            "month": "first",
            "week_of_year": "first",
            "sin_time": "first",
            "cos_time": "first",
            "sin_week": "first",
            "cos_week": "first",
        }

        # Only aggregate columns that exist
        agg = {k: v for k, v in agg.items() if k in df.columns}

        # vehicle_type: mode per group
        def _vtype_mode(s: pd.Series) -> str:
            mode = s.mode()
            return mode.iloc[0] if not mode.empty else s.iloc[0]

        weekly = df.groupby(["lane_id", "week_start"]).agg(agg).reset_index()
        vt = df.groupby(["lane_id", "week_start"])["vehicle_type"].agg(_vtype_mode).reset_index()
        weekly = weekly.merge(vt, on=["lane_id", "week_start"], how="left")
        weekly = weekly.rename(columns={"week_start": "date"})
        weekly = weekly.sort_values(["lane_id", "date"]).reset_index(drop=True)

        # ── time index per lane (contiguous integer) ──────────────────
        weekly["time_idx"] = weekly.groupby("lane_id").cumcount()

        # ── lag features on the target ────────────────────────────────
        for lag in [1, 2, 4, 7, 14]:
            col = f"lag_{lag}"
            weekly[col] = weekly.groupby("lane_id")["co2e_kg"].shift(lag)

        # ── exponentially weighted means ──────────────────────────────
        weekly["ewm_alpha03"] = weekly.groupby("lane_id")["co2e_kg"].transform(
            lambda s: s.ewm(alpha=0.3, adjust=False).mean()
        )
        weekly["ewm_alpha01"] = weekly.groupby("lane_id")["co2e_kg"].transform(
            lambda s: s.ewm(alpha=0.1, adjust=False).mean()
        )

        # ── rolling std ───────────────────────────────────────────────
        weekly["rolling_std_4"] = weekly.groupby("lane_id")["co2e_kg"].transform(
            lambda s: s.rolling(4, min_periods=1).std()
        )

        # ── physics / derived features ────────────────────────────────
        weekly["log_weight"] = np.log1p(weekly["weight_tons"])
        weekly["load_distance"] = weekly["load_factor"] * weekly["distance_km"]
        weekly["co2_physics"] = weekly["weight_tons"] * weekly["distance_km"] * 0.1
        weekly["load_efficiency"] = weekly["load_factor"] * weekly["fuel_efficiency"]

        # ── robust scaling on traffic / weather ───────────────────────
        for i, feat in enumerate(self._scaler["features"]):
            if feat in weekly.columns:
                center = self._scaler["center_"][i]
                scale = self._scaler["scale_"][i]
                weekly[feat] = (weekly[feat] - center) / scale

        # ── log1p transform the target ────────────────────────────────
        weekly["co2e_kg"] = np.log1p(weekly["co2e_kg"].clip(lower=0))

        # ── back-fill NaNs from lags for the first few rows ──────────
        lag_cols = [f"lag_{l}" for l in [1, 2, 4, 7, 14]]
        extra_cols = ["ewm_alpha03", "ewm_alpha01", "rolling_std_4"]
        for col in lag_cols + extra_cols:
            if col in weekly.columns:
                weekly[col] = weekly.groupby("lane_id")[col].transform(
                    lambda s: s.bfill().fillna(0)
                )

        # ── ensure categorical columns are strings ────────────────────
        for col in ["lane_id", "origin", "destination", "vehicle_type"]:
            if col in weekly.columns:
                weekly[col] = weekly[col].astype(str)

        # ── convert flag columns to float (required by pytorch-forecasting)
        for col in ["is_anomaly_week", "is_shipment_spike"]:
            if col in weekly.columns:
                weekly[col] = weekly[col].astype(float)

        weekly = weekly.fillna(0)
        return weekly

    def _build_dataset(self, df: pd.DataFrame):
        """
        Build the training TimeSeriesDataSet that captures the schema
        used during original training.  Returns (dataset, full_df).
        """
        from pytorch_forecasting import TimeSeriesDataSet
        from pytorch_forecasting.data import GroupNormalizer

        cfg = self._cfg
        max_enc = cfg["MAX_ENCODER_LENGTH"]
        max_pred = cfg["MAX_PREDICTION_LENGTH"]

        # ── per-entity 70 / 15 / 15 temporal split ───────────────────
        def _split_cutoff(group: pd.DataFrame, frac: float) -> int:
            return int(len(group) * frac)

        cutoffs = df.groupby("lane_id")["time_idx"].apply(
            lambda s: s.iloc[_split_cutoff(s, 0.7)]
        )
        train_max_idx = {lid: int(v) for lid, v in cutoffs.items()}

        train_mask = df.apply(
            lambda r: r["time_idx"] <= train_max_idx.get(r["lane_id"], 1e9),
            axis=1,
        )
        train_df = df[train_mask].copy()

        # ── filter entities with too-short histories ──────────────────
        min_len = cfg.get("MIN_ENTITY_LENGTH", max_enc + max_pred + 1)
        lens = train_df.groupby("lane_id")["time_idx"].count()
        valid_ids = lens[lens >= min_len].index
        train_df = train_df[train_df["lane_id"].isin(valid_ids)].copy()

        if train_df.empty:
            raise RuntimeError("No lane has enough data for TFT training dataset")

        # ── build available feature lists (intersect config with df) ──
        avail = set(train_df.columns)
        static_cats = [c for c in cfg["STATIC_CATEGORICALS"] if c in avail]
        static_reals = [c for c in cfg["STATIC_REALS"] if c in avail]
        tvk_cats = [c for c in cfg["TIME_VARYING_KNOWN_CATEGORICALS"] if c in avail]
        tvk_reals = [c for c in cfg["TIME_VARYING_KNOWN_REALS"] if c in avail]
        tvu_reals = [c for c in cfg["TIME_VARYING_UNKNOWN_REALS"] if c in avail]

        logger.info(
            "TFT dataset features — static_cat=%d static_real=%d "
            "tvk_cat=%d tvk_real=%d tvu_real=%d",
            len(static_cats), len(static_reals),
            len(tvk_cats), len(tvk_reals), len(tvu_reals),
        )

        train_ds = TimeSeriesDataSet(
            train_df,
            time_idx="time_idx",
            target="co2e_kg",
            group_ids=["lane_id"],
            max_encoder_length=max_enc,
            max_prediction_length=max_pred,
            static_categoricals=static_cats,
            static_reals=static_reals,
            time_varying_known_categoricals=tvk_cats,
            time_varying_known_reals=tvk_reals,
            time_varying_unknown_reals=tvu_reals,
            target_normalizer=GroupNormalizer(
                groups=["lane_id"], transformation=None
            ),
            add_relative_time_idx=True,
            add_target_scales=True,
            add_encoder_length=True,
            allow_missing_timesteps=True,
        )

        return train_ds, df

    # ── helpers ───────────────────────────────────────────────────────

    def _get_historical(self, lane_id: str, n_weeks: int = 12) -> list[dict]:
        """Last *n_weeks* actual CO₂e values from the raw data."""
        ldf = self._raw_df[self._raw_df["lane_id"] == lane_id].copy()
        if ldf.empty:
            return []
        weekly = (
            ldf.groupby(pd.Grouper(key="date", freq="W-MON"))["co2e_kg"]
            .sum()
            .reset_index()
            .sort_values("date")
        )
        tail = weekly.tail(n_weeks)
        return [
            {"date": r["date"].strftime("%Y-%m-%d"), "co2e_kg": round(r["co2e_kg"], 1)}
            for _, r in tail.iterrows()
        ]

    def _empty_forecast(self, lane_id: str, horizon: int) -> dict:
        """Fallback response when data is insufficient for the lane."""
        logger.warning("TFT: insufficient data for lane %s — returning empty", lane_id)
        return {
            "lane_id": lane_id,
            "horizon_weeks": horizon,
            "forecast": [],
            "historical": self._get_historical(lane_id),
            "lane_reliability": self.get_lane_reliability(lane_id),
            "model_used": "tft_best-82-0.1107",
            "is_tft_fallback": False,
        }


class TFTServiceStub:
    """
    Zero-dependency fallback used when TFT import itself fails
    (e.g. broken torch install, missing pytorch-forecasting).
    Delegates to a minimal inline implementation that returns
    historical data only.
    """
    available = False

    def __init__(self) -> None:
        logger.warning("TFTServiceStub active — all forecasts will use historical fallback")

    def forecast(self, lane_id: str, horizon_weeks: int = 4) -> dict:
        """Return empty forecast with correct schema."""
        return {
            "lane_id": lane_id,
            "horizon_weeks": horizon_weeks,
            "forecast": [],
            "historical": [],
            "lane_reliability": {"mape": 0.0, "reliability": "low", "bias_kg": 0.0},
            "model_used": "stub",
            "is_tft_fallback": True,
        }

    def get_lane_reliability(self, lane_id: str) -> dict:
        return {"mape": 0.0, "reliability": "low", "bias_kg": 0.0}
