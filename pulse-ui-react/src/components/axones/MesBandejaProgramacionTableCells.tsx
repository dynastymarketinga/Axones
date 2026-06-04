"use client"

import { CalendarClock, CalendarDays, ClipboardList, Flag } from "lucide-react"

import {
  BandejaIconColumnHeadLabel,
  BandejaTableHeadLabel,
  insumosBandejaTableHeadClassName,
  mesBandejaRowTopCellClass,
} from "@/components/axones/InsumosBandejaTable"
import { TableCell, TableHead } from "@/components/ui/table"
import {
  bandejaPriorityBadgeClass,
  bandejaPriorityLabel,
  formatBandejaIsoDate,
  readBandejaProgramacion,
  type BandejaProgramacion,
} from "@/lib/area-bandeja-programacion"
import type { WorkOrderListRow } from "@/types/api"
import { cn } from "@/lib/utils"

export function MesBandejaProgramacionTableHeadCells() {
  return (
    <>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2 text-center sm:px-3")}>
        <BandejaIconColumnHeadLabel icon={Flag} line1="Prioridad" title="Prioridad de la OT" />
      </TableHead>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2 text-center sm:px-3")}>
        <BandejaIconColumnHeadLabel icon={CalendarClock} line1="F. inicio" title="Fecha de inicio programada" />
      </TableHead>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2 text-center sm:px-3")}>
        <BandejaIconColumnHeadLabel icon={CalendarDays} line1="F. entrega" title="Fecha de entrega programada" />
      </TableHead>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2 text-left sm:px-3")}>
        <BandejaTableHeadLabel icon={ClipboardList}>Motivo</BandejaTableHeadLabel>
      </TableHead>
    </>
  )
}

function BandejaProgramacionPriorityCell({ prog }: { prog: BandejaProgramacion }) {
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "px-2 text-center sm:px-3")}>
      <div className="flex justify-center">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
            bandejaPriorityBadgeClass(prog.priority),
          )}
        >
          <Flag className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          {bandejaPriorityLabel(prog.priority)}
        </span>
      </div>
    </TableCell>
  )
}

function BandejaProgramacionDateCell({ value }: { value: string }) {
  const display = formatBandejaIsoDate(value)
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "px-2 text-center sm:px-3")}>
      <span className="font-mono text-sm tabular-nums text-foreground">{display}</span>
    </TableCell>
  )
}

function BandejaProgramacionMotivoCell({ motivo }: { motivo: string }) {
  const text = motivo.trim() || "—"
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "max-w-[14rem] px-2 sm:px-3")}>
      <p className="text-sm leading-snug text-foreground line-clamp-2" title={text !== "—" ? text : undefined}>
        {text}
      </p>
    </TableCell>
  )
}

export function MesBandejaProgramacionTableRowCells({ row }: { row: WorkOrderListRow }) {
  const prog = readBandejaProgramacion(row)
  return (
    <>
      <BandejaProgramacionPriorityCell prog={prog} />
      <BandejaProgramacionDateCell value={prog.fechaInicio} />
      <BandejaProgramacionDateCell value={prog.fechaEntrega} />
      <BandejaProgramacionMotivoCell motivo={prog.motivo} />
    </>
  )
}
