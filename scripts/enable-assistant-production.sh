#!/usr/bin/env bash
# Habilita el asistente Axones en producción (runner SERVIDOR /var/www/axones).
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/axones}"
ENV_FILE="$APP_ROOT/backend/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: no existe $ENV_FILE" >&2
  exit 1
fi

echo "==> Habilitando asistente en $ENV_FILE"
for pair in "AXONES_ASSISTANT_ENABLED=true" "AXONES_ASSISTANT_PROVIDER=local"; do
  key="${pair%%=*}"
  val="${pair#*=}"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
done

cd "$APP_ROOT/backend"
php artisan config:cache --no-interaction
echo "==> Asistente habilitado (provider=local). Recarga la SPA en el navegador."
