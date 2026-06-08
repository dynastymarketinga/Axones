"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type CatalogActiveStatusBadgeProps = {
  active: boolean
  className?: string
}

export function CatalogActiveStatusBadge({ active, className }: CatalogActiveStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium tabular-nums",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-muted-foreground/20 bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </Badge>
  )
}
