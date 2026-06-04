"use client"

import { ChevronsLeftRight, ListOrdered } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { TableCell, TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/** Misma rejilla de columnas que Solicitudes de insumos (`/solicitudes-material`). */
export const INSUMOS_BANDEJA_TABLE_COLSPAN = 4

/** Celda de encabezado (sin tipografía; va dentro `BandejaTableHeadLabel`). */
export const insumosBandejaTableHeadClassName = "h-auto px-2 py-2.5 text-left align-bottom sm:px-3"

export const insumosBandejaTableHeadRightClassName = cn(insumosBandejaTableHeadClassName, "text-right pr-5")

export function BandejaTableHeadLabel({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
      <span className="whitespace-nowrap">{children}</span>
    </span>
  )
}

const MES_BANDEJA_INDEX_COL_WIDTH = "2.75rem"
export const MES_BANDEJA_OT_COL_WIDTH = "9.5rem"
export const MES_BANDEJA_ICON_COL_WIDTH = "4.25rem"

/** Padding vertical estándar de filas MES; contenido alineado arriba. */
export const mesBandejaRowTopCellClass = "align-top py-4"

/** Fija # y OT al deslizar en pantallas estrechas (tablet / móvil). */
export const mesBandejaStickyIndexHeadClass = cn(
  insumosBandejaTableHeadClassName,
  "w-[2.75rem] max-w-[2.75rem] px-1 pl-3 text-center align-bottom",
  "max-lg:sticky max-lg:left-0 max-lg:z-[4] max-lg:bg-primary/[0.93] max-lg:backdrop-blur-sm",
)

export const mesBandejaStickyIndexCellClass = cn(
  "w-[2.75rem] max-w-[2.75rem] px-1 pl-3 text-center",
  mesBandejaRowTopCellClass,
  "max-lg:sticky max-lg:left-0 max-lg:z-[2] max-lg:bg-background/98 max-lg:backdrop-blur-[2px]",
)

export const mesBandejaStickyOtHeadClass = cn(
  insumosBandejaTableHeadClassName,
  "pl-2",
  "max-lg:sticky max-lg:left-[2.75rem] max-lg:z-[4] max-lg:bg-primary/[0.93] max-lg:backdrop-blur-sm",
  "max-lg:shadow-[6px_0_14px_-8px_rgba(15,23,42,0.14)] dark:max-lg:shadow-[6px_0_14px_-8px_rgba(0,0,0,0.35)]",
)

export const mesBandejaStickyOtCellClass = cn(
  mesBandejaRowTopCellClass,
  "pl-2 pr-2",
  "max-lg:sticky max-lg:left-[2.75rem] max-lg:z-[2] max-lg:bg-background/98 max-lg:backdrop-blur-[2px]",
  "max-lg:shadow-[6px_0_14px_-8px_rgba(15,23,42,0.14)] dark:max-lg:shadow-[6px_0_14px_-8px_rgba(0,0,0,0.35)]",
)

/** Encabezado compacto centrado (Estado prod., Temporizador, etc.). */
export const mesBandejaIconColumnHeadClass = cn(
  insumosBandejaTableHeadClassName,
  "w-[4.25rem] max-w-[4.25rem] px-1 text-center align-bottom",
)

/** Celda compacta centrada para iconos de acción/estado (alineada arriba con turno registrado). */
export const mesBandejaIconColumnCellClass = cn(
  "w-[4.25rem] max-w-[4.25rem] px-1 py-4 text-center align-top",
)

export function BandejaIconColumnHeadLabel({
  icon: Icon,
  line1,
  line2,
  title,
  children,
}: {
  icon: LucideIcon
  line1: string
  line2?: string
  title?: string
  children?: ReactNode
}) {
  return (
    <span
      className="inline-flex w-full flex-col items-center gap-1 text-center"
      title={title ?? (line2 ? `${line1} ${line2}` : line1)}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
      <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
        {line1}
        {line2 ? (
          <>
            <br />
            {line2}
          </>
        ) : null}
      </span>
      {children}
    </span>
  )
}

/** Número de fila en la bandeja (paginado). */
export function mesBandejaRowNumber(page: number, perPage: number, rowIndex: number): number {
  const safePage = Math.max(1, page)
  const safePer = Math.max(1, perPage)
  return (safePage - 1) * safePer + rowIndex + 1
}

export function MesBandejaRowIndexHeadCell() {
  return (
    <TableHead className={mesBandejaStickyIndexHeadClass}>
      <span
        className="inline-flex w-full items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
        title="Número de fila en esta página"
      >
        <ListOrdered className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
        <span className="font-mono">#</span>
      </span>
    </TableHead>
  )
}

export function MesBandejaRowIndexDataCell({ rowNumber }: { rowNumber: number }) {
  return (
    <TableCell className={mesBandejaStickyIndexCellClass}>
      <div className="flex justify-center">
        <span
          className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md bg-muted/45 px-1.5 font-mono text-xs font-bold tabular-nums text-foreground/75 ring-1 ring-border/50"
          aria-label={`Fila ${rowNumber}`}
        >
          {rowNumber}
        </span>
      </div>
    </TableCell>
  )
}

/** Anchos MES; con kg desglosados (impresión) la tabla hace scroll horizontal si hace falta. */
export type MesBandejaTableColgroupVariant = "produccion" | "produccion-kg"

export function MesBandejaTableColgroup({
  showKgBreakdown = false,
  variant,
  pendientesArea,
  pendientesAreaColumnCount = 0,
}: {
  showKgBreakdown?: boolean
  variant?: MesBandejaTableColgroupVariant
  /** Si se indica, tabla En curso → Pendientes (programación + columnas del área). */
  pendientesArea?: string
  pendientesAreaColumnCount?: number
}) {
  if (pendientesArea && pendientesAreaColumnCount > 0) {
    return (
      <colgroup>
        <col style={{ width: MES_BANDEJA_INDEX_COL_WIDTH }} />
        <col style={{ width: "9.5rem" }} />
        <col style={{ width: "5.75rem" }} />
        <col style={{ width: "5.5rem" }} />
        <col style={{ width: "5.5rem" }} />
        <col style={{ width: "11rem" }} />
        {Array.from({ length: pendientesAreaColumnCount }).map((_, i) => (
          <col key={`${pendientesArea}-col-${i}`} style={{ width: "5.75rem" }} />
        ))}
        <col style={{ width: "9.5rem" }} />
        <col style={{ width: "5.5rem" }} />
      </colgroup>
    )
  }

  const resolved: MesBandejaTableColgroupVariant =
    variant ?? (showKgBreakdown ? "produccion-kg" : "produccion")

  if (resolved === "produccion-kg") {
    return (
      <colgroup>
        <col style={{ width: MES_BANDEJA_INDEX_COL_WIDTH }} />
        <col style={{ width: "9.5rem" }} />
        <col style={{ width: MES_BANDEJA_ICON_COL_WIDTH }} />
        <col style={{ width: MES_BANDEJA_ICON_COL_WIDTH }} />
        <col style={{ width: "8.5rem" }} />
        <col style={{ width: MES_BANDEJA_ICON_COL_WIDTH }} />
        <col style={{ width: "5.75rem" }} />
        <col style={{ width: "5.75rem" }} />
        <col style={{ width: "6.25rem" }} />
        <col style={{ width: "6.5rem" }} />
        <col style={{ width: "10rem" }} />
        <col style={{ width: "5.5rem" }} />
      </colgroup>
    )
  }

  return (
    <colgroup>
      <col style={{ width: MES_BANDEJA_INDEX_COL_WIDTH }} />
      <col style={{ width: "9.5rem" }} />
      <col style={{ width: MES_BANDEJA_ICON_COL_WIDTH }} />
      <col style={{ width: MES_BANDEJA_ICON_COL_WIDTH }} />
      <col style={{ width: "8.5rem" }} />
      <col />
      <col style={{ width: "8.25rem" }} />
    </colgroup>
  )
}

export function mesBandejaTableClassName(
  showKgBreakdownOrOptions?:
    | boolean
    | { showKgBreakdown?: boolean; pendientesMinWidth?: string },
) {
  const options =
    typeof showKgBreakdownOrOptions === "boolean"
      ? { showKgBreakdown: showKgBreakdownOrOptions }
      : (showKgBreakdownOrOptions ?? {})
  if (options.pendientesMinWidth) {
    return cn("w-full table-fixed", options.pendientesMinWidth)
  }
  return cn("w-full table-fixed", options.showKgBreakdown ? "min-w-[78rem]" : "min-w-[54rem]")
}

/** Estilo del enlace/código en columna ID (alineado a MaterialRequestsPage). */
export const insumosBandejaIdLinkClassName =
  "inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1 font-mono text-sm font-semibold text-primary tabular-nums ring-1 ring-primary/15 transition-colors hover:bg-primary/15"

export function insumosBandejaDataRowClassName(idx: number, extra?: string) {
  const hasMesRowAccent = Boolean(extra?.includes("border-l-"))
  return cn(
    "border-b border-border/60 transition-colors",
    !hasMesRowAccent && (idx % 2 === 1 ? "bg-muted/25" : "bg-card/80"),
    !hasMesRowAccent && "hover:bg-violet-500/[0.06]",
    extra,
  )
}

/** Aviso de scroll horizontal en tablas anchas (móvil / tablet). */
export function BandejaWideTableScrollHint({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground mb-2 flex items-center gap-2 rounded-lg border border-primary/15",
        "bg-muted/35 px-3 py-2 text-[11px] leading-snug sm:text-xs lg:hidden",
        className,
      )}
      role="note"
    >
      <ChevronsLeftRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>Deslice horizontalmente para ver kg, material y acciones. La OT queda fija a la izquierda.</span>
    </p>
  )
}

/** Tarjeta con gradiente y borde como la tabla de solicitudes de insumos. */
export function InsumosBandejaTableCard({
  children,
  wideTable = false,
}: {
  children: ReactNode
  /** Muestra aviso de scroll en pantallas &lt; lg. */
  wideTable?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-violet-500/[0.07] shadow-md shadow-primary/5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
      {wideTable ? <div className="px-3 pt-3 sm:px-4"><BandejaWideTableScrollHint /></div> : null}
      <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  )
}
