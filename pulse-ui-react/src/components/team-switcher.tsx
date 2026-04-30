import * as React from "react"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function TeamSwitcher({
  teams,
}: {
  teams: {
    name: string
    logo?: React.ElementType
    plan: string
  }[]
}) {
  const [activeTeam] = React.useState(teams[0])
  const [logoSrc, setLogoSrc] = React.useState(
    `${import.meta.env.BASE_URL}brand/logo-axones-1.png`,
  )

  if (!activeTeam) {
    return null
  }

  // En Axones no necesitamos selector de equipos.
  // Se deja un encabezado fijo sin dropdown para evitar UI innecesaria (Teams/Add team).
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg">
          <div className="flex aspect-square size-9 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary">
            <img
              src={logoSrc}
              alt="Logo Axones"
              className="h-full w-full object-cover object-top scale-110"
              loading="eager"
              onError={() =>
                setLogoSrc(`${import.meta.env.BASE_URL}brand/logo-axones-main.svg`)
              }
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{activeTeam.name}</span>
            <span className="truncate text-xs">{activeTeam.plan}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
