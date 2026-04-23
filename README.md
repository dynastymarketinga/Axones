# Axones V2

Carpeta de trabajo del **nuevo producto** (stack acordado en el contexto). El proyecto legado **`Axones`** en el escritorio sigue existiendo como **referencia** de negocio y datos; el código mantenible vive en **Laravel (API)** y el cliente web que el equipo elija (**Next + Pulse** si compran la plantilla, o **Filament / Inertia** como alternativa sin Envato).

## Repositorio en Git (Axones, empresa y flujo con tu cuenta)

En el control de versiones solo se incluyen **`backend/`**, **`pulse-ui-react/`**, este `README` y el `.gitignore` de la raíz. **No** se versiona `public/` de la raíz ni los PDF y notas sueltas en el escritorio de trabajo. Pasos detallados para subir a GitHub (`ovavisionve`), repositorio **privado** llamado **Axones**, y cómo colaborar desde tu usuario personal: **[`GITHUB-AXONES.md`](./GITHUB-AXONES.md)**.

## Código Laravel

- **`backend/`** — aplicación **Laravel 12** con **Sanctum** y rutas API (`GET /api/ping`, `GET /api/user` con token).
- La carpeta **`public/`** en la raíz de Axones V2 es **referencia del legado** (HTML); **no** es el `public` del Laravel (ese está en `backend/public`).

### MySQL + phpMyAdmin (XAMPP u otro)

No hace falta «subir» archivos PHP a phpMyAdmin: **phpMyAdmin solo crea la base vacía**; **Laravel crea las tablas** con migraciones.

