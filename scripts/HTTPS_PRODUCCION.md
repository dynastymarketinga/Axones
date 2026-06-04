# HTTPS en producción (PWA «Instalar aplicación»)

Axones en `http://10.0.0.2` **no** puede mostrar el botón **Instalar aplicación** de Chrome: hace falta **HTTPS** (contexto seguro).

En HTTP solo verás **Agregar a la pantalla principal** (mismo icono, otro nombre en el menú).

URLs recomendadas tras el despliegue con base `/`: ver también `scripts/DEPLOY_URLS.md`.

## Opción A — Red local (certificado autofirmado)

Ideal si el servidor solo se usa en la fábrica / Wi‑Fi interna.

### En el servidor Linux

```bash
cd /var/www/axones
git pull origin main
sudo bash scripts/setup-https-selfsigned.sh 10.0.0.2 axones
```

El script:

1. Crea certificado en `/etc/ssl/axones/` (válido para IP `10.0.0.2` y nombre `axones`).
2. Instala sitio Nginx si no existe (`scripts/nginx/axones-https.conf.example`).
3. Actualiza `APP_URL` y dominios Sanctum en `backend/.env`.

### En PC y tablets

1. En **hosts**: `10.0.0.2  axones`
2. Abre **`https://axones/auth/basic/login`**
3. La primera vez: **Avanzado → Continuar** (certificado autofirmado).
4. Menú ⋮ → **Instalar aplicación** o **Agregar a la pantalla principal**.

URLs antiguas `http://10.0.0.2/axones/...` redirigen automáticamente a `https://axones/...` (sin `/axones/` en la ruta).

### Icono PWA

Tras el deploy, comprueba:

- `https://axones/manifest.webmanifest`
- `https://axones/brand/pwa-192.png`
- `https://axones/build-info.json`

## Opción B — Dominio público (Let's Encrypt)

Si tienes un dominio apuntando al servidor:

```bash
cd /var/www/axones
sudo CERTBOT_EMAIL=tu@correo.com bash scripts/setup-https-certbot.sh axones.tuempresa.com
```

## Ajustes en `backend/.env` (servidor)

```env
APP_URL=https://axones
FRONTEND_URL=https://axones
SANCTUM_STATEFUL_DOMAINS=10.0.0.2,axones,localhost,127.0.0.1
```

Tras cambiar:

```bash
cd /var/www/axones/backend
php artisan config:clear
php artisan optimize
```

## Comprobar Nginx

```bash
ls -la /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl status nginx
```

Plantilla: `scripts/nginx/axones-https.conf.example`  
(Ajusta `fastcgi_pass` si tu PHP-FPM usa otro socket, p. ej. `php8.3-fpm.sock`.)

## Resumen

| URL | Instalar aplicación | Agregar a pantalla principal |
|-----|---------------------|------------------------------|
| `http://10.0.0.2/axones/` (legacy) | No | Sí → redirige a HTTPS sin `/axones/` |
| `https://axones/auth/...` (autofirmado) | Sí*, tras aceptar cert | Sí |
| `https://dominio.com/` (Let's Encrypt) | Sí | Sí |

\* En tablets corporativas puedes instalar el `.crt` como autoridad de confianza para no ver la advertencia.
