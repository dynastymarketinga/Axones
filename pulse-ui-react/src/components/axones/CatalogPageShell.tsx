"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type CatalogPageShellProps = {
  title: string
  subtitle: ReactNode
  icon: LucideIcon
  /** Botón principal (ej. Link como hijo de Button) */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function CatalogPageShell({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
}: CatalogPageShellProps) {
  return (
    <div className={cn("space-y-6 p-4 md:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden />
            {title}
          </h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}
