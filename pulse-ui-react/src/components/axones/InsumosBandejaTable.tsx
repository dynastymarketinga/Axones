"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Misma rejilla de columnas que Solicitudes de insumos (`/solicitudes-material`). */
export const INSUMOS_BANDEJA_TABLE_COLSPAN = 4

/** Estilo del enlace/código en columna ID (alineado a MaterialRequestsPage). */
export const insumosBandejaIdLinkClassName =
  "inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary tabular-nums ring-1 ring-primary/15 transition-colors hover:bg-primary/15"

export function insumosBandejaDataRowClassName(idx: number, extra?: string) {
  return cn(
    "border-b border-border/60 transition-colors",
    idx % 2 === 1 ? "bg-muted/25" : "bg-card/80",
    "hover:bg-violet-500/[0.06]",
    extra,
  )
}

/** Tarjeta con gradiente y borde como la tabla de solicitudes de insumos. */
export function InsumosBandejaTableCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-violet-500/[0.07] shadow-md shadow-primary/5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
