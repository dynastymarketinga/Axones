import {
  Activity,
  BadgeCheck,
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  FlaskConical,
  History,
  KeyRound,
  Layers2,
  Package,
  PackageOpen,
  Puzzle,
  Scissors,
  ScrollText,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
  UserRound,
  Users,
  Warehouse,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { isAxonesAccountAdmin, type AxonesMenuNode } from "@/lib/axones-roles"
import { CLIENT_ORDER_MODULE_TITLE } from "@/pages/axones/client-order-i18n"
import type { AuthUser } from "@/lib/auth-storage"

const MENU_HIDDEN_URLS = new Set([
  "miscelaneos",
  "miscelaneos/nuevo",
  "asistente",
])

function hideMenuNodes(nodes: AxonesMenuNode[]): AxonesMenuNode[] {
  return nodes.flatMap((node) => {
    if ("items" in node && Array.isArray(node.items)) {
      const visibleChildren = hideMenuNodes(node.items)
      if (visibleChildren.length === 0) return []
      return [{ ...node, items: visibleChildren }]
    }
    return MENU_HIDDEN_URLS.has(node.url) ? [] : [node]
  })
}

/**
 * Menú Sistema Axones (URLs relativas al basename, p. ej. `/resumen` con basename `/axones`).
 * Misma estructura que el sidebar: el árbol se filtra con `filterAxonesMenuTree`.
 */
const AXONES_MENU_TREE_BASE: AxonesMenuNode[] = [
  {
    title: "Inicio y monitoreo",
    url: "#",
    icon: Activity,
    items: [
      { title: "Resumen", url: "resumen", icon: Activity },
      { title: "Alertas", url: "alertas", icon: BadgeCheck },
      { title: "Asistente (próximo)", url: "asistente", icon: ScrollText },
    ],
  },
  {
    title: "Datos maestros",
    url: "datos-maestros",
    icon: Tags,
    items: [
      { title: "Vendedores", url: "vendedores", icon: Users },
      { title: "Clientes", url: "clientes", icon: ClipboardList },
      { title: "Especificaciones de producto", url: "productos", icon: Package },
      { title: "Proveedores", url: "proveedores", icon: Truck },
      { title: "Órdenes de compra", url: "ordenes-compra", icon: ShoppingCart },
    ],
  },
  {
    title: "Inventario",
    url: "#",
    icon: Warehouse,
    items: [
      { title: "Materiales", url: "materiales", icon: Boxes },
      { title: "Solicitudes entre áreas", url: "solicitudes-area", icon: ClipboardList },
      {
        title: "Recepción",
        url: "recepciones-oc",
        icon: PackageOpen,
      },
      { title: "Movimientos", url: "movimientos-inventario", icon: ScrollText },
      { title: "Devoluciones", url: "devoluciones", icon: PackageOpen },
    ],
  },
  {
    title: "Producción",
    url: "#",
    icon: Factory,
    items: [
      { title: "Programación", url: "programacion", icon: ClipboardList },
      { title: "Montaje", url: "montaje", icon: Puzzle },
      { title: "Impresión", url: "impresion", icon: Factory },
      { title: "Laminación", url: "laminacion", icon: Layers2 },
      { title: "Corte", url: "corte", icon: Scissors },
      { title: "Tintas y Mezcla de tinta", url: "tintas", icon: Factory },
      { title: CLIENT_ORDER_MODULE_TITLE, url: "ordenes-cliente", icon: ScrollText },
      { title: "Órdenes de trabajo", url: "ordenes-trabajo", icon: ClipboardList },
    ],
  },
  { title: "Solicitudes de insumos", url: "solicitudes-material", icon: Package },
  {
    title: "Calidad",
    url: "#",
    icon: BadgeCheck,
    items: [{ title: "Certificados", url: "calidad", icon: BadgeCheck }],
  },
  { title: "Despacho", url: "despacho-corte", icon: Truck },
  {
    title: "Reportes",
    url: "#",
    icon: ScrollText,
    items: [
      { title: "Inventario", url: "reportes/inventario", icon: Boxes },
      { title: "Producción y tiempos", url: "reportes/produccion", icon: Activity },
      { title: "Resumen de producción", url: "reportes/resumen-produccion", icon: BarChart3 },
      { title: "Reporte de consumible", url: "reportes/consumibles", icon: FlaskConical },
      { title: "Resumen de órdenes de trabajo", url: "reportes/resumen-ordenes-trabajo", icon: ClipboardList },
      { title: "Desperdicio", url: "reportes/mermas", icon: PackageOpen },
      { title: "Material por OT", url: "reportes/por-orden-trabajo", icon: Boxes },
    ],
  },
  {
    title: "Vigilancia",
    url: "#",
    icon: Shield,
    items: [
      { title: "Historial", url: "vigilancia", icon: ScrollText },
      { title: "Registrar", url: "vigilancia/nuevo", icon: Shield },
    ],
  },
]

export const AXONES_MENU_TREE: AxonesMenuNode[] = hideMenuNodes(AXONES_MENU_TREE_BASE)

export type AxonesAccountMenuLeaf = {
  title: string
  url: string
  icon: LucideIcon
}

const AXONES_ACCOUNT_LEAVES_BASE: AxonesAccountMenuLeaf[] = [
  { title: "Perfil", url: "account/profile", icon: UserRound },
]

/** Rutas Cuenta para migas de pan (independiente del rol visible en menú). */
export const AXONES_ACCOUNT_BREADCRUMB_LEAVES: { title: string; url: string }[] = [
  { title: "Perfil", url: "account/profile" },
  { title: "Usuarios", url: "account/users" },
  { title: "Solicitudes de contraseña", url: "account/password-reset-requests" },
  { title: "Actividad reciente", url: "account/activity" },
]

const ACCOUNT_USERS: AxonesAccountMenuLeaf = {
  title: "Usuarios",
  url: "account/users",
  icon: Users,
}

const ACCOUNT_PASSWORD_RESET_REQUESTS: AxonesAccountMenuLeaf = {
  title: "Solicitudes de contraseña",
  url: "account/password-reset-requests",
  icon: KeyRound,
}

const ACCOUNT_ACTIVITY: AxonesAccountMenuLeaf = {
  title: "Actividad reciente",
  url: "account/activity",
  icon: History,
}

/** Hojas de menú Cuenta visibles según rol (solo Víctor y Valeria gestionan cuentas). */
export function getAccountLeaves(user?: AuthUser | null): AxonesAccountMenuLeaf[] {
  const leaves = [...AXONES_ACCOUNT_LEAVES_BASE]
  if (isAxonesAccountAdmin(user)) {
    leaves.push(ACCOUNT_USERS, ACCOUNT_PASSWORD_RESET_REQUESTS, ACCOUNT_ACTIVITY)
  }
  return leaves
}

/** @deprecated Usar getAccountLeaves para filtrar por rol */
export const AXONES_ACCOUNT_LEAVES = AXONES_ACCOUNT_LEAVES_BASE
