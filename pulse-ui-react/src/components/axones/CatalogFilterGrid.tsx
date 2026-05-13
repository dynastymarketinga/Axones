"use client"

import { cn } from "@/lib/utils"

type CatalogFilterGridProps = {
  children: React.ReactNode
  className?: string
}

/** Rejilla 12 columnas desde md (tablets); en pantallas pequeñas una columna. */
export function CatalogFilterGrid({ children, className }: CatalogFilterGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-12", className)}>{children}</div>
  )
}
