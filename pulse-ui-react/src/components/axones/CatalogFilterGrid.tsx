"use client"

import { cn } from "@/lib/utils"

type CatalogFilterGridProps = {
  children: React.ReactNode
  className?: string
}

/** Una columna en móvil; desde `md` rejilla de 12 columnas. Los hijos deben usar `md:col-span-*` (no solo `lg:`) para no quedar en celdas de 1/12 entre md y lg. */
export function CatalogFilterGrid({ children, className }: CatalogFilterGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-12", className)}>{children}</div>
  )
}
