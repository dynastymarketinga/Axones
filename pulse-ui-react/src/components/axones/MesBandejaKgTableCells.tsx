"use client"

import type { LucideIcon } from "lucide-react"
import { ArrowDownToLine, ChevronDown, Disc3, Scale, Sigma, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TableCell, TableHead, TableRow } from "@/components/ui/table"
import type { MesBandejaDevolucionesSnapshot } from "@/lib/printing-mes-band-devoluciones"
import {
  mesBandejaDevolucionesRegistroCount,
  type MesBandejaDevolucionesTotals,
} from "@/lib/printing-mes-band-devoluciones"
import { insumosBandejaTableHeadClassName } from "@/components/axones/InsumosBandejaTable"
import {
  MES_BANDEJA_KG_TOTAL_HEAD_LABEL,
  MES_BANDEJA_PRE_KG_COLUMN_COUNT,
  mesBandejaMasaTotalKg,
  type MesBandejaKgTotals,
  type MesBandejaMes,
} from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

const kgHeadCellClass = cn(insumosBandejaTableHeadClassName, "px-1.5 text-center sm:px-2")
const kgDataCellClass = cn("min-w-[5.25rem] px-1.5 text-center sm:px-2", "align-top py-4")

function BandejaKgTableHeadLabel({
  icon: Icon,
  title,
  line1,
  line2,
}: {
  icon: LucideIcon
  title: string
  line1: string
  line2?: string
}) {
  return (
    <span
      className="inline-flex w-full flex-col items-center gap-1 text-center"
      title={title}
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
    </span>
  )
}

function KgValue({ kg, emphasized }: { kg: number | null | undefined; emphasized?: boolean }) {
  if (kg == null) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center leading-none",
        emphasized ? "text-primary" : "text-foreground/80",
      )}
    >
      <span className={cn("font-mono text-sm tabular-nums", emphasized && "font-semibold")}>
        {kg.toFixed(2)}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[10px] font-normal",
          emphasized ? "text-primary/70" : "text-muted-foreground",
        )}
      >
        Kg
      </span>
    </span>
  )
}

function KgDataCell({
  kg,
  emphasized,
}: {
  kg: number | null | undefined
  emphasized?: boolean
}) {
  return (
    <TableCell className={cn(kgDataCellClass, emphasized && "bg-primary/[0.05]")}>
      <div className="flex justify-center">
        <KgValue kg={kg} emphasized={emphasized} />
      </div>
    </TableCell>
  )
}

export function MesBandejaKgTableHeadCells() {
  return (
    <>
      <TableHead className={kgHeadCellClass}>
        <BandejaKgTableHeadLabel
          icon={Scale}
          title="Producido acumulado (salida bobina impresa)"
          line1="Producido"
          line2="acum."
        />
      </TableHead>
      <TableHead className={kgHeadCellClass}>
        <BandejaKgTableHeadLabel
          icon={ArrowDownToLine}
          title="Entrada acumulada (bobina virgen)"
          line1="Entrada"
          line2="acum."
        />
      </TableHead>
      <TableHead className={kgHeadCellClass}>
        <BandejaKgTableHeadLabel
          icon={Trash2}
          title="Desperdicio acumulado"
          line1="Desperd."
          line2="acum."
        />
      </TableHead>
      <TableHead className={kgHeadCellClass}>
        <BandejaKgTableHeadLabel
          icon={Sigma}
          title={`${MES_BANDEJA_KG_TOTAL_HEAD_LABEL}: suma de producido + entrada + desperdicio`}
          line1="Total"
          line2="masa"
        />
      </TableHead>
    </>
  )
}

export function MesBandejaBobinasHeadCell() {
  return (
    <TableHead className={kgHeadCellClass}>
      <BandejaKgTableHeadLabel
        icon={Disc3}
        title="Kilos devueltos acumulados (buena + mala). Pulse para desglose."
        line1="Bobinas"
      />
    </TableHead>
  )
}

export function MesBandejaKgTableRowCells({ mesBand }: { mesBand: MesBandejaMes | null }) {
  const total = mesBandejaMasaTotalKg(mesBand)
  return (
    <>
      <KgDataCell kg={mesBand?.producidoKg} />
      <KgDataCell kg={mesBand?.entradaKg} />
      <KgDataCell kg={mesBand?.desperdicioKg} />
      <KgDataCell kg={total} emphasized />
    </>
  )
}

type MesBandejaBobinasDataCellProps = {
  devoluciones: MesBandejaDevolucionesSnapshot | null
  expanded?: boolean
  onToggle?: () => void
}

