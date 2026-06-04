"use client"

import { useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpAZ, History, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableCell, TableHead } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { insumosBandejaTableHeadClassName, mesBandejaRowTopCellClass } from "@/components/axones/InsumosBandejaTable"
import { technicalFormFromRow, type MesBandejaMes } from "@/lib/mes-timer-band-shared"
import {
  printingTurnosBandejaSnapshot,
  sortPrintingTurnoBandejaItems,
  type PrintingTurnoBandejaItem,
} from "@/lib/printing-mes-band-status"
import type { WorkOrderListRow } from "@/types/api"
import { cn } from "@/lib/utils"
import { PrintingTurnoPersonnelBandejaCard } from "@/components/axones/printing-bandeja-modals"

const turnoHeadCellClass = cn(insumosBandejaTableHeadClassName, "px-1.5 text-center sm:px-2")
const turnoDataCellClass = cn("min-w-[8.5rem] max-w-[12rem] px-2", mesBandejaRowTopCellClass)
const turnoTextClass =
  "text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground"
const turnoCellTextClass = "text-[10px] font-semibold leading-snug"

export function MesBandejaTurnoRegistradoHeadCell() {
  return (
    <TableHead className={turnoHeadCellClass}>
      <span
        className="inline-flex w-full flex-col items-center gap-1 text-center"
        title="Turno de planta registrado en la OT"
      >
        <Users className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
        <span className={turnoTextClass}>
          Turno
          <br />
          registrado
        </span>
      </span>
    </TableHead>
  )
}

type TurnoSortOrder = "desc" | "asc"

function PrintingTurnosRegistradosModal({
  open,
  onOpenChange,
  workOrderCode,
  items,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderCode: string
  items: PrintingTurnoBandejaItem[]
}) {
  const [sortOrder, setSortOrder] = useState<TurnoSortOrder>("desc")
  const sorted = useMemo(
    () => sortPrintingTurnoBandejaItems(items, sortOrder),
    [items, sortOrder],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] max-w-lg overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Turnos registrados · {workOrderCode}
          </DialogTitle>
          <DialogDescription>
            Cuadrilla y personal por turno. Los kg y totales están en la tabla de la bandeja.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <p className="text-muted-foreground text-xs">
            <span className="font-semibold text-foreground/90">{items.length}</span> registro(s)
          </p>
          <ToggleGroup
            type="single"
            value={sortOrder}
            onValueChange={(v) => {
              if (v === "desc" || v === "asc") setSortOrder(v)
            }}
            className="h-8"
          >
            <ToggleGroupItem value="desc" className="h-8 gap-1.5 px-2.5 text-xs" aria-label="Recién creado primero">
              <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden />
              Recién creado
            </ToggleGroupItem>
            <ToggleGroupItem value="asc" className="h-8 gap-1.5 px-2.5 text-xs" aria-label="Más antiguo primero">
              <ArrowUpAZ className="h-3.5 w-3.5" aria-hidden />
              Más antiguo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ul className="max-h-[min(55vh,22rem)] space-y-2 overflow-y-auto pr-1">
          {sorted.length === 0 ? (
            <li className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
              Sin turnos guardados en esta OT.
            </li>
          ) : (
            sorted.map(({ turno, enCurso }) => (
              <li key={turno.id}>
                <PrintingTurnoPersonnelBandejaCard turno={turno} enCurso={enCurso} />
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

function PrintingTurnoRegistradoBandejaCell({ workOrder }: { workOrder: WorkOrderListRow }) {
  const [modalOpen, setModalOpen] = useState(false)
  const form = technicalFormFromRow(workOrder)
  const snapshot = useMemo(() => printingTurnosBandejaSnapshot(form), [form])

  if (snapshot.total === 0) {
    return (
      <TableCell className={turnoDataCellClass}>
        <div className="flex justify-center">
          <span className={cn(turnoCellTextClass, "font-normal text-muted-foreground")}>Sin turnos</span>
        </div>
      </TableCell>
    )
  }

  return (
    <>
      <TableCell className={turnoDataCellClass}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex w-full flex-col items-center gap-1 rounded-md text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${snapshot.total} turno(s) registrado(s). Ver detalle.`}
        >
          <Badge
            variant="secondary"
            className="h-5 min-w-[1.5rem] justify-center rounded-full px-1.5 font-mono text-[10px] font-bold tabular-nums"
          >
            {snapshot.total}
          </Badge>
          {snapshot.latestLabel ? (
            <Badge
              variant="outline"
              className={cn(
                "max-w-full truncate px-1.5 py-0 text-[10px] font-semibold leading-snug",
                snapshot.latestIsOpen
                  ? "border-violet-500/50 bg-violet-500/12 text-violet-950 dark:text-violet-100"
                  : "border-slate-500/40 bg-slate-500/10 text-slate-800 dark:text-slate-200",
              )}
              title={snapshot.latestLabel}
            >
              {snapshot.latestLabel}
            </Badge>
          ) : null}
          {snapshot.latestIsOpen ? (
            <span className={cn(turnoCellTextClass, "font-normal text-muted-foreground")}>Último · abierto</span>
          ) : (
            <span className={cn(turnoCellTextClass, "font-normal text-muted-foreground")}>Último registrado</span>
          )}
        </button>
      </TableCell>
      <PrintingTurnosRegistradosModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        workOrderCode={workOrder.code}
        items={snapshot.items}
      />
    </>
  )
}

function GenericTurnoRegistradoCell({ mesBand }: { mesBand: MesBandejaMes | null }) {
  const line = mesBand?.contextLine?.trim() || "—"
  const hasTurno =
    mesBand?.workflow === "turno_abierto" ||
    mesBand?.workflow === "iniciado" ||
    mesBand?.workflow === "pausado"

  return (
    <TableCell className={turnoDataCellClass}>
      <div className="flex flex-col items-center gap-1">
        {hasTurno ? (
          <Badge
            variant="secondary"
            className="h-5 min-w-[1.5rem] justify-center rounded-full px-1.5 font-mono text-[10px] font-bold"
          >
            1
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={cn(
            "max-w-full px-1.5 py-0 text-[10px] font-semibold leading-snug text-foreground/85",
          )}
          title={line}
        >
          <span className="line-clamp-2">{line}</span>
        </Badge>
      </div>
    </TableCell>
  )
}

export function MesBandejaTurnoRegistradoDataCell({
  area,
  mesBand,
  workOrder,
}: {
  area: string
  mesBand: MesBandejaMes | null
  workOrder?: WorkOrderListRow
}) {
  if (area === "printing" && workOrder) {
    return <PrintingTurnoRegistradoBandejaCell workOrder={workOrder} />
  }
  return <GenericTurnoRegistradoCell mesBand={mesBand} />
}
