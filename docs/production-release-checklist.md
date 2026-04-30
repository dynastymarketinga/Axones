# Production Release Checklist (Directo a Produccion)

## 1) Freeze y alcance
- Congelar features nuevas; solo permitir hardening/fixes de release.
- Confirmar hash/tag del release candidato y ramas involucradas.

## 2) Preflight de configuracion
- Backend: revisar variables obligatorias en `backend/.env` tomando como base `backend/.env.example`.
- Frontend: revisar `VITE_API_BASE_URL` y base path `/axones` segun entorno.
- Validar conectividad a DB, colas/cache y permisos de escritura requeridos por Laravel.

## 3) Backup y rollback
- Ejecutar backup completo de base de datos antes de mantenimiento.
- Validar restauracion del backup en entorno de prueba antes de continuar.
- Si una migracion de datos falla, aplicar rollback operativo por restauracion de backup completo.

## 4) Ventana de despliegue
1. Activar mantenimiento: `php artisan down`
2. Desplegar codigo del release
3. Ejecutar migraciones: `php artisan migrate --force`
4. Limpiar/recargar caches: `php artisan optimize:clear`
5. Levantar servicio: `php artisan up`

## 5) Smoke tests obligatorios post-deploy
- Login de usuario real.
- Crear y editar material en inventario.
- Registrar mezcla de tinta.
- Registrar recepcion de compra.
- Avanzar una OT por su area correspondiente.
- Generar al menos un reporte operativo.

## 6) Criterio Go/No-Go
- Go: migraciones exitosas, sin errores criticos de auth ni regresiones funcionales en smoke.
- No-Go: fallo de migracion, error de permisos en endpoint critico, o ruptura de flujo OT/inventario/tintas.

