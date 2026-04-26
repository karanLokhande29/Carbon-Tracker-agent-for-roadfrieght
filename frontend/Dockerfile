# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Node builder
#   Installs ALL deps (including devDependencies) needed by tsc + vite build,
#   then compiles the React/TS app into a static dist/ bundle.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Layer cache: copy lock files first → npm ci is skipped on rebuilds
# unless package-lock.json actually changes.
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .

# In production (Docker/ACA), set to empty string so axios uses relative URLs
# and nginx handles the reverse proxy. In dev, vite.config.ts proxy handles it.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN chmod +x node_modules/.bin/vite || true
RUN npm run build:docker


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production Nginx (< 25 MB final image, zero Node runtime)
#   Serves the compiled static bundle and reverse-proxies /api + /health
#   to the FastAPI backend — identical routing to the vite dev-server proxy.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove the default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config (handles SPA routing + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint that substitutes BACKEND_HOST at runtime
COPY docker-entrypoint-custom.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

EXPOSE 80

# Entrypoint swaps backend hostname, then starts nginx
ENTRYPOINT ["/docker-entrypoint-custom.sh"]
CMD ["nginx", "-g", "daemon off;"]
