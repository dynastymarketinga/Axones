# Axones

Sistema de **producción e inventario** para planta de empaque flexible (impresión, laminación, corte, montaje y tintas). Incluye órdenes de trabajo, control por área (MES), compras, almacén, calidad, despacho y reportes operativos.

Repositorio: [dynastymarketinga/Axones](https://github.com/dynastymarketinga/Axones)

## Arquitectura

| Parte | Stack | Carpeta |
|-------|--------|---------|
| API | Laravel 12, PHP 8.2+, Sanctum, DomPDF | `backend/` |
| SPA | React 19, TypeScript, Vite 7, Tailwind, PWA | `pulse-ui-react/` |
| Despliegue | GitHub Actions + script en servidor | `scripts/`, `.github/workflows/` |

La interfaz se publica bajo **`/axones/`** y consume la API REST en **`/api`** (autenticación Bearer con Laravel Sanctum).

## Módulos principales

- **Datos maestros:** clientes, productos, proveedores, vendedores
- **Compras e inventario:** órdenes de compra, recepciones, materiales, bobinas, devoluciones, movimientos
- **Producción:** órdenes de cliente, órdenes de trabajo (OT), tablero de programación
- **Áreas MES:** impresión, laminación, corte, montaje, tintas, planilla técnica
- **Logística:** solicitudes entre áreas, notas de entrega, despacho corte, vigilancia
- **Calidad y reportes:** certificados, PDF/Excel, alertas operativas

## Requisitos

- PHP 8.2+ con extensiones habituales de Laravel (`mbstring`, `pdo`, etc.)
- Composer
- Node.js 20+ y npm
- Base de datos: SQLite (desarrollo) o MySQL/MariaDB (producción)

## Desarrollo local

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

Opcional: todo en uno (servidor, cola, logs y Vite del front legado en backend):

```bash
composer dev
```

### Frontend

```bash
cd pulse-ui-react
npm ci
npm run dev
```

En desarrollo, Vite puede hacer proxy de `/api` hacia Laravel (`http://127.0.0.1:8000`). Variable opcional: `VITE_API_BASE_URL`.

### Tests

```bash
# Backend
cd backend && php artisan test

# Frontend
cd pulse-ui-react && npm run lint && npm run test
```

## Variables de entorno útiles

En `backend/.env` (ver `.env.example`):

| Variable | Descripción |
|----------|-------------|
| `APP_LOCALE` | Idioma de la app (por defecto `es`) |
| `AXONES_SCRAP_ALERT_PERCENT` | Umbral de alerta por merma |
| `AXONES_MOUNT_ALERT_SECONDS` | Umbral tiempo montaje |
| `AXONES_DOWNTIME_ALERT_SECONDS` | Umbral tiempo de parada |
| `AXONES_INVENTORY_RETURN_ACCEPT_ROLES` | Roles que aceptan devoluciones a inventario |

En `pulse-ui-react/.env`: `VITE_API_BASE_URL` si la API no está en el mismo origen.

## Despliegue

- CI en cada push/PR: tests PHP, lint y build del front (`.github/workflows/ci.yml`).
- Deploy automático a servidor con runner self-hosted (`.github/workflows/deploy.yml` + `scripts/deploy.sh`).
- Guía HTTPS / PWA: `scripts/HTTPS_PRODUCCION.md`.

Flujo resumido en servidor: `git pull`, `composer install`, `php artisan migrate`, build de `pulse-ui-react` y copia de `dist` a `backend/public/axones/`.

## Roles y seguridad

Los usuarios tienen un campo `role` (inventario, impresión, laminación, corte, montaje, tintas, jefatura, etc.). La API aplica middleware `area.role` y el menú de la SPA filtra rutas según el rol.

## Estructura del repositorio

```
.
├── backend/           # API Laravel, migraciones, tests
├── pulse-ui-react/    # Interfaz React (PWA)
├── scripts/           # Deploy, HTTPS, nginx de ejemplo
├── .github/workflows/ # CI y deploy
└── README.md
```

## Licencia

Proyecto privado de Dynasty Marketing / Axones. Uso interno salvo acuerdo explícito.

## Contribuidores

- [victorx2](https://github.com/victorx2) — Víctor Andrés Carrillo Barreto
- Desarrollo asistido con Cursor Agent
