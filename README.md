# Axones V2

Sistema operativo de planta para gestion de inventario, produccion y despacho.

Este repositorio contiene una implementacion monorepo con:

- `backend/`: API Laravel (PHP 8.2, Laravel 12, Sanctum, DomPDF)
- `pulse-ui-react/`: SPA React + Vite + TypeScript + Tailwind + shadcn/ui

## Estado actual del proyecto

En esta version se consolidan cambios funcionales importantes en backend y frontend:

- autenticacion y gestion de usuarios reforzada (login por usuario, solicitud interna de restablecimiento de clave y resolucion por perfiles autorizados)
- control de acceso por areas operativas y permisos de planilla tecnica
- mejoras extensas en ordenes de trabajo (planilla, produccion por area, validaciones y flujo operativo)
- mejoras en recepciones, materiales, inventario y despacho
- nuevos reportes operativos con salida JSON/HTML/PDF/CSV
- nuevas vistas de previsualizacion y formularios en el frontend
- ampliacion de pruebas de integracion/feature para modulos criticos

## Arquitectura funcional

El sistema cubre los modulos principales:

- Datos maestros: clientes, productos, proveedores
- Inventario: materiales, recepciones, movimientos, devoluciones, bobinas, miscelaneos
- Produccion: programacion, impresion, laminacion, corte, tintas, ordenes de trabajo
- Calidad: certificados y control de calidad por OT
- Despacho: solicitudes de material y notas de entrega
- Reportes: inventario diario, movimientos generales, consumo, tiempos de produccion y mermas

## Rutas y seguridad

- API principal en `backend/routes/api.php`
- autenticacion por token Bearer con Sanctum
- middleware por area: `area.role` (alias registrado en `backend/bootstrap/app.php`)
- throttling en endpoints sensibles de autenticacion

## Ejecucion local

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

### Frontend

```bash
cd pulse-ui-react
npm install
npm run dev
```

## Pruebas

```bash
cd backend
php artisan test
```

## Operacion de release

- checklist de salida a produccion: `docs/production-release-checklist.md`

## Notas del repositorio

- se versiona principalmente codigo fuente y configuracion de `backend/` y `pulse-ui-react/`
- no subir archivos temporales, logs ni exportaciones de datos locales
- este README describe el estado funcional actual del proyecto

