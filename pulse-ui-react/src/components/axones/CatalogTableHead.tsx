"use client"

import type { LucideIcon } from "lucide-react"

import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

type CatalogTableHeadProps = {
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}

export function CatalogTableHead({ icon: Icon, children, className }: CatalogTableHeadProps) {
  return (
    <TableHead className={className}>
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {children}
      </span>
    </TableHead>
  )
}

export function CatalogTableHeadRight({
  icon: Icon,
  children,
  className,
}: CatalogTableHeadProps) {
  return (
    <TableHead className={cn("text-right", className)}>
      <span className="inline-flex w-full items-center justify-end gap-1.5">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {children}
      </span>
    </TableHead>
  )
}

/** Hueco invisible igual que icono + gap en `CatalogTableHead`, para alinear el texto de la fila con la etiqueta. */
export function CatalogTableBodyCellContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1.5", className)}>
      <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </span>
  )
}

/** Igual que arriba pero con `justify-end`, para parejas con `CatalogTableHeadRight`. */
export function CatalogTableBodyCellContentRight({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("inline-flex w-full items-center justify-end gap-1.5", className)}>
      <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
      {children}
    </span>
  )
}
