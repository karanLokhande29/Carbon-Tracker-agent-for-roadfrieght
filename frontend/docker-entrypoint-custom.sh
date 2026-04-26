#!/bin/sh
# docker-entrypoint-custom.sh
# Replaces BACKEND_URL_PLACEHOLDER in nginx.conf with the actual BACKEND_URL.
# No DNS hacks required, because Azure Container Apps use static internal LBs.

set -e

BACKEND_URL="${BACKEND_URL:-http://backend:8000}"

echo "=== Carbon Tracker Frontend ==="
echo "Configuring nginx: BACKEND_URL -> ${BACKEND_URL}"

# Replace placeholders
sed -i "s|BACKEND_URL_PLACEHOLDER|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf

echo "=== Nginx backend upstream set to ==="
grep "proxy_pass" /etc/nginx/conf.d/default.conf | head -5

echo "=== Testing nginx config syntax ==="
nginx -t

echo "=== Starting nginx ==="
exec /docker-entrypoint.sh "$@"