/** Contador en kg devueltos; al pulsar expande fila con buena/mala acumulados. */
export function MesBandejaBobinasDataCell({
  devoluciones,
  expanded = false,
  onToggle,
}: MesBandejaBobinasDataCellProps) {
  const buenaKg = devoluciones?.buenaTotalKg ?? 0
  const malaKg = devoluciones?.malaTotalKg ?? 0
  const totalKg = buenaKg + malaKg
  const registroCount = devoluciones ? mesBandejaDevolucionesRegistroCount(devoluciones) : 0

  return (
    <TableCell className={cn(kgDataCellClass, "bg-violet-500/[0.04]")}>
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto min-w-[3.25rem] flex-col gap-0.5 px-2 py-1.5",
            expanded
              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
              : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
          )}
          title={`Devolución buena: ${buenaKg.toFixed(2)} Kg · Mala: ${malaKg.toFixed(2)} Kg${registroCount > 0 ? ` · ${registroCount} registro(s)` : ""}`}
          aria-expanded={expanded}
          aria-label={`Bobinas devueltas: ${totalKg.toFixed(2)} Kg (buena ${buenaKg.toFixed(2)}, mala ${malaKg.toFixed(2)})`}
          onClick={onToggle}
        >
          <span className="inline-flex items-center gap-1">
            <Disc3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="inline-flex flex-col items-center leading-none">
              <span className="font-mono text-sm font-bold tabular-nums">{totalKg.toFixed(2)}</span>
              <span className="mt-0.5 text-[10px] font-normal opacity-80">Kg</span>
            </span>
          </span>
          <ChevronDown
            className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </Button>
      </div>
    </TableCell>
  )
}

function KgTotalValue({ kg, emphasized }: { kg: number; emphasized?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex flex-col items-center leading-none",
        emphasized ? "text-primary" : "text-foreground",
      )}
    >
      <span className={cn("font-mono tabular-nums sm:text-base", emphasized && "font-bold")}>
        {kg.toFixed(2)}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[10px] font-semibold uppercase tracking-wide",
          emphasized ? "text-primary/75" : "text-muted-foreground",
        )}
      >
        Kg
      </span>
    </span>
  )
}

function BobinasDevolucionTotalValue({ devoluciones }: { devoluciones: MesBandejaDevolucionesTotals }) {
  return (
    <div className="flex min-h-[2.75rem] flex-col items-center justify-center gap-1 leading-none">
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
        <span className="opacity-75">B</span>
        <span className="font-mono">{devoluciones.buenaTotalKg.toFixed(2)}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums text-rose-800 dark:text-rose-200">
        <span className="opacity-75">M</span>
        <span className="font-mono">{devoluciones.malaTotalKg.toFixed(2)}</span>
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Kg</span>
    </div>
  )
}

type MesBandejaKgTableTotalsRowProps = {
  totals: MesBandejaKgTotals
  devolucionesTotals?: MesBandejaDevolucionesTotals | null
}

/** Fila de totalizado al pie de la bandeja MES (solo sumas numéricas). */
export function MesBandejaKgTableTotalsRow({
  totals,
  devolucionesTotals,
}: MesBandejaKgTableTotalsRowProps) {
  return (
    <TableRow className="border-t-2 border-primary/25 bg-gradient-to-r from-primary/[0.1] via-primary/[0.06] to-violet-500/[0.08] hover:bg-primary/[0.08]">
      <TableCell
        colSpan={MES_BANDEJA_PRE_KG_COLUMN_COUNT}
        className="py-3.5 pl-3 pr-2 align-middle"
        aria-hidden
      />
      <TableCell className={cn(kgDataCellClass, "bg-violet-500/[0.06] py-3.5")}>
        {devolucionesTotals ? (
          <BobinasDevolucionTotalValue devoluciones={devolucionesTotals} />
        ) : null}
      </TableCell>
      <TableCell className={cn(kgDataCellClass, "bg-primary/[0.04] py-3.5")}>
        <div className="flex min-h-[2.75rem] items-center justify-center">
          <KgTotalValue kg={totals.producidoKg} />
        </div>
      </TableCell>
      <TableCell className={cn(kgDataCellClass, "bg-primary/[0.04] py-3.5")}>
        <div className="flex min-h-[2.75rem] items-center justify-center">
          <KgTotalValue kg={totals.entradaKg} />
        </div>
      </TableCell>
      <TableCell className={cn(kgDataCellClass, "bg-primary/[0.04] py-3.5")}>
        <div className="flex min-h-[2.75rem] items-center justify-center">
          <KgTotalValue kg={totals.desperdicioKg} />
        </div>
      </TableCell>
      <TableCell className={cn(kgDataCellClass, "bg-primary/10 py-3.5 ring-1 ring-inset ring-primary/15")}>
        <div className="flex min-h-[2.75rem] items-center justify-center">
          <KgTotalValue kg={totals.totalMasaKg} emphasized />
        </div>
      </TableCell>
      <TableCell colSpan={2} className="py-3.5 align-middle" aria-hidden />
    </TableRow>
  )
}
