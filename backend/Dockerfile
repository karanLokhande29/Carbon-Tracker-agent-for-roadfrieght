# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — dependency installer
#   Uses a full build environment so C-extension wheels (catboost, torch, etc.)
#   compile correctly, then the compiled site-packages are copied forward.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS deps

# System build deps required by: torch, umap-learn, scipy, shap
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /install

# Copy ONLY requirements first → Docker layer cache skips pip install
# on rebuilds unless requirements.txt actually changes.
COPY requirements.txt .

# --no-cache-dir keeps the image lean; pip pre-resolves wheels where possible
RUN pip install --upgrade pip --no-cache-dir \
 && pip install --no-cache-dir -r requirements.txt


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — production runtime (lean final image)
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Only the runtime curl needed for the healthcheck probe
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security (principle of least privilege)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# Bring compiled packages from the deps stage — no compiler in final image
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application source
COPY --chown=appuser:appgroup app/      ./app/
COPY --chown=appuser:appgroup run.py    ./run.py

# Copy data files (JSON metadata needed at runtime).
# In Docker Compose these are overridden by bind-mount volumes.
COPY --chown=appuser:appgroup data/     ./data/

# Models directory (content injected via docker-compose volumes or CI stubs)
RUN mkdir -p models && chown -R appuser:appgroup models

USER appuser

# Uvicorn production port (matches HOST/PORT in .env.example)
EXPOSE 8000

# Prefer uvicorn directly in production — avoids the __main__ overhead of run.py
# and allows Gunicorn to manage workers when scaling.
# Use ENTRYPOINT + CMD so the command is overridable in docker-compose/k8s.
ENTRYPOINT ["uvicorn", "app.main:app"]
CMD ["--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--log-level", "info"]
