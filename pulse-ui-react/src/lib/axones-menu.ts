import {
  Activity,
  BadgeCheck,
  Boxes,
  ClipboardList,
  Factory,
  Package,
  PackageOpen,
  Receipt,
  ScrollText,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
} from "lucide-react"

import { isAxonesFullAccess, type AxonesMenuNode } from "@/lib/axones-roles"
import { CLIENT_ORDER_MODULE_TITLE } from "@/pages/axones/client-order-i18n"

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
      { title: "Productos", url: "productos", icon: Package },
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
      {
        title: "Recepción",
        url: "recepciones-oc",
        icon: PackageOpen,
      },
      { title: "Bobinas", url: "bobinas", icon: Package },
      { title: "Movimientos", url: "movimientos-inventario", icon: ScrollText },
      {
        title: "Misceláneos",
        url: "#",
        icon: Receipt,
        items: [
          { title: "Historial", url: "miscelaneos", icon: ScrollText },
          { title: "Nueva (adjuntos)", url: "miscelaneos/nuevo", icon: Receipt },
        ],
      },
      { title: "Devoluciones", url: "devoluciones", icon: PackageOpen },
    ],
  },
  {
    title: "Producción",
    url: "#",
    icon: Factory,
    items: [
      { title: "Programación", url: "programacion", icon: ClipboardList },
      { title: "Impresión (mi área)", url: "impresion", icon: Factory },
      { title: "Laminación (mi área)", url: "laminacion", icon: Factory },
      { title: "Corte (mi área)", url: "corte", icon: Factory },
      { title: "Tintas (mi área)", url: "tintas", icon: Factory },
      { title: CLIENT_ORDER_MODULE_TITLE, url: "ordenes-cliente", icon: ScrollText },
      { title: "Órdenes de trabajo", url: "ordenes-trabajo", icon: ClipboardList },
      { title: "Mezclas y tintas", url: "mezclas-tinta", icon: Boxes },
    ],
  },
  {
    title: "Solicitudes por área",
    url: "#",
    icon: ClipboardList,
    items: [
      { title: "Bandeja", url: "solicitudes-area", icon: ClipboardList },
    ],
  },
  {
    title: "Calidad",
    url: "#",
    icon: BadgeCheck,
    items: [{ title: "Certificados", url: "calidad", icon: BadgeCheck }],
  },
  {
    title: "Despacho",
    url: "#",
    icon: Truck,
    items: [
      { title: "Producto terminado", url: "despacho-corte", icon: Truck },
      { title: "Solicitudes de material", url: "solicitudes-material", icon: ClipboardList },
    ],
  },
  {
    title: "Reportes",
    url: "#",
    icon: ScrollText,
    items: [{ title: "Informes", url: "reportes", icon: ScrollText }],
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

const AXONES_ACCOUNT_LEAVES_BASE: { title: string; url: string }[] = [
  { title: "Perfil", url: "account/profile" },
]

const ACCOUNT_PASSWORD_RESET_REQUESTS: { title: string; url: string } = {
  title: "Solicitudes de contraseña",
  url: "account/password-reset-requests",
}

/** Hojas de menú Cuenta visibles según rol (jefes ven solicitudes internas de restablecimiento). */
export function getAccountLeaves(
  role?: string | null,
  userId?: number | null,
): { title: string; url: string }[] {
  const leaves = [...AXONES_ACCOUNT_LEAVES_BASE]
  if (isAxonesFullAccess(role, userId)) {
    leaves.push(ACCOUNT_PASSWORD_RESET_REQUESTS)
  }
  return leaves
}

/** @deprecated Usar getAccountLeaves para filtrar por rol */
export const AXONES_ACCOUNT_LEAVES = AXONES_ACCOUNT_LEAVES_BASE
