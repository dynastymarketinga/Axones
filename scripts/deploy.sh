#!/usr/bin/env bash
# Despliegue Axones en el servidor (ejecutado por GitHub Actions runner).
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/axones}"
cd "$APP_ROOT"

echo "==> Axones deploy $(date -Iseconds) en $APP_ROOT"

git fetch origin main
git reset --hard origin/main

cd "$APP_ROOT/backend"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force --no-interaction

php artisan axones:cleanup-operational-alerts --no-interaction
php artisan optimize --no-interaction

cd "$APP_ROOT/pulse-ui-react"
npm ci --no-audit --no-fund
npm run build:deploy

echo "==> Deploy completado OK"
