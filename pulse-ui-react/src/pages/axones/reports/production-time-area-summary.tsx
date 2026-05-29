"use client"

import { useMemo } from "react"
import { BarChart3, Hash, Layers, ListOrdered } from "lucide-react"

import {
  CatalogTableHead,
} from "@/components/axones/CatalogTableHead"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  formatDurationHms,
  PRODUCTION_AREA_LABELS,
  PRODUCTION_AREA_ORDER,
  REPORT_EMPTY_PRODUCTION_TIME_BY_AREA,
  rollupByArea,
  sumAggRowsTotals,
  sumCandidateTotals,
  type ProductionTimeAggRow,
  type WorkOrderTimeCandidate,
} from "./report-shared"
import {
  PRODUCTION_TIME_NUM_HEAD_CLASS,
  ProductionTimeTableHead,
} from "./production-time-table-head"

const AREA_SUMMARY_COL_COUNT = 7

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-background/80 p-3 shadow-sm">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums tracking-tight">{value}</p>
      {sub ? <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p> : null}
    </div>
  )
}

export function ProductionTimePlantKpi({ candidates }: { candidates: WorkOrderTimeCandidate[] }) {
  const totals = useMemo(
    () => (candidates.length > 0 ? sumCandidateTotals(candidates) : null),
    [candidates],
  )

  if (!totals) {
    return (
      <p className="text-muted-foreground text-sm">Sin datos de planta en el período seleccionado.</p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <KpiCard label="Efectivo (planta)" value={formatDurationHms(totals.prod)} />
      <KpiCard label="Muerto (planta)" value={formatDurationHms(totals.down)} />
      <KpiCard label="Montaje op." value={formatDurationHms(totals.mount)} sub="Operación mount, no área" />
      <KpiCard label="Desmontaje" value={formatDurationHms(totals.demount)} />
      <KpiCard label="Total" value={formatDurationHms(totals.total)} />
      <KpiCard label="% ef. planta" value={`${totals.eff}%`} />
    </div>
  )
}

export function ProductionTimeAreaKpiCards({
  areaRows,
}: {
  areaRows: ReturnType<typeof rollupByArea>
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {areaRows.map((row) => {
        const hasData = row.segment_count > 0
        const totalSec = row.prod_sec + row.down_sec + row.mount_sec + row.demount_sec
        const eff =
          totalSec > 0 ? `${((row.prod_sec / totalSec) * 100).toFixed(1)}%` : "—"
        return (
          <div
            key={row.area}
            className={cn(
              "rounded-xl border p-3 shadow-sm",
              hasData ? "bg-background/90" : "bg-muted/30 opacity-75",
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <Badge variant={hasData ? "secondary" : "outline"} className="text-[11px] font-normal">
                {PRODUCTION_AREA_LABELS[row.area] ?? row.area}
              </Badge>
              <span className="text-muted-foreground text-[10px] tabular-nums">{eff} ef.</span>
            </div>
            <p className="font-mono text-sm tabular-nums">{formatDurationHms(row.prod_sec)}</p>
            <p className="text-muted-foreground text-[11px]">
              Muerto {formatDurationHms(row.down_sec)} · {row.segment_count} seg.
            </p>
          </div>
        )
      })}
    </div>
  )
}

export function ProductionTimeAreaSummaryTable({
  areaRows,
  loading,
}: {
  areaRows: ReturnType<typeof rollupByArea>
  loading: boolean
}) {
  const totals = useMemo(() => {
    const withData = areaRows.filter((r) => r.segment_count > 0)
    return withData.length > 0 ? sumAggRowsTotals(withData) : null
  }, [areaRows])

  const hasAny = areaRows.some((r) => r.segment_count > 0)

  return (
    <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium">Resumen por área</p>
        <p className="text-muted-foreground text-xs">
          Totales del rango agrupados por área ({PRODUCTION_AREA_ORDER.map((a) => PRODUCTION_AREA_LABELS[a]).join(", ")}
          ). Mismo criterio que el agregado por máquina.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-12">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Layers} className="min-w-[7rem]">
                Área
              </CatalogTableHead>
              <ProductionTimeTableHead
                label="Efectivo"
                tooltip="Tiempo en segmentos de producción en esta área."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Muerto"
                tooltip="Paradas en esta área."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Montaje"
                tooltip="Operación mount en esta área."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Desmontaje"
                tooltip="Operación demount en esta área."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <CatalogTableHead icon={BarChart3} className={cn(PRODUCTION_TIME_NUM_HEAD_CLASS, "text-foreground")}>
                Segmentos
              </CatalogTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={AREA_SUMMARY_COL_COUNT} className="text-muted-foreground">
                  Cargando resumen…
                </TableCell>
              </TableRow>
            ) : !hasAny ? (
              <TableRow>
                <TableCell colSpan={AREA_SUMMARY_COL_COUNT} className="text-muted-foreground">
                  {REPORT_EMPTY_PRODUCTION_TIME_BY_AREA}
                </TableCell>
              </TableRow>
            ) : (
              areaRows.map((row, idx) => (
                <TableRow
                  key={row.area}
                  className={cn(
                    catalogTableBodyRowClass,
                    row.segment_count === 0 ? "text-muted-foreground" : "",
                  )}
                >
                  <TableCell className={cn("tabular-nums", catalogTableBodyCellClass)}>{idx + 1}</TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {PRODUCTION_AREA_LABELS[row.area] ?? row.area}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.prod_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.down_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.mount_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.demount_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {row.segment_count}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals && hasAny ? (
            <TableFooter>
              <TableRow className="border-t-2 border-primary/20 bg-muted/40 font-medium">
                <TableCell colSpan={2} className={catalogTableBodyCellClass}>
                  Total planta (por área)
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.prod)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.down)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.mount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.demount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {totals.segments}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  )
}

export function ProductionTimeMachineTable({
  aggRows,
  loading,
}: {
  aggRows: ProductionTimeAggRow[]
  loading: boolean
}) {
  const totals = useMemo(
    () => (aggRows.length > 0 ? sumAggRowsTotals(aggRows) : null),
    [aggRows],
  )

  const AREA_TABLE_COL_COUNT = 8

  return (
    <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-sm">
        <span className="font-medium text-foreground">Agregado por área y máquina</span> — segmentos cerrados en el
        rango, agrupados por código de máquina dentro de cada área (criterio del PDF planta).
      </p>
      <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-12">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Layers} className="min-w-[7rem]">
                Área
              </CatalogTableHead>
              <CatalogTableHead icon={Hash} className="min-w-[6rem]">
                Máquina
              </CatalogTableHead>
              <ProductionTimeTableHead
                label="Efectivo"
                tooltip="Tiempo en segmentos de producción (todas las OT del rango)."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Muerto"
                tooltip="Paradas / tiempo muerto."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Montaje"
                tooltip="Operación mount."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Desmontaje"
                tooltip="Operación demount."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <CatalogTableHead icon={BarChart3} className={cn(PRODUCTION_TIME_NUM_HEAD_CLASS, "text-foreground")}>
                Segmentos
              </CatalogTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={AREA_TABLE_COL_COUNT} className="text-muted-foreground">
                  Cargando resumen…
                </TableCell>
              </TableRow>
            ) : aggRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={AREA_TABLE_COL_COUNT} className="text-muted-foreground">
                  {REPORT_EMPTY_PRODUCTION_TIME_BY_AREA}
                </TableCell>
              </TableRow>
            ) : (
              aggRows.map((row, idx) => (
                <TableRow key={`${row.area}|${row.machine_code}`} className={catalogTableBodyRowClass}>
                  <TableCell className={cn("tabular-nums text-muted-foreground", catalogTableBodyCellClass)}>
                    {idx + 1}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {PRODUCTION_AREA_LABELS[row.area] ?? row.area}
                  </TableCell>
                  <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                    {row.machine_code.trim() !== "" ? row.machine_code : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.prod_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.down_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.mount_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {formatDurationHms(row.demount_sec)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                    {row.segment_count}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals && aggRows.length > 0 ? (
            <TableFooter>
              <TableRow className="border-t-2 border-primary/20 bg-muted/40 font-medium">
                <TableCell colSpan={3} className={catalogTableBodyCellClass}>
                  Total
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.prod)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.down)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.mount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totals.demount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {totals.segments}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  )
}
