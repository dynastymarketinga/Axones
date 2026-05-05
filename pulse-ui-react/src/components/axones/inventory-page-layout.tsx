import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Contenedor principal de páginas de inventario (Materiales, Recepción, Devoluciones, …). */
export const AXONES_INVENTORY_PAGE_CLASS = "space-y-6 p-4 md:p-6"

/** Inputs de filtro / formulario alineados con Recepción y formularios de inventario. */
export const AXONES_INVENTORY_FILTER_INPUT_CLASS =
  "border-primary/25 bg-background/90 focus-visible:ring-primary/40"

export function AxonesPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <div className="text-muted-foreground text-sm [&_strong]:font-medium [&_strong]:text-foreground">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

/** Tarjeta con borde redondeado para filtros + tabla (patrón Materiales / Recepción). */
export function AxonesTableCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-2xl border shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Cuerpo de formulario dentro de tarjeta (misma envoltura que tabla, sin tabla). */
export function AxonesFormCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-2xl border shadow-sm",
        "p-4 md:p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}
