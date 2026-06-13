import type { AssistantChatContext } from "@/types/assistant"

/**
 * Deriva el contexto a enviar al asistente desde una ruta de la SPA.
 * Mantener sincronizado con el catálogo de rutas en src/routes/index.tsx.
 */
export function deriveAssistantContext(
  pathname: string,
  role?: string | null,
): AssistantChatContext {
  const ctx: AssistantChatContext = {}
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`
  ctx.route = path

  const woMatch = path.match(/^\/ordenes-trabajo\/(\d+)\b/)
  if (woMatch) {
    ctx.entity_type = "work_order"
    ctx.entity_id = Number(woMatch[1])
    return withArea(ctx, role)
  }

  const matMatch = path.match(/^\/materiales\/(\d+)\b/)
  if (matMatch) {
    ctx.entity_type = "material"
    ctx.entity_id = Number(matMatch[1])
    return withArea(ctx, role)
  }

  const mrMatch = path.match(/^\/solicitudes-material\/(\d+)\b/)
  if (mrMatch) {
    ctx.entity_type = "material_request"
    ctx.entity_id = Number(mrMatch[1])
    return withArea(ctx, role)
  }

  const coMatch = path.match(/^\/ordenes-cliente\/(\d+)\b/)
  if (coMatch) {
    ctx.entity_type = "client_order"
    ctx.entity_id = Number(coMatch[1])
    return withArea(ctx, role)
  }

  return withArea(ctx, role)
}

function withArea(ctx: AssistantChatContext, role?: string | null): AssistantChatContext {
  const area = areaFromRole(role)
  if (area) ctx.area = area
  return ctx
}

function areaFromRole(role?: string | null): string | null {
  const r = (role ?? "").toLowerCase().trim()
  if (!r) return null
  if (r === "inventory" || r === "inventario" || r === "inventory_chief" || r === "jefe_inventario" || r === "jefe_almacen") {
    return "inventory"
  }
  if (r === "printing" || r === "impresion") return "impresion"
  if (r === "laminacion") return "laminacion"
  if (r === "corte") return "corte"
  if (r === "montaje") return "montaje"
  if (r === "tintas") return "tintas"
  return "general"
}
