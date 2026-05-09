import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { getStoredUser } from "@/lib/auth-storage"
import { isAxonesUrlAllowed } from "@/lib/axones-roles"
import { cn } from "@/lib/utils"

/** Pestañas de módulo alineadas con el grupo «Inventario» del sidebar. */
export type AxonesInventoryModuleNavKey =
  | "materiales"
  | "recepciones-oc"
  | "bobinas"
  | "movimientos-inventario"
  | "devoluciones"

const INVENTORY_MODULE_NAV: {
  key: AxonesInventoryModuleNavKey
  title: string
  routeKey: string
}[] = [
  { key: "materiales", title: "Materiales", routeKey: "materiales" },
  { key: "recepciones-oc", title: "Recepción", routeKey: "recepciones-oc" },
  { key: "bobinas", title: "Bobinas", routeKey: "bobinas" },
  { key: "movimientos-inventario", title: "Movimientos", routeKey: "movimientos-inventario" },
  { key: "devoluciones", title: "Devoluciones", routeKey: "devoluciones" },
]

export function AxonesInventoryModuleNav({
  active,
}: {
  active: AxonesInventoryModuleNavKey
}) {
  const session = getStoredUser()
  const items = INVENTORY_MODULE_NAV.filter((it) =>
    isAxonesUrlAllowed(it.routeKey, session?.role, session?.id),
  )
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Módulos de inventario"
      className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-lg bg-muted/60 p-1"
    >
      {items.map((it) => {
        const isActive = it.key === active
        return (
          <Link
            key={it.key}
            to={`/${it.routeKey}`}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ring-offset-background transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "sm:text-sm",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            {it.title}
          </Link>
        )
      })}
    </nav>
  )
}

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
