"use client"

import { cn } from "@/lib/utils"

type CatalogFilterGridProps = {
  children: React.ReactNode
  className?: string
}

/** Rejilla 12 columnas en lg, misma base que Órdenes de compra */
export function CatalogFilterGrid({ children, className }: CatalogFilterGridProps) {
  return (
    <div className={cn("grid gap-3 lg:grid-cols-12", className)}>{children}</div>
  )
}
