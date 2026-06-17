import type { AuthUser } from "@/lib/auth-storage"
import type { LucideIcon } from "lucide-react"

/** Normaliza rol del API (login) para reglas de menú. */
export function normalizeRole(role?: string | null): string {
  return (role ?? "").toLowerCase().trim()
}

const AXONES_DEVELOPER_EMAIL = "victorcarrillox2@gmail.com"

/** Solo la sesión de Víctor (Desarrollador Ingeniero) — no otros jefes ni cuentas demo. */
export function isAxonesDeveloperSession(user?: AuthUser | null): boolean {
  if (!user) return false
  const email = (user.email ?? "").toLowerCase().trim()
  return email === AXONES_DEVELOPER_EMAIL
}

const BOSS_ROLES = new Set(["boss", "admin", "jefe_supremo", "superadmin", "jefe_operaciones"])

const ACCOUNT_ADMIN_URLS = new Set([
  "account/users",
  "account/users/form",
  "account/password-reset-requests",
  "account/activity",
])

/** Solo Víctor y Valeria: gestión de cuentas, contraseñas y auditoría. */
export function isAxonesAccountAdmin(user?: AuthUser | null): boolean {
  if (!user) return false
  const role = normalizeRole(user.role)
  const email = (user.email ?? "").toLowerCase().trim()
  const username = (user.username ?? "").trim()

  if (role === "boss" && (email === AXONES_DEVELOPER_EMAIL || username === "Desarrollador")) {
    return true
  }

  return role === "admin" && username === "admin"
}

/** Jefes / admin: ven todo el menú Axones. */
export function isAxonesFullAccess(
  role?: string | null,
  _userId?: number | null,
): boolean {
  const r = normalizeRole(role)
  return BOSS_ROLES.has(r)
}

const ASSISTANT_EXTRA_ROLES = new Set(["planificador", "supervisor"])

/**
 * ¿Este rol puede usar el asistente Axones? Espejo de AssistantAccess::allows
 * en el backend (jefes + planificador/supervisor por defecto). El backend es
 * la fuente de verdad: este helper solo decide si mostrar el botón.
 */
export function canUseAxonesAssistant(role?: string | null): boolean {
  if (isAxonesFullAccess(role)) return true
  return ASSISTANT_EXTRA_ROLES.has(normalizeRole(role))
}

/** Contadores y campana de almacén (insumos + tintas pendientes). */
export function canSeeWarehouseInventoryCounts(role?: string | null): boolean {
  const r = normalizeRole(role)
  if (isAxonesFullAccess(role)) return true
  return ["inventory", "inventario", "inventory_chief", "jefe_inventario", "jefe_almacen"].includes(r)
}

const INVENTORY_CHIEF_URLS = new Set([
  "resumen",
  "alertas",
  "clientes",
  "productos",
  "productos/form",
  "proveedores",
  "materiales",
  "inventario-areas",
  "movimientos-inventario",
  "ordenes-compra",
  "ordenes-compra/nueva",
  "recepciones-oc",
  "recepciones-nueva",
  "miscelaneos",
  "miscelaneos/nuevo",
  "devoluciones",
  "solicitudes-area",
  "despacho-corte",
  "nota-entrega-nueva",
  "notas-entrega",
  "solicitudes-material",
  "reportes/inventario",
  "reportes/produccion",
  "reportes/resumen-produccion",
  "reportes/consumibles",
  "reportes/resumen-ordenes-trabajo",
  "reportes/tiempos",
  "reportes/mermas",
  "reportes/por-orden-trabajo",
])

const INVENTORY_URLS = new Set([
  "inventario-areas",
  "materiales",
  "movimientos-inventario",
  "recepciones-oc",
  "recepciones-nueva",
  "miscelaneos",
  "miscelaneos/nuevo",
  "devoluciones",
  "solicitudes-area",
  "despacho-corte",
  "nota-entrega-nueva",
  "notas-entrega",
  "solicitudes-material",
])

// Inventario + maestros operativos (sin Órdenes de compra).
const INVENTORY_WITH_MASTERS_URLS = new Set([
  ...INVENTORY_URLS,
  "clientes",
  "productos",
  "proveedores",
])

