"""
GraphSAGE city-embedding service.

Responsibilities:
  • Load and expose city_embeddings_1.npy
  • Compute lane-level cosine similarity for corridor recommendations
  • Produce UMAP 2-D projection for the frontend scatter plot
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)


class GraphSAGEService:
    """Embedding-based lane similarity & city visualisation."""

    def __init__(self, embeddings_path: str, data_dir: str) -> None:
        t0 = time.time()
        data = Path(data_dir)

        # ── load city embeddings ──────────────────────────────────────
        self._embeddings: np.ndarray = np.load(embeddings_path)
        n_cities, self._emb_dim = self._embeddings.shape
        logger.info(
            "City embeddings loaded: shape=(%d, %d)", n_cities, self._emb_dim
        )

        # ── load supporting data ──────────────────────────────────────
        with open(data / "lane_metadata.json") as f:
            self._lane_meta: dict = json.load(f)

        with open(data / "category_mappings.json") as f:
            self._cat_map: dict = json.load(f)

        with open(data / "city_coordinates.json") as f:
            self._city_coords: dict = json.load(f)

        # ── build city → embedding-row index mapping ─────────────────
        # The .npy rows are ordered alphabetically by city name,
        # matching the *destination* list (29 cities) if n_cities==29,
        # or the full union (30 cities) if n_cities==30.
        all_cities_sorted = sorted(
            set(self._cat_map.get("origin", []))
            | set(self._cat_map.get("destination", []))
        )
        # If the number of rows matches destinations, use that list
        dest_sorted = sorted(self._cat_map.get("destination", []))
        if n_cities == len(dest_sorted):
            mapping_list = dest_sorted
        elif n_cities == len(all_cities_sorted):
            mapping_list = all_cities_sorted
        else:
            mapping_list = all_cities_sorted[:n_cities]
            logger.warning(
                "Embedding rows (%d) don't match city counts (dest=%d, all=%d). "
                "Using first %d sorted cities.",
                n_cities, len(dest_sorted), len(all_cities_sorted), n_cities,
            )

        self._city_to_idx: dict[str, int] = {
            c: i for i, c in enumerate(mapping_list)
        }
        self._idx_to_city: dict[int, str] = {
            i: c for c, i in self._city_to_idx.items()
        }

        # ── precompute lane embeddings ────────────────────────────────
        self._lane_embeddings: dict[str, np.ndarray] = {}
        for lid, meta in self._lane_meta.items():
            emb = self._get_lane_embedding_raw(meta["origin"], meta["destination"])
            if emb is not None:
                self._lane_embeddings[lid] = emb

        # ── UMAP cache (computed lazily on first request) ─────────────
        self._umap_cache: list[dict] | None = None

        logger.info(
            "GraphSAGEService ready in %.2fs  (cities=%d, lane_embeddings=%d)",
            time.time() - t0, n_cities, len(self._lane_embeddings),
        )

    # ── public API ────────────────────────────────────────────────────

    def _get_city_idx(self, city_name: str) -> int | None:
        """Map city name → embedding row index. Returns None if missing."""
        return self._city_to_idx.get(city_name)

    def get_lane_embedding(self, lane_id: str) -> np.ndarray | None:
        """Pre-computed lane embedding (origin_emb + dest_emb concatenated)."""
        return self._lane_embeddings.get(lane_id)

    def get_city_embedding(self, city_name: str) -> np.ndarray | None:
        """Return the 32-dim GraphSAGE embedding for a city, or None if unknown."""
        idx = self._city_to_idx.get(city_name)
        if idx is None:
            return None
        return self._embeddings[idx]

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """Cosine similarity with zero-vector guard."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a < 1e-8 or norm_b < 1e-8:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def find_similar_lanes(
        self,
        lane_id: str,
        top_k: int = 5,
        exclude_same_endpoint: bool = True,
    ) -> list[dict]:
        """
        Rank all lanes by cosine similarity to the target lane embedding.
        Optionally exclude lanes that share an origin or destination
        (too similar geographically to be useful as alternatives).
        """
        target_emb = self._lane_embeddings.get(lane_id)
        if target_emb is None:
            return []

        target_meta = self._lane_meta[lane_id]
        results: list[dict] = []

        for lid, emb in self._lane_embeddings.items():
            if lid == lane_id:
                continue
            other_meta = self._lane_meta[lid]

            if exclude_same_endpoint and (
                other_meta["origin"] == target_meta["origin"]
                or other_meta["origin"] == target_meta["destination"]
                or other_meta["destination"] == target_meta["origin"]
                or other_meta["destination"] == target_meta["destination"]
            ):
                continue

            sim = self.cosine_similarity(target_emb, emb)
            results.append(
                {
                    "lane_id": lid,
                    "origin": other_meta["origin"],
                    "destination": other_meta["destination"],
                    "similarity": round(sim, 4),
                    "avg_co2e_kg": other_meta["avg_co2e_kg"],
                    "distance_km": other_meta["distance_km"],
                }
            )

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def get_umap_projection(self) -> list[dict]:
        """
        UMAP 2-D projection of city embeddings, enriched with coordinates
        and aggregate lane statistics.  Cached after first call.
        Falls back to PCA if umap-learn / numba is unavailable in the container.
        """
        if self._umap_cache is not None:
            return self._umap_cache

        try:
            from umap import UMAP
            reducer = UMAP(
                n_components=2,
                random_state=42,
                n_neighbors=min(15, len(self._city_to_idx) - 1),
            )
            coords_2d = reducer.fit_transform(self._embeddings)
            method = "UMAP"
        except Exception as exc:
            logger.warning(
                "UMAP unavailable (%s: %s) — falling back to PCA 2-D projection",
                type(exc).__name__, exc,
            )
            # PCA requires no native deps, always available via numpy
            try:
                from sklearn.decomposition import PCA
                coords_2d = PCA(n_components=2, random_state=42).fit_transform(self._embeddings)
                method = "PCA"
            except Exception as exc2:
                logger.error("PCA also failed (%s) — returning empty UMAP data", exc2)
                self._umap_cache = []
                return []

        # aggregate stats per city from lane_metadata
        city_stats: dict[str, dict] = {}
        for meta in self._lane_meta.values():
            for role in ("origin", "destination"):
                c = meta[role]
                if c not in city_stats:
                    city_stats[c] = {"total_shipments": 0, "co2e_sum": 0.0, "count": 0}
                city_stats[c]["total_shipments"] += meta["shipment_count"]
                city_stats[c]["co2e_sum"] += meta["avg_co2e_kg"] * meta["shipment_count"]
                city_stats[c]["count"] += meta["shipment_count"]

        points: list[dict] = []
        for idx, city in self._idx_to_city.items():
            geo = self._city_coords.get(city, [0.0, 0.0])
            stats = city_stats.get(city, {"total_shipments": 0, "co2e_sum": 0, "count": 1})
            avg = stats["co2e_sum"] / stats["count"] if stats["count"] > 0 else 0
            points.append(
                {
                    "city": city,
                    "x": round(float(coords_2d[idx, 0]), 4),
                    "y": round(float(coords_2d[idx, 1]), 4),
                    "avg_co2e_kg": round(avg, 1),
                    "total_shipments": stats["total_shipments"],
                    "lat": geo[0],
                    "lon": geo[1],
                }
            )

        self._umap_cache = points
        logger.info("%s projection computed for %d cities", method, len(points))
        return points

    # ── internals ─────────────────────────────────────────────────────

    def _get_lane_embedding_raw(
        self, origin: str, destination: str
    ) -> np.ndarray | None:
        """
        Concatenate origin + destination city embeddings into a single
        lane-level embedding vector of length 2 × emb_dim.
        """
        oi = self._city_to_idx.get(origin)
        di = self._city_to_idx.get(destination)
        if oi is None or di is None:
            return None
        return np.concatenate([self._embeddings[oi], self._embeddings[di]])
