"""
Application configuration loaded from environment variables / .env file.
Uses python-dotenv + Pydantic BaseModel for validation.
"""

import os
import logging
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parent.parent

_env_file = _BACKEND_DIR / ".env"
if _env_file.exists():
    load_dotenv(_env_file)
else:
    _example = _BACKEND_DIR / ".env.example"
    if _example.exists():
        load_dotenv(_example)
        logger.info("Loaded .env.example (no .env found)")


class Settings(BaseModel):
    """All application settings with defaults from environment."""

    MODEL_DIR: str = Field(default_factory=lambda: os.getenv("MODEL_DIR", "models"))
    DATA_DIR: str = Field(default_factory=lambda: os.getenv("DATA_DIR", "data"))
    REDIS_URL: str = Field(default_factory=lambda: os.getenv("REDIS_URL", "redis://localhost:6379"))

    CATBOOST_MODEL_PATH: str = Field(
        default_factory=lambda: os.getenv("CATBOOST_MODEL_PATH", "models/catboost_best.cbm")
    )
    HYBRID_MODEL_PATH: str = Field(
        default_factory=lambda: os.getenv("HYBRID_MODEL_PATH", "models/hybrid_graphsage_catboost_best.cbm")
    )
    TFT_CKPT_PATH: str = Field(
        default_factory=lambda: os.getenv("TFT_CKPT_PATH", "models/tft_best-82-0.1107.ckpt")
    )
    EMBEDDINGS_PATH: str = Field(
        default_factory=lambda: os.getenv("EMBEDDINGS_PATH", "models/city_embeddings_1.npy")
    )

    CACHE_TTL_PREDICT: int = Field(
        default_factory=lambda: int(os.getenv("CACHE_TTL_PREDICT", "300"))
    )
    CACHE_TTL_STATIC: int = Field(
        default_factory=lambda: int(os.getenv("CACHE_TTL_STATIC", "3600"))
    )
    LOW_CONFIDENCE_THRESHOLD_KG: float = Field(
        default_factory=lambda: float(os.getenv("LOW_CONFIDENCE_THRESHOLD_KG", "1000.0"))
    )
    VIRTUAL_ENSEMBLE_COUNT: int = Field(
        default_factory=lambda: int(os.getenv("VIRTUAL_ENSEMBLE_COUNT", "10"))
    )

    HOST: str = Field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", "8000")))

    @model_validator(mode="after")
    def validate_model_paths(self) -> "Settings":
        """Ensure all model files exist at startup."""
        paths = {
            "CATBOOST_MODEL_PATH": self.resolved_catboost_path,
            "HYBRID_MODEL_PATH": self.resolved_hybrid_path,
            "TFT_CKPT_PATH": self.resolved_tft_path,
            "EMBEDDINGS_PATH": self.resolved_embeddings_path,
        }
        for name, p in paths.items():
            if not p.exists():
                raise FileNotFoundError(
                    f"{name} not found at '{p}'. "
                    f"Ensure the file exists or update the {name} env var."
                )
        data_dir = self.resolved_data_dir
        if not data_dir.exists():
            raise FileNotFoundError(f"DATA_DIR not found at '{data_dir}'")
        return self

    # ── resolved absolute paths ────────────────────────────────
    @property
    def resolved_data_dir(self) -> Path:
        return (_BACKEND_DIR / self.DATA_DIR).resolve()

    @property
    def resolved_model_dir(self) -> Path:
        return (_BACKEND_DIR / self.MODEL_DIR).resolve()

    @property
    def resolved_catboost_path(self) -> Path:
        return (_BACKEND_DIR / self.CATBOOST_MODEL_PATH).resolve()

    @property
    def resolved_hybrid_path(self) -> Path:
        return (_BACKEND_DIR / self.HYBRID_MODEL_PATH).resolve()

    @property
    def resolved_tft_path(self) -> Path:
        return (_BACKEND_DIR / self.TFT_CKPT_PATH).resolve()

    @property
    def resolved_embeddings_path(self) -> Path:
        return (_BACKEND_DIR / self.EMBEDDINGS_PATH).resolve()


@lru_cache
def get_settings() -> Settings:
    """Singleton settings instance, cached after first call."""
    return Settings()
