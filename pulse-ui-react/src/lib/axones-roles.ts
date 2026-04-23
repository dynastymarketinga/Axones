/** Normaliza rol del API (login) para reglas de menú. */
export function normalizeRole(role?: string | null): string {
  return (role ?? "").toLowerCase().trim()
}

import type { LucideIcon } from "lucide-react"

const BOSS_ROLES = new Set(["boss", "admin", "jefe_supremo", "superadmin"])

/** Jefes / admin: ven todo el menú Axones. */
export function isAxonesFullAccess(role?: string | null): boolean {
  const r = normalizeRole(role)
  if (!r || r === "general") return true
  return BOSS_ROLES.has(r)
}

const INVENTORY_URLS = new Set([
  "axones/resumen",
  "axones/alertas",
  "axones/clientes",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/productos",
  "axones/productos/form",
  "axones/proveedores",
  "axones/materiales",
  "axones/inventario-areas",
  "axones/movimientos-inventario",
  "axones/ordenes-compra",
  "axones/ordenes-compra/nueva",
  "axones/recepciones-oc",
  "axones/recepciones-nueva",
  "axones/miscelaneos",
  "axones/miscelaneos/nuevo",
  "axones/bobinas",
  "axones/devoluciones",
  "axones/solicitudes-material",
  "axones/reportes",
])

const PRINTING_URLS = new Set([
  "axones/resumen",
  "axones/alertas",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/programacion",
  "axones/impresion",
  "axones/pedidos-cliente",
  "axones/ordenes-cliente",
  "axones/ordenes-cliente/nueva",
  "axones/ordenes-trabajo",
  "axones/solicitudes-area",
  "axones/solicitudes-material",
  "axones/calidad",
  "axones/reportes",
  "axones/mezclas-tinta",
])

const LAMINACION_URLS = new Set([
  "axones/resumen",
  "axones/alertas",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/programacion",
  "axones/laminacion",
  "axones/pedidos-cliente",
  "axones/ordenes-cliente",
  "axones/ordenes-cliente/nueva",
  "axones/ordenes-trabajo",
  "axones/solicitudes-area",
  "axones/solicitudes-material",
  "axones/reportes",
])

const CORTE_URLS = new Set([
  "axones/resumen",
  "axones/alertas",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/programacion",
  "axones/corte",
  "axones/pedidos-cliente",
  "axones/ordenes-cliente",
  "axones/ordenes-cliente/nueva",
  "axones/ordenes-trabajo",
  "axones/solicitudes-area",
  "axones/solicitudes-material",
  "axones/prefill-nota-entrega",
  "axones/nota-entrega-nueva",
  "axones/despacho-corte",
  "axones/notas-entrega",
  "axones/reportes",
])

const TINTAS_URLS = new Set([
  "axones/resumen",
  "axones/alertas",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/tintas",
  "axones/pedidos-cliente",
  "axones/ordenes-cliente",
  "axones/ordenes-cliente/nueva",
  "axones/ordenes-trabajo",
  "axones/materiales",
  "axones/inventario-areas",
  "axones/mezclas-tinta",
  "axones/solicitudes-area",
  "axones/reportes",
])

const ADMIN_URLS = new Set([
  "axones/resumen",
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/movimientos-inventario",
  "axones/ordenes-trabajo",
  "axones/despacho-corte",
  "axones/notas-entrega",
  "axones/nota-entrega-nueva",
  "axones/prefill-nota-entrega",
  "axones/reportes",
])

const SOLICITANTE_URLS = new Set([
  "axones/vendedores",
  "axones/vendedores/form",
  "axones/solicitudes-area",
  "axones/solicitudes-material",
])

/** ¿Puede el rol ver esta ruta del menú Axones? */
export function isAxonesUrlAllowed(
  url: string,
  role?: string | null,
): boolean {
  if (url === "axones/asistente") return true
  if (isAxonesFullAccess(role)) return true
  const r = normalizeRole(role)

  if (r === "gate" || r === "vigilancia") {
    return url === "axones/vigilancia" || url === "axones/vigilancia/nuevo"
  }
  if (r === "inventory" || r === "inventario") {
    return INVENTORY_URLS.has(url)
  }
  if (r === "quality" || r === "calidad") {
    return !url.startsWith("axones/vigilancia")
  }
  if (r === "printing" || r === "impresion") {
    return PRINTING_URLS.has(url)
  }
  if (r === "laminacion") {
    return LAMINACION_URLS.has(url)
  }
  if (r === "corte") {
    return CORTE_URLS.has(url)
  }
  if (r === "tintas") {
    return TINTAS_URLS.has(url)
  }
  if (r === "admin_area" || r === "administracion") {
    return ADMIN_URLS.has(url)
  }
  if (r === "solicitante") {
    return SOLICITANTE_URLS.has(url)
  }
  return true
}

export type AxonesMenuNode =
  | { title: string; url: string; icon?: LucideIcon }
  | { title: string; url: "#"; items: AxonesMenuNode[]; icon?: LucideIcon }

function isBranch(
  n: AxonesMenuNode,
): n is { title: string; url: "#"; items: AxonesMenuNode[]; icon?: LucideIcon } {
  return "items" in n && Array.isArray(n.items)
}

/**
 * Secciones de primer nivel visibles para cualquier rol (menú de navegación).
 * El backend puede seguir aplicando permisos en cada API.
 */
const AXONES_MENU_SECTIONS_ALWAYS_VISIBLE = new Set([
  "Producción",
  "Vigilancia",
])

/**
 * Filtra el árbol de menú Axones: elimina hojas no permitidas y ramas vacías.
 */
export function filterAxonesMenuTree(
  nodes: AxonesMenuNode[],
  role?: string | null,
): AxonesMenuNode[] {
  if (isAxonesFullAccess(role)) return nodes

  const out: AxonesMenuNode[] = []
  for (const node of nodes) {
    if (isBranch(node)) {
      if (AXONES_MENU_SECTIONS_ALWAYS_VISIBLE.has(node.title)) {
        out.push({
          title: node.title,
          url: "#",
          icon: node.icon,
          items: node.items,
        })
        continue
      }
      const children = filterAxonesMenuTree(node.items, role)
      if (children.length > 0) {
        out.push({
          title: node.title,
          url: "#",
          icon: node.icon,
          items: children,
        })
      }
    } else if (isAxonesUrlAllowed(node.url, role)) {
      out.push(node)
    }
  }
  return out
}
