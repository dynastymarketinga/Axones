# Axones Assistant — Servidor MCP

Servidor [Model Context Protocol](https://modelcontextprotocol.io/) que expone la API de Axones como **tools de solo lectura** para asistentes LLM (Claude Desktop, Cursor, etc.).

Las mismas tools se reutilizarán después en el chat embebido de la SPA (`POST /api/assistant/chat` desde `backend/`), por eso la lógica de cada tool vive en `src/tools/*.ts` como funciones puras que solo dependen de `ToolDeps`.

## Estado

- **Fase 1 (esta carpeta):** servidor MCP por stdio, lectura únicamente.
- **No** modifica inventario, OT, ni producción.
- **No** contiene API keys de LLM; el modelo lo elige el cliente MCP que se conecta.

## Requisitos

- Node.js 20+
- API de Axones corriendo (dev: `http://127.0.0.1:8000/api`)
- Un token Sanctum del backend

## Instalación

```bash
cd bot
cp .env.example .env
# editar .env con AXONES_API_BASE_URL y AXONES_API_TOKEN
npm install
npm run build
```

> ⚠️ **Nunca pongas el token Sanctum en `.env.example`.** Ese archivo se
> versiona en git y queda en el historial para siempre. El token va únicamente
> en `bot/.env`, que está en `.gitignore`. Si por error lo commiteaste, revoca
> el token afectado con `php artisan tinker` (`$user->tokens()->delete()`) y
> genera uno nuevo.

## Generar un token Sanctum de prueba (local)

Desde `backend/`:

```bash
php artisan tinker
>>> $user = App\Models\User::findByLogin('admin');     # ajusta al login que uses
>>> $user->createToken('mcp-bot')->plainTextToken
```

Copia la cadena resultante en `bot/.env` → `AXONES_API_TOKEN`.

Alternativa por HTTP:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"..."}'
```

> ⚠️ El campo de login se llama `login` (no `email`).

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm run dev` | Ejecuta con `tsx` en modo watch (recarga al editar). |
| `npm run start` | Ejecuta `dist/index.js` (después de `build`). |
| `npm run typecheck` | Solo verificación de tipos. |
| `npm run clean` | Elimina `dist/`. |

## Conectar desde Claude Desktop

Edita el archivo de configuración de Claude Desktop:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "axones": {
      "command": "node",
      "args": ["C:\\Users\\pc\\Desktop\\Axones V2\\bot\\dist\\index.js"],
      "env": {
        "AXONES_API_BASE_URL": "http://127.0.0.1:8000/api",
        "AXONES_API_TOKEN": "PEGAR_TOKEN_AQUI"
      }
    }
  }
}
```

Reinicia Claude Desktop. Verás `axones` en la lista de MCP servers conectados; las tools `axones_*` aparecerán disponibles en la conversación.

## Conectar desde Cursor

`File → Settings → Cursor Settings → MCP → Add new MCP server`:

```json
{
  "axones": {
    "command": "node",
    "args": ["C:/Users/pc/Desktop/Axones V2/bot/dist/index.js"],
    "env": {
      "AXONES_API_BASE_URL": "http://127.0.0.1:8000/api",
      "AXONES_API_TOKEN": "PEGAR_TOKEN_AQUI"
    }
  }
}
```

## Catálogo de tools

Todas devuelven un objeto JSON con la forma:

```ts
{
  ok: boolean
  summary?: string
  data?: unknown
  dots?: Array<{ type, id, label, href }>
  follow_up_chips?: Array<{ label, tool, params? }>
  error?: string
}
```

`dots` son enlaces contextuales a entidades reales (para "chips de OT", etc. en la SPA). `follow_up_chips` son sugerencias para el siguiente paso del usuario.

### Consultas

| Tool | Para qué sirve |
|------|----------------|
| `axones_ping` | Probar que la API responde. |
| `axones_dashboard_summary` | KPIs del panel: stock bajo, alertas, OT por estado, producción/mermas del mes. |
| `axones_get_work_order` | Detalle de OT por id o por código `OT-2026-XXXXX`. |
| `axones_list_work_orders` | Listar OT con filtros (status, etapa de tablero, búsqueda libre). |
| `axones_get_pending_alerts` | Alertas operativas (por defecto, solo no leídas). |
| `axones_list_low_stock_materials` | Materiales por debajo del mínimo, opcionalmente por área. |
| `axones_get_material_request` | Detalle de una solicitud de material. |
| `axones_list_material_requests_pending` | Solicitudes en estado pending / partial. |
| `axones_area_requests_counts` | Conteo de solicitudes entre áreas. |

### Análisis

| Tool | Para qué sirve |
|------|----------------|
| `axones_analyze_scrap` | Datos de scrap por filtros (cliente, producto, sustrato, layout). |
| `axones_analyze_production_time` | Tiempos de producción agregados por área en un rango. |
| `axones_work_order_production_summary` | Resumen de producción de una OT (requiere rol `planilla_read`). |
| `axones_compare_dashboard_periods` | Snapshot del dashboard; con `baseline` calcula deltas. |

### Contexto (futuro chat embebido)

| Tool | Para qué sirve |
|------|----------------|
| `axones_resolve_entity` | Devuelve el "dot" `{type, id, label, href}` para una entidad. |
| `axones_suggest_chips` | Sugerencias contextuales según ruta SPA, entidad y área del usuario. |

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `AXONES_API_BASE_URL` | `http://127.0.0.1:8000/api` | URL base de la API Laravel. |
| `AXONES_API_TOKEN` | *(vacío)* | Token Sanctum (Bearer). Obligatorio para todo salvo `axones_ping`. |
| `AXONES_API_TIMEOUT_MS` | `15000` | Timeout por request. |
| `AXONES_SPA_BASE_URL` | *(vacío)* | Si se define, los `dots.href` salen absolutos (ej. `https://axones/axones`). |

## Seguridad

- **Solo lectura** en esta fase. Cualquier tool nueva que haga POST/PATCH/DELETE debe pasar por revisión y respetar el sistema de roles del backend.
- El token Sanctum hereda los permisos del usuario que lo emitió: si emitiste el token con un usuario `corte`, el bot solo verá lo que ese rol puede ver. **Recomendado:** crear un usuario "bot-readonly" con un rol que tenga permisos amplios de lectura.
- El backend ya impone `area.role` en endpoints sensibles (planilla, controles por área). El bot no intenta saltarse esos middlewares: si la API responde 403, la tool lo devuelve como `error`.

## Próximos pasos (fase 2)

1. Endpoint Laravel `POST /api/assistant/chat` que:
   - Recibe `{ messages, context }` desde la SPA.
   - Llama al LLM con tool calling.
   - Ejecuta las tools de `bot/src/tools/*` (reusables como librería).
   - Devuelve respuesta + `dots` + `follow_up_chips` para que la SPA pinte los chips.
2. Componente React `<AxonesAssistantPanel/>` en `pulse-ui-react`.
3. Aprender qué tools faltan según las preguntas reales y agregarlas.
