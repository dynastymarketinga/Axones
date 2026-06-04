# HTTPS en producción (PWA «Instalar aplicación»)

Axones en `http://10.0.0.2` **no** puede mostrar el botón **Instalar aplicación** de Chrome: hace falta **HTTPS** (contexto seguro).

En HTTP solo verás **Agregar a la pantalla principal** (mismo icono, otro nombre en el menú).

## Opción A — Red local con IP `10.0.0.2` (certificado autofirmado)

Ideal si el servidor solo se usa en la fábrica / Wi‑Fi interna.

### En el servidor Linux (SSH)

```bash
cd /var/www/axones
git pull origin main
sudo bash scripts/setup-https-selfsigned.sh 10.0.0.2 axones.local
```

El script:

1. Crea certificado en `/etc/ssl/axones/` (válido para IP `10.0.0.2` y nombre `axones.local`).
2. Instala sitio Nginx `axones-https.conf` si no existe.
3. Actualiza `APP_URL=https://10.0.0.2` en `backend/.env`.

### En PC y tablets

1. Abre **`https://10.0.0.2/axones/auth/basic/login`** (con **https**, no http).
2. La primera vez: **Avanzado → Continuar** (certificado autofirmado).
3. Menú ⋮ → **Instalar aplicación** o **Agregar a la pantalla principal**.

Opcional: en cada tablet, archivo `hosts` o DNS interno:

```text
10.0.0.2  axones.local
```

y usar `https://axones.local/axones/`.

### Icono PWA

Tras el deploy, comprueba que cargan:

- `https://10.0.0.2/axones/manifest.webmanifest`
- `https://10.0.0.2/axones/brand/pwa-192.png`
- `https://10.0.0.2/axones/build-info.json`

## Opción B — Dominio público (Let's Encrypt, sin advertencia)

Si tienes un dominio (ej. `axones.tuempresa.com`) apuntando al servidor:

```bash
cd /var/www/axones
sudo CERTBOT_EMAIL=tu@correo.com bash scripts/setup-https-certbot.sh axones.tuempresa.com
```

Usuarios entran a `https://axones.tuempresa.com/axones/` sin advertencia y con **Instalar aplicación**.

## Ajustes en `backend/.env` (servidor)

```env
APP_URL=https://10.0.0.2
FRONTEND_URL=https://10.0.0.2
SANCTUM_STATEFUL_DOMAINS=10.0.0.2,axones.local,localhost,127.0.0.1
```

Tras cambiar:

```bash
cd /var/www/axones/backend
php artisan config:clear
php artisan optimize
```

## Comprobar Nginx

```bash
sudo nginx -t
sudo systemctl status nginx
```

Plantilla: `scripts/nginx/axones-https.conf.example`  
(Ajusta `fastcgi_pass` si tu PHP-FPM usa otro socket, p. ej. `php8.3-fpm.sock`.)

## Resumen

| URL | Instalar aplicación | Agregar a pantalla principal |
|-----|---------------------|------------------------------|
| `http://10.0.0.2/axones/` | No | Sí |
| `https://10.0.0.2/axones/` (autofirmado) | Sí*, tras aceptar cert | Sí |
| `https://dominio.com/axones/` (Let's Encrypt) | Sí | Sí |

\* En tablets corporativas puedes instalar el `.crt` como autoridad de confianza para no ver la advertencia.
