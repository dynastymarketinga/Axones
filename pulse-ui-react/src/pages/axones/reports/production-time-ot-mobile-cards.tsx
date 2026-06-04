"use client"

import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  formatDurationHms,
  isProductionTimeReportArea,
  PRODUCTION_AREA_LABELS,
  type WorkOrderTimeCandidate,
} from "./report-shared"

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 font-mono text-sm tabular-nums">{value}</p>
    </div>
  )
}

type OtMobileCardProps = {
  row: WorkOrderTimeCandidate
  index: number
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}

function OtMobileCard({ row, index, selected, onSelect, onOpen }: OtMobileCardProps) {
  const areas = row.areas.filter(isProductionTimeReportArea)

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "rounded-xl border bg-background p-3 shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary/40 bg-primary/[0.06] ring-1 ring-primary/25" : "border-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-medium tabular-nums">N.º {index + 1}</p>
          <p className="truncate font-mono text-sm font-semibold">{row.work_order_code}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {[row.client_name, row.product_name].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 tabular-nums text-[11px]">
          {row.effective_percent}% ef.
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric label="Efectivo" value={formatDurationHms(row.production_seconds)} />
        <Metric label="Muerto" value={formatDurationHms(row.downtime_seconds)} />
        <Metric label="Montaje" value={formatDurationHms(row.mount_seconds)} />
        <Metric label="Desmontaje" value={formatDurationHms(row.demount_seconds)} />
        <Metric label="Total" value={formatDurationHms(row.total_seconds)} />
      </div>

      {areas.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {areas.map((a) => (
            <Badge key={a} variant="outline" className="text-[10px] font-normal">
              {PRODUCTION_AREA_LABELS[a] ?? a}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-primary/25 sm:flex-1"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          Abrir
        </Button>
        <Button asChild variant="outline" size="sm" className="w-full border-primary/25 sm:flex-1">
          <Link to={`/ordenes-trabajo/${row.work_order_id}`} onClick={(e) => e.stopPropagation()}>
            Ver OT
          </Link>
        </Button>
      </div>
    </article>
  )
}

type ProductionTimeOtMobileCardsProps = {
  candidates: WorkOrderTimeCandidate[]
  loading: boolean
  selectedWoId: string
  aggregateAll: boolean
  emptyMessage: string
  onSelectRow: (row: WorkOrderTimeCandidate) => void
  onOpenRow: (row: WorkOrderTimeCandidate) => void
  totalsFooter: {
    prod: number
    down: number
    mount: number
    demount: number
    total: number
    eff: string
  } | null
}

export function ProductionTimeOtMobileCards({
  candidates,
  loading,
  selectedWoId,
  aggregateAll,
  emptyMessage,
  onSelectRow,
  onOpenRow,
  totalsFooter,
}: ProductionTimeOtMobileCardsProps) {
  const selectedId = selectedWoId.trim() === "" ? null : Number(selectedWoId.trim())

  if (loading) {
    return <p className="text-muted-foreground text-sm">Cargando órdenes…</p>
  }

  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3 lg:hidden">
      {candidates.map((row, idx) => (
        <OtMobileCard
          key={row.work_order_id}
          row={row}
          index={idx}
          selected={!aggregateAll && selectedId === row.work_order_id}
          onSelect={() => onSelectRow(row)}
          onOpen={() => onOpenRow(row)}
        />
      ))}
      {totalsFooter ? (
        <div className="rounded-xl border border-primary/20 bg-muted/30 p-3 text-sm">
          <p className="mb-2 font-medium">Totales (órdenes listadas)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Efectivo" value={formatDurationHms(totalsFooter.prod)} />
            <Metric label="Muerto" value={formatDurationHms(totalsFooter.down)} />
            <Metric label="Montaje" value={formatDurationHms(totalsFooter.mount)} />
            <Metric label="Desmontaje" value={formatDurationHms(totalsFooter.demount)} />
            <Metric label="Total" value={formatDurationHms(totalsFooter.total)} />
            <Metric label="% ef." value={`${totalsFooter.eff}%`} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
