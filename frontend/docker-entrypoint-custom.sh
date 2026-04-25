#!/bin/sh
# docker-entrypoint-custom.sh
# Replaces the backend URL in nginx.conf with BACKEND_URL env var.
# If BACKEND_URL is not set, defaults to "http://backend:8000" (Docker Compose).

BACKEND_URL="${BACKEND_URL:-http://backend:8000}"

echo "Configuring nginx: backend -> ${BACKEND_URL}"

sed -i "s|http://backend:8000|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

# Run the original nginx entrypoint
exec /docker-entrypoint.sh "$@"
