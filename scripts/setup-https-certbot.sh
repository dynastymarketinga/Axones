#!/usr/bin/env bash
# HTTPS con Let's Encrypt (requiere dominio público apuntando al servidor).
#
# Uso:
#   sudo bash scripts/setup-https-certbot.sh axones.tudominio.com
#
set -euo pipefail

DOMAIN="${1:-}"
APP_ROOT="${APP_ROOT:-/var/www/axones}"
EMAIL="${CERTBOT_EMAIL:-}"

if [[ -z "$DOMAIN" ]]; then
  echo "Uso: sudo bash $0 axones.tudominio.com" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecuta con sudo." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y certbot python3-certbot-nginx
fi

NGINX_SITE="/etc/nginx/sites-available/axones"
NGINX_EXAMPLE="$APP_ROOT/scripts/nginx/axones-https.conf.example"
if [[ -f "$NGINX_EXAMPLE" ]] && [[ ! -f "$NGINX_SITE" ]]; then
  sed "s/server_name 10.0.0.2 axones.local;/server_name ${DOMAIN};/" \
    "$NGINX_EXAMPLE" >"$NGINX_SITE"
  # Certbot necesita un server :80 inicial; comenta redirect temporalmente si falla la primera vez
  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/axones
  nginx -t && systemctl reload nginx
fi

CERTBOT_ARGS=(--nginx -d "$DOMAIN" --agree-tos --non-interactive --redirect)
if [[ -n "$EMAIL" ]]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

certbot "${CERTBOT_ARGS[@]}"

ENV_FILE="$APP_ROOT/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  HTTPS_URL="https://${DOMAIN}"
  sed -i "s|^APP_URL=.*|APP_URL=${HTTPS_URL}|" "$ENV_FILE" || echo "APP_URL=${HTTPS_URL}" >>"$ENV_FILE"
  cd "$APP_ROOT/backend"
  php artisan config:clear --no-interaction
  php artisan optimize --no-interaction
fi

echo "==> Listo: https://${DOMAIN}/auth/basic/login"
