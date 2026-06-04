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

Sin esa línea, `https://axones/...` no resuelve. Con ella, puedes abrir `https://axones/auth/basic/login` en lugar de `http://10.0.0.2/axones/...`.

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

Si usas **Apache**, hay que adaptar el VirtualHost (equivalente a la plantilla Nginx). Mientras tanto puedes seguir entrando por **`http://10.0.0.2/axones/`** (o la nueva ruta tras el deploy: `http://10.0.0.2/` si Apache ya apunta el `DocumentRoot` a `backend/public`).

### Solo si tienes Nginx

```bash
ls -la /etc/nginx/sites-enabled/
sudo nginx -t
```

Plantilla: `scripts/nginx/axones-https.conf.example`

## Despliegue

Push a `main` → GitHub Actions ejecuta `scripts/deploy.sh`, que publica el build en `backend/public/` (raíz) y elimina la carpeta legacy `backend/public/axones/`.