1. Enciende **Apache** y **MySQL** en el panel de control (XAMPP).
2. Abre [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/) → **Bases de datos** → nombre **`axones_v2`** → cotejamiento **`utf8mb4_unicode_ci`** → **Crear**.
3. En **`backend/.env`** configura (ajusta usuario/clave si no usas root sin contraseña):

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=axones_v2
DB_USERNAME=root
DB_PASSWORD=
```

4. En PowerShell, desde la carpeta del proyecto:

```powershell
cd "C:\Users\pc\Desktop\Axones V2\backend"
php artisan migrate
```

Ahí se crean `users`, `materials`, `inventory_movements`, `inventory_returns`, `tinta_mixtures`, `bobinas`, `clients`, `client_orders`, `client_order_lines`, `suppliers`, `products`, `purchase_orders`, `purchase_order_lines`, `purchase_receipts`, `purchase_receipt_lines`, `work_orders`, `work_order_lines`, `material_requests`, `material_request_lines`, `printing_time_segments`, `printing_bobina_usages`, `work_order_printing_summaries`, `operational_alerts`, `miscellaneous_receipts`, `miscellaneous_receipt_attachments`, `personal_access_tokens`, etc. En phpMyAdmin podrás **ver** las tablas en `axones_v2` (y exportar SQL si quieres un respaldo).

Si prefieres seguir en **SQLite** (sin XAMPP), deja `DB_CONNECTION=sqlite` y no necesitas phpMyAdmin para desarrollo.

### Cómo ver el proyecto en el navegador

1. `cd backend` → `php artisan serve` (por defecto [http://127.0.0.1:8000](http://127.0.0.1:8000)).
2. **Vista previa web (demo):** [http://127.0.0.1:8000/panel](http://127.0.0.1:8000/panel) — estado de la API, login Sanctum y tablas de **materiales**, **devoluciones** y **mezclas** leyendo los mismos endpoints JSON. La raíz `/` redirige a `/panel`.
3. Prueba la API: [http://127.0.0.1:8000/api/ping](http://127.0.0.1:8000/api/ping) → debe responder JSON con `"ok": true`.
4. El **panel comercial** (OT, programación Kanban, nota de entrega, etc.) viene en **siguientes fases** (Filament o front Next/Pulse). Lo que ya está es **API + vista previa `/panel` + base de datos**.

### API de inventario (Sanctum)

Base URL (con `php artisan serve`): `http://127.0.0.1:8000/api`. Cabecera en rutas protegidas: `Authorization: Bearer {token}` y `Accept: application/json`.

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/ping` | no | Comprobación |
| POST | `/auth/login` | no | Body: `email`, `password` → devuelve `token` |
| POST | `/auth/register` | no | Solo entorno `local`: registro de usuario |
| POST | `/auth/logout` | sí | Revoca el token actual |
| GET | `/user` | sí | Usuario autenticado |
| GET | `/dashboard/summary` | sí | KPIs: totales por área, devoluciones pendientes, **alertas operativas sin reconocer** (`operational_alerts_unread`), **solicitudes de material pendientes/parciales**, **OT pendientes de programación** / **en programación** (excluye OT canceladas), movimientos hoy, mezclas, **materiales con stock &lt; mínimo** |
| GET | `/alerts` | sí | **Alertas operativas (PDF §6):** paginación; filtros `?unread=1`, `work_order_id`, `severity`, `alert_type` (`ot_material_shortage`, `scrap_threshold_exceeded`, `mount_time_exceeded`, `downtime_exceeded`) |
| PATCH | `/alerts/{id}/acknowledge` | sí | Marca la alerta como reconocida (`acknowledged_at`, usuario actual) |
| GET | `/reports/inventory-daily` | sí | **Reporte entrada/salida por fecha:** query `from`, `to` (incl. todo el día final). Devuelve `rows` (detalle por día y `movement_type`) y `by_day` con `totals_by_type` (`in`, `out`, ajustes) |
| GET | `/reports/consumption-by-client-product` | sí | **Consumo por cliente y producto** en el rango: suma de salidas `out` con `reference_type` `material_request` unidas a la OT (cliente/producto del maestro). Query `from`, `to` |
| GET | `/reports/rejected-bobinas` | sí | **Inventario bobinas rechazadas (PDF):** materiales del área con stock en kg + bobinas registradas (código, kg, OT, referencia de pedido del cliente vía devolución) |
| GET | `/inventory-movements` | sí | **Listado global** de movimientos con paginación; query: `from`, `to` (sobre `occurred_at`), `movement_type`, `inventory_area`, `material_id`, `reference_type`, `reference_id`, `user_id`, `search` (SKU o nombre de material), `per_page` (máx. 200) |
| GET | `/miscellaneous-receipts` | sí | Recepciones misceláneos (filtros `material_id`, `from`, `to` sobre `received_at`) |
| POST | `/miscellaneous-receipts` | sí | **Multipart:** `material_id` (debe ser área `miscelaneos`), `quantity`, `invoice_reference`, `notes`, `received_at` opcionales; `attachments[]` uno o más archivos (jpg, png, webp, pdf; máx. 10 MB c/u) → entrada `in`, `reference_type` `miscellaneous_receipt` |
| GET | `/miscellaneous-receipts/{id}` | sí | Detalle con adjuntos (metadatos; archivos en disco `local` / `storage/app/private`) |
| GET | `/miscellaneous-receipts/{id}/attachments/{attachmentId}` | sí | Descargar un comprobante (mismo `attachment` que en el JSON del detalle) |
| GET/POST | `/materials` | sí | Listar / crear material (`inventory_area`: `material`, `tintas`, `cementerio_tintas`, `quimicos`, `bobinas_rechazadas`, `miscelaneos`; tintas: `tinta_presentacion` `original` \| `solventada`) |
| GET/PATCH | `/materials/{id}` | sí | Ver / actualizar datos maestros (el stock no se edita a mano; va por movimientos) |
| GET/POST | `/materials/{id}/movements` | sí | Historial y registrar movimiento (`movement_type`: `in`, `out`, `adjustment_add`, `adjustment_sub`) |
| GET/POST | `/inventory-returns` | sí | Listar devoluciones (filtro opcional `?work_order_id=`); crear pendiente (`destination_area` debe coincidir con el material). **Bobinas rechazadas:** ver subsección siguiente. |
| POST | `/inventory-returns/{id}/accept` | sí | Aceptar → suma al inventario y registra movimiento `in` |
| GET/POST | `/bobinas` | sí | Listar / alta de bobina. **Área distinta de `bobinas_rechazadas`:** entidad única + movimiento `in` por kg. **Bobinas rechazadas:** ver subsección siguiente. |
| GET/POST | `/tinta-mixtures` | sí | Listar / **crear mezcla**: descuenta bases (`tintas` / `cementerio_tintas` / `quimicos`) y da de alta un **nuevo SKU** en `tintas` o `cementerio_tintas` con cantidad = suma de componentes |
| GET | `/tinta-mixtures/{id}` | sí | Detalle con componentes y movimientos vinculados (`reference_type` `tinta_mixture`) |
| GET/POST | `/clients` | sí | Listar / crear cliente |
| GET/PATCH | `/clients/{id}` | sí | Ver / actualizar |
| GET/POST | `/client-orders` | sí | **Órdenes de cliente** (pedido, PDF §3.B): listar (incluye `lines_count`); filtros `client_id`, `status`, `q`. **Crear:** `client_id`, opcional `code` / `ordered_at` / `notes` / `status`, y **`lines[]`**: por línea `quantity` (obligatoria), `unit` (defecto `kg`), `product_id` **o** `description` (texto si no hay producto en maestro), `notes`. El producto debe pertenecer al mismo `client_id` si el maestro lleva cliente. |
| GET/PATCH | `/client-orders/{id}` | sí | Ver (líneas con `product`, hasta 50 OT). **PATCH:** cabecera y/o **`lines`** (si envías `lines`, **reemplaza** todas las líneas; `[]` borra líneas). |
| GET/POST | `/suppliers` | sí | Listar / crear proveedor |
| GET/PATCH | `/suppliers/{id}` | sí | Ver / actualizar |
| GET/POST | `/products` | sí | Listar / crear producto (opcional `client_id`) |
| GET/PATCH | `/products/{id}` | sí | Ver / actualizar |
| GET/POST | `/purchase-orders` | sí | OC con líneas (`lines[]`: `material_id`, `quantity_ordered`, `unit`, `description`); estado inicial `open` |
| GET/PATCH | `/purchase-orders/{id}` | sí | Ver (con recepciones); actualizar `notes`, `ordered_at`, `status` |
| GET/POST | `/purchase-receipts` | sí | Recepción: entradas `in` al inventario; con OC actualiza `quantity_received` y estado de la OC; sin OC: `without_purchase_order` + `exception_reason` obligatorio |
| GET | `/purchase-receipts/{id}` | sí | Detalle con líneas y materiales |
| GET/POST | `/work-orders` | sí | OT: **`client_order_id`** opcional (FK a **`client_orders`**, orden formal del cliente); si se envía sin `client_id`, se toma el cliente de la orden de cliente; no puede enlazarse a orden **cancelada** ni con `client_id` distinto. Sigue existiendo **`client_order_reference`** (texto libre). **`scheduling_status`**, filtros `?client_order_id=`, etc.; opcional **`lines[]`** … |
| GET/PATCH | `/work-orders/{id}` | sí | Ver (líneas, solicitudes, **`client_order`**); actualizar cabecera, `status`, **`scheduling_status`**, **`client_order_id`** |
| GET | `/work-orders/{id}/printing` | sí | **Producción impresión (PDF §3.D):** estado de la OT en impresión: resumen (% merma), segmentos de tiempo recientes, **totales en segundos** (montaje / producción / tiempo muerto), segmento abierto, **uso por bobina** (kg usado / terminado). |
| POST | `/work-orders/{id}/printing/time-segments/start` | sí | Inicia segmento: body `segment_type`: `mount` \| `production` \| `downtime`; opcional `notes`. Cierra automáticamente el segmento abierto anterior en la misma OT. |
| POST | `/work-orders/{id}/printing/time-segments/{segmentId}/stop` | sí | Cierra el segmento de tiempo (debe estar abierto y pertenecer a la OT). |
| POST | `/work-orders/{id}/printing/bobina-usages` | sí | Registra **material usado / terminado por bobina**: `material_id`, `quantity_used_kg`, opcional `quantity_finished_kg`, `bobina_id`, `notes`. Si hay `bobina_id`, debe coincidir el material de la bobina. |
| PATCH | `/work-orders/{id}/printing/summary` | sí | **% merma** y notas: `scrap_percent` (0–100), `notes` (upsert en `work_order_printing_summaries`). |
| GET/POST | `/material-requests` | sí | Solicitud **ligada a una OT**; líneas `material_id` + `quantity_requested`; opcional `originating_area` (ej. impresión) |
| GET/PATCH | `/material-requests/{id}` | sí | Ver; **cancelar** solo si no hubo despacho (`PATCH` body `{"status":"cancelled"}`) |
| POST | `/material-requests/{id}/dispatch` | sí | **Despacho:** `lines[]` con `material_request_line_id` y `quantity` → salida `out`, movimiento `reference_type` `material_request` y metadata con `work_order_id` |

### Bobinas rechazadas (PDF §2.C — devolución casada con OT e impresión)

El inventario **`bobinas_rechazadas`** exige **dos pasos** enlazados a la **orden de trabajo** (OT) de la impresión:

1. **Devolución** (`POST /api/inventory-returns`): si `destination_area` es `bobinas_rechazadas`, el body debe incluir **`work_order_id`** (OT no cancelada). El stock en kg entra al **aceptar** la devolución (`POST /api/inventory-returns/{id}/accept`). Filtro opcional en listado: `?work_order_id=`.
2. **Registro de la bobina** (`POST /api/bobinas`): el material debe ser de área `bobinas_rechazadas`. Body **`inventory_return_id`** obligatorio (devolución ya **aceptada**, mismo material y destino, peso **`weight_kg` = `quantity` de la devolución**). **No** se genera un segundo movimiento de entrada (el kg ya ingresó al aceptar). Una sola bobina por devolución (índice único). En áreas que no sean `bobinas_rechazadas`, **no** enviar `inventory_return_id` (422 si se envía).

### Producción impresión (PDF §3.D)

Tras seleccionar la **OT**, el front puede consumir **`GET/POST/PATCH .../work-orders/{id}/printing/...`**: temporizadores por tipo de segmento (montaje, producción, tiempo muerto), registro de kg **usado / terminado** por bobina (opcionalmente ligado a `bobinas`), y **% de merma** en el resumen. Las **devoluciones** de impresión siguen usando **`/inventory-returns`** (casadas a OT cuando apliquen a bobinas rechazadas).

### Alertas operativas (PDF §6)

Se registran en **`operational_alerts`** y se listan con **`GET /api/alerts`**. Umbrales en **`config/axones.php`** (sobreescribibles por env):

- `AXONES_SCRAP_ALERT_PERCENT` (default 10) — al guardar **% merma** en impresión si `scrap_percent` ≥ umbral.
- `AXONES_MOUNT_ALERT_SECONDS` (default 3600) — al **cerrar** un segmento de **montaje** si la duración ≥ umbral.
- `AXONES_DOWNTIME_ALERT_SECONDS` (default 1800) — al cerrar segmento de **tiempo muerto** si la duración ≥ umbral.

Además, al **crear una OT con líneas**, si el **stock actual** del material es **menor** que la cantidad pedida en la línea, se genera alerta **`ot_material_shortage`** (crítica).

Usuario de prueba tras `php artisan db:seed`: **inventario@axones.local** / **password** (cámbiala en producción).

### Costos (acuerdo con operación)

- **Laravel + MySQL + phpMyAdmin en local:** sin costo de licencia.
- **Pulse / Envato Elements:** presupuesto aparte; el equipo decide si compra la plantilla cuando toque la capa visual.

## Qué leer primero

1. **[`CONTEXTO-AXONES-V2.md`](./CONTEXTO-AXONES-V2.md)** — decisión única de alcance, MVP, stack, **visión vs incremental**, **§4.1** (tintas, devoluciones, OT), checklist. En Cursor: **`@CONTEXTO-AXONES-V2.md`**.
2. Este **`README.md`** — entrada, resumen y prompts.
3. **[`PUBLIC-LEGADO.md`](./PUBLIC-LEGADO.md)** — mapa de **`Axones/public/*.html`** (pantallas del legado por módulo); para alinear roadmap sin listar archivos a mano.
4. **`Sistema Axones (1) (1).pdf`** — requisitos escritos (complementa el contexto).
5. **Puntero corto** — canónico en **`Axones/docs/AXONES-V2-CONTEXTO.md`** (repo legado). Copia opcional en la raíz: [`AXONES-V2-CONTEXTO.md`](./AXONES-V2-CONTEXTO.md).

## Próximos bloques típicos (orden sugerido)

| Estado | Bloque | Contenido |
|--------|--------|-----------|
| Hecho (API) | **1** | Maestros + órdenes de compra + recepción |
| Hecho (API) | **2** | OT mínima + **solicitudes** + **despacho** (salidas casadas a OT vía solicitud) |
| Siguiente (ejemplos) | **3+** | UI definitiva (Filament/Next); OT ampliada (fórmulas, líneas); producción por fases; despacho físico/nota de entrega; export de reportes; alertas; roles (varios ítems ya cubiertos en API: misceláneos, reportes básicos, programación mínima `scheduling_status`) |

Detalle, roadmap y **orden paso a paso** (qué implementar primero): **`CONTEXTO-AXONES-V2.md`** §13.

## Resumen ejecutivo

- **Backend único:** Laravel en **`backend/`** (MySQL/MariaDB recomendado en producción; Sanctum; CORS / dominios stateful para SPA). Toda la lógica de negocio y reglas **centralizadas** en PHP; la API es la frontera hacia el cliente.
- **Frontend:** **Opción A:** Next.js + **Pulse UI** (licencia **la compra el equipo** en Envato). **Opción B:** **Filament** o **Inertia + React** en el mismo monorepo Laravel — sin depender de plantillas de pago. En ambos casos: sin duplicar Supabase ni Google Apps Script en el núcleo.
- **Visión (horizonte):** **cobertura por fases** de las áreas de negocio que el legado y el plan describen (maestros, OT, producción, inventario, programación, despacho, calidad, alertas, reportes), en Laravel — **sin exigir** sistema idéntico al anterior; ver §10 del contexto.
- **MVP (~3 semanas):** autenticación → panel (KPIs/alertas básicas reales) → **Inventario** (tercer módulo, decisión cerrada). **OT completa tipo legado:** post-MVP.

## Cursor / equipo

- Workspace recomendado: carpetas hermanas **`Axones`** + **`Axones V2`** para consultar legado (`public/`, `supabase/`, `PLAN_DESARROLLO.md`) sin mezclar código nuevo dentro del legado.
- Decisiones cerradas: **`CONTEXTO-AXONES-V2.md`** §4 y §7. Checklist técnico: §8.

### Mega prompt (plantilla para el Agent)

Pega y completa los corchetes. Incluye **visión** + **solo el tramo** de esta sesión para no mezclar MVP con cobertura total de golpe.

```text
Lee @CONTEXTO-AXONES-V2.md, @README.md y (si aplica pantallas) @PUBLIC-LEGADO.md.

Reglas: un solo backend Laravel en `backend/`; el cliente (Next Pulse o Filament) no duplica reglas; MVP primero según §4 (auth, panel, inventario); OT completa post-MVP. Legado + PDF = referencia de negocio; §4.1 = detalle tintas/devoluciones/mezclas/OT.

Visión (horizonte): centralizar en Laravel la lógica del dominio (hoy dispersa en HTML/JS, Supabase, Apps Script) en modelos/servicios/políticas/jobs/API; fuente de verdad en backend. No es clonar pantallas ni flujos legacy.

Entrega incremental (obligatorio): en ESTA sesión solo: [una frase concreta: ej. checklist §8, o solo endpoints de materiales, etc.].

No pretender cobertura completa de todos los módulos en un solo paso salvo que el objetivo de sesión lo diga explícitamente.
```

### Prompt corto (solo scaffold / checklist §8)

```text
Lee @CONTEXTO-AXONES-V2.md y @README.md. Objetivo: [una frase, p. ej. checklist §8 — Laravel, .env MySQL, Sanctum + CORS http://localhost:3000, migraciones mínimas materiales según §4]. Un solo backend Laravel dueño de la lógica.
```
