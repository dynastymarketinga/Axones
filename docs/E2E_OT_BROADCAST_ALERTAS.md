# E2E manual: OT broadcast + alertas en vivo

## Preparación

- Cuatro usuarios con roles: `impresion` (o `printing`), `laminacion`, `corte`, `tintas`.
- Cuatro ventanas de navegador (o perfiles) con sesión distinta.
- Abrir en cada uno el panel Axones con campana visible (`AppLayout`).

## Caso principal (< 5 s)

1. Usuario planificación/calidad guarda una OT (PUT `orden-trabajo` con formulario completo) o crea una OT nueva.
2. En cada ventana de área:
   - Debe aparecer **toast** con el mensaje de alerta (área correcta).
   - El **contador** de la campana debe subir sin refrescar.
   - **Bandeja** (dropdown): nueva entrada al abrir o ya visible si estaba abierta.
3. Verificar en API o UI de solicitudes: existen filas en `area-requests` con `area` en `impresion`, `laminacion`, `corte`, `tintas` para esa OT.

## Caso no secuencial

1. En distintas áreas, marcar avances / guardar producción sin seguir orden impresión → laminación → corte.
2. Confirmar que no hay bloqueo por etapa y que los estados persisten por área.

## Caso idempotencia (mismo guardado)

1. Guardar la misma orden dos veces en el mismo instante (doble clic) o repetir antes de que cambie `updated_at` del documento técnico.
2. No deben duplicarse alertas `work_order_saved_broadcast` con la misma huella (`save_fingerprint`) por área.

## Páginas “mi área”

- **Impresión / Laminación / Corte / Tintas (mi área)**: pestaña “En mi área” lista OT con solicitud **pendiente** para esa área (`mi_area`), sin filtrar solo por `board_stage`.
- **Tintas** (página mezclas): listado de OT usa `mi_area=tintas`.
