"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type CatalogPageShellProps = {
  title: string
  subtitle?: ReactNode
  icon: LucideIcon
  /** Botón principal (ej. Link como hijo de Button) */
  action?: ReactNode
  /** Contenido bajo el subtítulo (p. ej. indicador de etapa del ciclo OT). */
  headerExtras?: ReactNode
  /** Etiqueta compacta junto al título (p. ej. conteo de registros). */
  statBadge?: ReactNode
  /** Cabecera con icono en contenedor elevado (catálogos de datos maestros). */
  headerVariant?: "default" | "elevated"
  children: ReactNode
  className?: string
}

export function CatalogPageShell({
  title,
  subtitle,
  icon: Icon,
  action,
  headerExtras,
  statBadge,
  headerVariant = "default",
  children,
  className,
}: CatalogPageShellProps) {
  const elevated = headerVariant === "elevated"

  return (
    <div className={cn("space-y-6 p-4 md:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            {elevated ? (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-violet-500/15 ring-1 ring-primary/20 shadow-sm"
                aria-hidden
              >
                <Icon className="h-6 w-6 text-primary" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1">
              <h1
                className={cn(
                  "flex flex-wrap items-center gap-2 font-semibold tracking-tight",
                  elevated ? "text-2xl md:text-[1.65rem]" : "text-2xl",
                )}
              >
                {!elevated ? <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden /> : null}
                <span>{title}</span>
                {statBadge ? <span className="inline-flex shrink-0">{statBadge}</span> : null}
              </h1>
              {subtitle ? <p className="text-muted-foreground text-sm leading-relaxed">{subtitle}</p> : null}
            </div>
          </div>
          {headerExtras}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  )
}
