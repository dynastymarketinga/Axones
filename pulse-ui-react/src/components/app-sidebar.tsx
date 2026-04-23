"use client"

import * as React from "react"
import { useLocation } from "react-router-dom"
import {
  Activity,
  BadgeCheck,
  Boxes,
  CircleUserRound,
  ClipboardList,
  Factory,
  GalleryVerticalEnd,
  Package,
  PackageOpen,
  PlusCircle,
  Receipt,
  ScrollText,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
  Warehouse,
} from "lucide-react"

import { NavMain, type MenuItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getStoredUser } from "@/lib/auth-storage"
import {
  filterAxonesMenuTree,
  type AxonesMenuNode,
} from "@/lib/axones-roles"

/**
 * Menú modular Sistema Axones (URLs relativas al basename, p. ej. /axones/…).
 * Estructura alineada al documento funcional: datos maestros, inventario, producción, etc.
 */
const AXONES_MENU_TREE: AxonesMenuNode[] = [
  {
    title: "Inicio y monitoreo",
    url: "#",
    icon: Activity,
    items: [
      { title: "Resumen", url: "axones/resumen", icon: Activity },
      { title: "Alertas", url: "axones/alertas", icon: BadgeCheck },
      { title: "Asistente (próximo)", url: "axones/asistente", icon: ScrollText },
    ],
  },
  {
    title: "Datos maestros",
    url: "#",
    icon: Tags,
    items: [
      { title: "Clientes", url: "axones/clientes", icon: ClipboardList },
      { title: "Vendedores", url: "axones/vendedores", icon: BadgeCheck },
      { title: "Productos", url: "axones/productos", icon: Package },
      { title: "Crear producto", url: "axones/productos/form", icon: PlusCircle },
      { title: "Proveedores", url: "axones/proveedores", icon: Truck },
      { title: "Órdenes de compra", url: "axones/ordenes-compra", icon: ShoppingCart },
    ],
  },
  {
    title: "Inventario",
    url: "#",
    icon: Warehouse,
    items: [
      {
        title: "Recepción",
        url: "#",
        icon: PackageOpen,
        items: [
          { title: "Historial", url: "axones/recepciones-oc", icon: ScrollText },
          { title: "Nueva", url: "axones/recepciones-nueva", icon: Receipt },
        ],
      },
      { title: "Stock por área", url: "axones/inventario-areas", icon: Warehouse },
      { title: "Materiales", url: "axones/materiales", icon: Boxes },
      {
        title: "Misceláneos",
        url: "#",
        icon: Receipt,
        items: [
          { title: "Historial", url: "axones/miscelaneos", icon: ScrollText },
          { title: "Nueva (adjuntos)", url: "axones/miscelaneos/nuevo", icon: Receipt },
        ],
      },
      { title: "Movimientos", url: "axones/movimientos-inventario", icon: ScrollText },
      { title: "Bobinas", url: "axones/bobinas", icon: Package },
      { title: "Devoluciones", url: "axones/devoluciones", icon: PackageOpen },
      { title: "Solicitudes de material", url: "axones/solicitudes-material", icon: ClipboardList },
    ],
  },
  {
    title: "Producción",
    url: "#",
    icon: Factory,
    items: [
      { title: "Programación", url: "axones/programacion", icon: ClipboardList },
      { title: "Impresión (mi área)", url: "axones/impresion", icon: Factory },
      { title: "Laminación (mi área)", url: "axones/laminacion", icon: Factory },
      { title: "Corte (mi área)", url: "axones/corte", icon: Factory },
      { title: "Tintas (mi área)", url: "axones/tintas", icon: Factory },
      { title: "Órdenes de cliente", url: "axones/ordenes-cliente", icon: ScrollText },
      { title: "Órdenes de trabajo", url: "axones/ordenes-trabajo", icon: ClipboardList },
      { title: "Mezclas y tintas", url: "axones/mezclas-tinta", icon: Boxes },
    ],
  },
  {
    title: "Solicitudes por área",
    url: "#",
    icon: ClipboardList,
    items: [
      { title: "Bandeja", url: "axones/solicitudes-area", icon: ClipboardList },
    ],
  },
  {
    title: "Calidad",
    url: "#",
    icon: BadgeCheck,
    items: [{ title: "Certificados", url: "axones/calidad", icon: BadgeCheck }],
  },
  {
    title: "Despacho",
    url: "#",
    icon: Truck,
    items: [
      { title: "Saldo (corte)", url: "axones/despacho-corte", icon: Truck },
      { title: "Prefill nota", url: "axones/prefill-nota-entrega", icon: ScrollText },
      { title: "Nueva nota", url: "axones/nota-entrega-nueva", icon: Receipt },
      { title: "Historial", url: "axones/notas-entrega", icon: ScrollText },
    ],
  },
  {
    title: "Reportes",
    url: "#",
    icon: ScrollText,
    items: [{ title: "Informes", url: "axones/reportes", icon: ScrollText }],
  },
  {
    title: "Vigilancia",
    url: "#",
    icon: Shield,
    items: [
      { title: "Historial", url: "axones/vigilancia", icon: ScrollText },
      { title: "Registrar", url: "axones/vigilancia/nuevo", icon: Shield },
    ],
  },
]

const data = {
  user: {
    name: "Usuario",
    email: "usuario@axones.local",
    avatar: "",
  },
  teams: [
    {
      name: "Axones",
      logo: GalleryVerticalEnd,
      plan: "Sistema operativo",
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  useLocation()
  const session = getStoredUser()
  const navUser = session
    ? { name: session.name, email: session.email, avatar: "" }
    : data.user

  const axonesFiltered = React.useMemo(
    () => filterAxonesMenuTree(AXONES_MENU_TREE, session?.role),
    [session?.role],
  )

  const navMain = React.useMemo(
    () => [
      // Mostrar módulos Axones a la vista (sin “carpeta” contenedora)
      ...(axonesFiltered as MenuItem[]),
      {
        title: "Cuenta",
        url: "#",
        icon: CircleUserRound,
        items: [
          { title: "Perfil", url: "account/profile" },
          { title: "Contraseña", url: "account/password-setting" },
        ],
      },
    ],
    [axonesFiltered],
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} groupLabel="Menú principal" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
