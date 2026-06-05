#!/usr/bin/env bash
# Despliegue Axones en el servidor (ejecutado por GitHub Actions runner).
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/axones}"
SPA_DIST="$APP_ROOT/pulse-ui-react/dist"
SPA_PUBLIC="$APP_ROOT/backend/public"

cd "$APP_ROOT"

echo "==> Axones deploy $(date -Iseconds) en $APP_ROOT"

git fetch origin main
git reset --hard origin/main

DEPLOY_COMMIT="$(git rev-parse HEAD)"
DEPLOY_COMMIT_SHORT="$(git rev-parse --short HEAD)"
echo "==> Commit desplegado: $DEPLOY_COMMIT_SHORT ($DEPLOY_COMMIT)"

cd "$APP_ROOT/backend"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force --no-interaction

if [ "${AXONES_TRUNCATE_KEEP_AUTH:-}" = "1" ]; then
  echo "==> Limpieza BD: conserva users, cache, sessions, personal_access_tokens"
  php artisan axones:truncate-keep-users --force --no-interaction
else
  echo "==> BD: sin cambios (deploy normal, no se vacían tablas)"
fi

php artisan axones:cleanup-operational-alerts --no-interaction
php artisan optimize --no-interaction

cd "$APP_ROOT/pulse-ui-react"
npm ci --no-audit --no-fund
npm run build:deploy

if [ ! -f "$SPA_DIST/index.html" ]; then
  echo "ERROR: no se generó $SPA_DIST/index.html" >&2
  exit 1
fi

MAIN_BUNDLE="$(ls -1 "$SPA_DIST/assets/index-"*.js 2>/dev/null | head -1 || true)"
if [ -z "$MAIN_BUNDLE" ]; then
  echo "ERROR: no se encontró bundle JS en $SPA_DIST/assets/" >&2
  exit 1
fi

if ! grep -q "µm" "$MAIN_BUNDLE"; then
  echo "ADVERTENCIA: el bundle no contiene la cadena µm (¿build desactualizado?)" >&2
fi

BUILD_INFO="$SPA_DIST/build-info.json"
printf '{"commit":"%s","commit_short":"%s","built_at":"%s"}\n' \
  "$DEPLOY_COMMIT" "$DEPLOY_COMMIT_SHORT" "$(date -Iseconds)" > "$BUILD_INFO"

echo "==> Publicando SPA: $SPA_DIST -> $SPA_PUBLIC"
mkdir -p "$SPA_PUBLIC"
rsync -a --delete \
  --exclude 'index.php' \
  --exclude 'robots.txt' \
  --exclude '.htaccess' \
  "$SPA_DIST/" "$SPA_PUBLIC/"

LEGACY_SPA="$APP_ROOT/backend/public/axones"
if [ -d "$LEGACY_SPA" ]; then
  echo "==> Eliminando carpeta legacy $LEGACY_SPA"
  rm -rf "$LEGACY_SPA"
fi

echo "==> Bundle activo: $(basename "$MAIN_BUNDLE")"
echo "==> Verificar en producción: /build-info.json (https://axones/build-info.json con hosts)"

if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl reload nginx 2>/dev/null || true
  sudo systemctl reload apache2 2>/dev/null || true
fi

echo "==> Deploy completado OK ($DEPLOY_COMMIT_SHORT)"
