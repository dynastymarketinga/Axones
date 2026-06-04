#!/usr/bin/env bash
# Certificado autofirmado para Axones en red local (ej. 10.0.0.2).
# Permite https://axones/ (SPA en /) y activa «Instalar aplicación» en Chrome/Android
# tras aceptar la advertencia de seguridad una vez (o instalar el CA en tablets).
#
# Uso en el SERVIDOR (como root o con sudo):
#   cd /var/www/axones
#   sudo bash scripts/setup-https-selfsigned.sh
#   sudo bash scripts/setup-https-selfsigned.sh 10.0.0.2 axones
#
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/axones}"
PRIMARY_IP="${1:-10.0.0.2}"
EXTRA_NAME="${2:-axones}"
SSL_DIR="/etc/ssl/axones"
KEY_PATH="/etc/ssl/private/axones.key"
CRT_PATH="${SSL_DIR}/axones.crt"
FULLCHAIN="${SSL_DIR}/axones-fullchain.pem"
DAYS=825
OPENSSL_CNF="$(mktemp)"

cleanup() { rm -f "$OPENSSL_CNF"; }
trap cleanup EXIT

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Ejecuta con sudo." >&2
  exit 1
fi

mkdir -p "$SSL_DIR"
chmod 755 "$SSL_DIR"

cat >"$OPENSSL_CNF" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3

[dn]
CN = Axones
O = Inversiones Axones
C = VE

[v3]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
IP.1 = ${PRIMARY_IP}
DNS.1 = ${EXTRA_NAME}
DNS.2 = localhost
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_PATH" \
  -out "$CRT_PATH" \
  -days "$DAYS" \
  -config "$OPENSSL_CNF" \
  -extensions v3

chmod 600 "$KEY_PATH"
chmod 644 "$CRT_PATH"
cp "$CRT_PATH" "$FULLCHAIN"

echo "==> Certificado creado:"
echo "    $FULLCHAIN"
echo "    $KEY_PATH"

NGINX_SITE="/etc/nginx/sites-available/axones"
NGINX_EXAMPLE="$APP_ROOT/scripts/nginx/axones-https.conf.example"

if command -v nginx >/dev/null 2>&1 && [[ -d /etc/nginx/sites-available ]]; then
  if [[ -f "$NGINX_EXAMPLE" ]] && [[ ! -f "$NGINX_SITE" ]]; then
    cp "$NGINX_EXAMPLE" "$NGINX_SITE"
    echo "==> Copiado $NGINX_SITE (revísalo: php-fpm socket, server_name)"
  fi
  if [[ -f "$NGINX_SITE" ]]; then
    ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/axones 2>/dev/null || true
    nginx -t
    systemctl reload nginx
    echo "==> Nginx recargado"
  fi
else
  echo "==> Nginx no instalado: certificado listo en /etc/ssl/axones/"
  echo "    Configura HTTPS en Apache (u otro servidor) o: sudo apt install nginx"
  echo "    Ver scripts/DEPLOY_URLS.md"
fi

ENV_FILE="$APP_ROOT/backend/.env"
if [[ -f "$ENV_FILE" ]]; then
  HTTPS_URL="https://${EXTRA_NAME}"
  if grep -q '^APP_URL=' "$ENV_FILE"; then
    sed -i "s|^APP_URL=.*|APP_URL=${HTTPS_URL}|" "$ENV_FILE"
  else
    echo "APP_URL=${HTTPS_URL}" >>"$ENV_FILE"
  fi
  DOMAINS="${PRIMARY_IP},${EXTRA_NAME},localhost,127.0.0.1"
  if grep -q '^FRONTEND_URL=' "$ENV_FILE"; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${HTTPS_URL}|" "$ENV_FILE"
  else
    echo "FRONTEND_URL=${HTTPS_URL}" >>"$ENV_FILE"
  fi
  if grep -q '^SANCTUM_STATEFUL_DOMAINS=' "$ENV_FILE"; then
    sed -i "s|^SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=${DOMAINS}|" "$ENV_FILE"
  else
    echo "SANCTUM_STATEFUL_DOMAINS=${DOMAINS}" >>"$ENV_FILE"
  fi
  cd "$APP_ROOT/backend"
  php artisan config:clear --no-interaction 2>/dev/null || true
  php artisan optimize --no-interaction 2>/dev/null || true
  echo "==> .env: APP_URL=${HTTPS_URL}"
fi

cat <<EOF

==> Listo. Prueba en el navegador (añade en hosts: ${PRIMARY_IP}  ${EXTRA_NAME}):
    https://${EXTRA_NAME}/auth/basic/login

1) Acepta la advertencia «No es seguro» (certificado autofirmado) o instala axones.crt como CA en la tablet.
2) Menú ⋮ → debería aparecer «Instalar aplicación» o usa «Agregar a la pantalla principal».
3) Iconos PWA: https://${EXTRA_NAME}/brand/pwa-192.png
4) URLs antiguas /axones/... redirigen solas si Nginx usa axones-https.conf.example actualizado.

EOF
