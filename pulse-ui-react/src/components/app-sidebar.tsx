"use client"

import * as React from "react"
import { useLocation } from "react-router-dom"
import { CircleUserRound } from "lucide-react"

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
import { useAreaRequestCounts } from "@/hooks/useAreaRequestCounts"
import { AXONES_MENU_TREE, getAccountLeaves } from "@/lib/axones-menu"
import { filterAxonesMenuTree } from "@/lib/axones-roles"

const AREA_COUNT_AREAS = ["impresion", "laminacion", "corte", "tintas"] as const

const data = {
  user: {
    name: "Usuario",
    email: "usuario@axones.local",
    avatar: "",
  },
  teams: [
    {
      name: "Axones",
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

  const { data: areaCounts } = useAreaRequestCounts({
    status: "pending",
    areas: AREA_COUNT_AREAS as unknown as string[],
  })

  const axonesFiltered = React.useMemo(
    () => filterAxonesMenuTree(AXONES_MENU_TREE, session?.role, session?.id),
    [session?.id, session?.role],
  )

  const axonesWithCounts = React.useMemo(() => {
    const counts = areaCounts?.counts ?? {}
    const byUrl: Record<string, number> = {
      impresion: counts.impresion ?? 0,
      laminacion: counts.laminacion ?? 0,
      corte: counts.corte ?? 0,
      tintas: counts.tintas ?? 0,
    }

    const add = (nodes: any[]): any[] =>
      nodes.map((n) => {
        if (n && Array.isArray(n.items)) {
          return { ...n, items: add(n.items) }
        }
        const url = typeof n?.url === "string" ? n.url : ""
        const badgeCount = byUrl[url] ?? 0
        return badgeCount > 0 ? { ...n, badgeCount } : n
      })

    return add(axonesFiltered as any)
  }, [areaCounts?.counts, axonesFiltered])

  const accountLeaves = React.useMemo(
    () => getAccountLeaves(session?.role, session?.id),
    [session?.id, session?.role],
  )

  const navMain = React.useMemo(
    () => [
      // Mostrar módulos Axones a la vista (sin “carpeta” contenedora)
      ...(axonesWithCounts as MenuItem[]),
      {
        title: "Cuenta",
        url: "#",
        icon: CircleUserRound,
        items: [...accountLeaves],
      },
    ],
    [accountLeaves, axonesWithCounts],
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
