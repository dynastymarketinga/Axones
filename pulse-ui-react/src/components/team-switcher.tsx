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
    plan?: string
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
          <div className="flex size-9 shrink-0 items-center justify-center bg-transparent">
            <img
              src={logoSrc}
              alt="Logo Axones"
              className="h-full w-full max-h-9 object-contain object-center"
              loading="eager"
              onError={() =>
                setLogoSrc(`${import.meta.env.BASE_URL}brand/logo-axones-var-01.png`)
              }
            />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{activeTeam.name}</span>
            {activeTeam.plan ? (
              <span className="truncate text-xs">{activeTeam.plan}</span>
            ) : null}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
