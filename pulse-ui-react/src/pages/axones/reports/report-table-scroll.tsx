"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type ReportTableScrollProps = {
  children: ReactNode
  /** Ancho mínimo de la tabla para forzar scroll horizontal en pantallas estrechas. */
  tableMinWidthClass?: string
  /** Texto opcional bajo el bloque (solo visible cuando hay scroll horizontal útil). */
  scrollHint?: string
  className?: string
}

/**
 * Contenedor de tablas de reporte: scroll táctil y hint en viewports &lt; lg.
 */
export function ReportTableScroll({
  children,
  tableMinWidthClass = "min-w-[40rem]",
  scrollHint = "Desliza horizontalmente para ver todas las columnas.",
  className,
}: ReportTableScrollProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {scrollHint ? (
        <p className="text-muted-foreground text-[11px] leading-snug lg:hidden">{scrollHint}</p>
      ) : null}
      <div
        className={cn(
          "overflow-x-auto overscroll-x-contain touch-pan-x rounded-xl border bg-background shadow-sm",
          "[-webkit-overflow-scrolling:touch]",
        )}
      >
        <div className={cn("w-full", tableMinWidthClass)}>{children}</div>
      </div>
    </div>
  )
}