const PRINTING_URLS = new Set([
  "resumen",
  "alertas",
  "programacion",
  "impresion",
  "ordenes-trabajo",
  "ordenes-trabajo-produccion",
  "solicitudes-area",
  "solicitudes-material",
  "calidad",
  "reportes/inventario",
  "reportes/produccion",
  "reportes/resumen-produccion",
  "reportes/consumibles",
  "reportes/resumen-ordenes-trabajo",
  "reportes/tiempos",
  "reportes/mermas",
  "reportes/por-orden-trabajo",
  "tintas",
  "mezclas-tinta",
])

const LAMINACION_URLS = new Set([
  "programacion",
  "laminacion",
  "ordenes-trabajo",
  "ordenes-trabajo-produccion",
  "solicitudes-area",
  "solicitudes-material",
])

const CORTE_URLS = new Set([
  "programacion",
  "corte",
  "ordenes-trabajo",
  "solicitudes-area",
  "solicitudes-material",
])

const MONTAJE_URLS = new Set([
  "programacion",
  "montaje",
  "ordenes-trabajo",
  "ordenes-trabajo-produccion",
  "solicitudes-area",
  "solicitudes-material",
])

const TINTAS_URLS = new Set([
  "tintas",
])

const ADMIN_URLS = new Set([
  "ordenes-trabajo",
  "despacho-corte",
  "notas-entrega",
  "nota-entrega-nueva",
])

const SOLICITANTE_URLS = new Set([
  "solicitudes-area",
  "solicitudes-material",
])

/** ¿Puede el rol ver esta ruta del menú Axones? */
export function isAxonesUrlAllowed(
  url: string,
  role?: string | null,
  userId?: number | null,
  user?: AuthUser | null,
): boolean {
  if (url === "asistente") return false
  if (url === "account/profile") return true

  if (ACCOUNT_ADMIN_URLS.has(url)) {
    return isAxonesAccountAdmin(
      user ?? (role != null ? { id: userId ?? 0, name: "", email: "", role, username: null } : null),
    )
  }

  if (isAxonesFullAccess(role, userId)) return true
  // Hub de datos maestros: página contenedora (filtra internamente por rol).
  if (url === "datos-maestros") {
    return true
  }
  // Vendedores: solo boss/admin.
  if (url === "vendedores" || url === "vendedores/form") {
    return isAxonesFullAccess(role, userId)
  }
  const r = normalizeRole(role)

  if (r === "gate" || r === "vigilancia") {
    return url === "vigilancia" || url === "vigilancia/nuevo"
  }
  if (r === "inventory_chief" || r === "jefe_inventario" || r === "jefe_almacen") {
    return INVENTORY_CHIEF_URLS.has(url)
  }
  if (r === "inventory" || r === "inventario") {
    return INVENTORY_WITH_MASTERS_URLS.has(url)
  }
  if (r === "quality" || r === "calidad" || r === "planificador" || r === "supervisor") {
    return !url.startsWith("vigilancia")
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
  if (r === "montaje") {
    return MONTAJE_URLS.has(url)
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
  | { title: string; url: string; items: AxonesMenuNode[]; icon?: LucideIcon }

function isBranch(
  n: AxonesMenuNode,
): n is { title: string; url: string; items: AxonesMenuNode[]; icon?: LucideIcon } {
  return "items" in n && Array.isArray(n.items)
}

/**
 * Filtra el árbol de menú Axones: elimina hojas no permitidas y ramas vacías.
 */
export function filterAxonesMenuTree(
  nodes: AxonesMenuNode[],
  role?: string | null,
  userId?: number | null,
  user?: AuthUser | null,
): AxonesMenuNode[] {
  if (isAxonesFullAccess(role, userId)) return nodes

  const out: AxonesMenuNode[] = []
  for (const node of nodes) {
    if (isBranch(node)) {
      const children = filterAxonesMenuTree(node.items, role, userId, user)
      if (children.length > 0) {
        out.push({
          title: node.title,
          url: node.url,
          icon: node.icon,
          items: children,
        })
      }
    } else if (isAxonesUrlAllowed(node.url, role, userId, user)) {
      out.push(node)
    }
  }
  return out
}
