# URLs de Axones: desarrollo vs producción

## Desarrollo (tu PC)

| Qué | URL |
|-----|-----|
| Vite (`npm run dev`) | `http://localhost:5173/axones/auth/basic/login` |
| Base de Vite / Router | `/axones/` |

No cambia con este despliegue: sigue usando el subpath `/axones/`.

## Producción (servidor `10.0.0.2`)

| Qué | URL recomendada |
|-----|-----------------|
| Login SPA | `https://axones/auth/basic/login` |
| Build-info | `https://axones/build-info.json` |
| Base del build | `/` (raíz, sin `/axones/` en la barra) |

### ¿Qué es `10.0.0.2  axones`?

**No es un comando del servidor.** Es una línea que se pega en el archivo **hosts** de **cada PC o tablet** (Windows/Android), para que el navegador entienda el nombre `axones` como la IP del servidor:

| Columna | Significado |
|---------|-------------|
| `10.0.0.2` | IP del SERVIDOR en la red de la fábrica |
| `axones` | Nombre corto que quieres escribir en la barra de direcciones |

Sin esa línea, el navegador muestra **DNS_PROBE_FINISHED_NXDOMAIN** si escribes solo `axones` en la barra. Con la línea, usa **`http://axones/auth/basic/login`** o **`https://axones/...`** (si Apache tiene SSL).

**Windows** (Bloc de notas **como administrador**): abre  
`C:\Windows\System32\drivers\etc\hosts`  
y añade al final:

```text
10.0.0.2  axones
```

Guarda, cierra el navegador y vuelve a abrirlo.

### URLs antiguas (compatibilidad)

Nginx redirige automáticamente:

- `http://10.0.0.2/axones/...` → `https://axones/...` (sin el segmento `/axones/`)
- `https://10.0.0.2/axones/...` → misma ruta en el mismo host, sin `/axones/`

Tras el cambio, **vuelve a crear** el acceso directo en la tablet con la URL nueva.

## HTTPS

Ver `scripts/HTTPS_PRODUCCION.md`. En el servidor:

```bash
cd /var/www/axones
sudo bash scripts/setup-https-selfsigned.sh 10.0.0.2 axones
```

## Servidor web en el SERVIDOR

Los pasos con **Nginx** solo aplican si Nginx está instalado. Si ves `nginx: orden no encontrada` o no existe `/etc/nginx/`, en tu máquina **otro programa** sirve la web (a menudo **Apache**).

Descubre cuál es:

```bash
# ¿Qué escucha en el puerto 80?
sudo ss -tlnp | grep ':80 '

# ¿Apache?
which apache2 httpd 2>/dev/null
systemctl status apache2 2>/dev/null || systemctl status httpd 2>/dev/null

# ¿Nginx? (si no está, estos comandos fallan — es normal)
which nginx 2>/dev/null
```

Tu SERVIDOR usa **Apache** (`apache2` en el puerto 80). Plantilla:

```bash
cd /var/www/axones
git pull origin main
sudo cp scripts/apache/axones.conf.example /etc/apache2/sites-available/axones.conf
sudo a2enmod rewrite ssl headers
sudo a2ensite axones.conf   # si choca con otro sitio: sudo apache2ctl -S y fusiona a mano
sudo apache2ctl configtest
sudo systemctl reload apache2
```

El archivo `backend/public/.htaccess` (en el repo) hace:

- redirigir `/axones/...` → `/...`
- servir la SPA (`index.html`) en rutas como `/auth/...`
- dejar `/api` y `/panel` en Laravel

**Entrada tras el deploy:** `http://10.0.0.2/auth/basic/login` (ya no uses solo `/axones/`; esa carpeta ya no existe).

Comprobar en el servidor:

```bash
ls -la /var/www/axones/backend/public/index.html
curl -sI http://127.0.0.1/auth/basic/login | head -5
```

### Solo si tienes Nginx

```bash
ls -la /etc/nginx/sites-enabled/
sudo nginx -t
```

Plantilla: `scripts/nginx/axones-https.conf.example`

## Despliegue

Push a `main` → GitHub Actions ejecuta `scripts/deploy.sh`, que publica el build en `backend/public/` (raíz) y elimina la carpeta legacy `backend/public/axones/`.
