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
import { AXONES_MENU_TREE, getAccountLeaves } from "@/lib/axones-menu"
import { filterAxonesMenuTree } from "@/lib/axones-roles"

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

  const axonesFiltered = React.useMemo(
    () => filterAxonesMenuTree(AXONES_MENU_TREE, session?.role, session?.id),
    [session?.id, session?.role],
  )

  const accountLeaves = React.useMemo(
    () => getAccountLeaves(session?.role, session?.id),
    [session?.id, session?.role],
  )

  const navMain = React.useMemo(
    () => [
      // Mostrar módulos Axones a la vista (sin “carpeta” contenedora)
      ...(axonesFiltered as MenuItem[]),
      {
        title: "Cuenta",
        url: "#",
        icon: CircleUserRound,
        items: [...accountLeaves],
      },
    ],
    [accountLeaves, axonesFiltered],
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
