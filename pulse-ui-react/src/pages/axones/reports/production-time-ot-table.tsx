"use client"

import { Link } from "react-router-dom"
import {
  Barcode,
  Layers,
  ListOrdered,
  Package,
  Percent,
  Settings2,
  Timer,
  Users,
} from "lucide-react"

import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  formatDurationHms,
  PRODUCTION_AREA_LABELS,
  REPORT_EMPTY_WORK_ORDER_TIMES,
  sumCandidateTotals,
  type WorkOrderTimeCandidate,
} from "./report-shared"
import {
  PRODUCTION_TIME_NUM_HEAD_CLASS,
  ProductionTimeTableHead,
} from "./production-time-table-head"

const OT_COL_COUNT = 12

type ProductionTimeOtTableProps = {
  candidates: WorkOrderTimeCandidate[]
  loading: boolean
  selectedWoId: string
  aggregateAll: boolean
  onSelectRow: (row: WorkOrderTimeCandidate) => void
  onOpenRow: (row: WorkOrderTimeCandidate) => void
}

export function ProductionTimeOtTable({
  candidates,
  loading,
  selectedWoId,
  aggregateAll,
  onSelectRow,
  onOpenRow,
}: ProductionTimeOtTableProps) {
  const selectedId = selectedWoId.trim() === "" ? null : Number(selectedWoId.trim())
  const totalsFooter = candidates.length > 0 ? sumCandidateTotals(candidates) : null

  return (
    <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium">Órdenes con tiempo en el rango</p>
        <p className="text-muted-foreground text-xs">
          Pulse una fila para seleccionar la OT. Use <strong>Abrir</strong> para la vista previa con detalle de paradas, o{" "}
          <strong>Ver OT</strong> para abrir la planilla. Los tiempos son la suma de impresión, laminación, corte, montaje
          y tintas en el período.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-12">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Barcode} className="min-w-[7rem]">
                OT
              </CatalogTableHead>
              <CatalogTableHead icon={Users} className="min-w-[8rem]">
                Cliente
              </CatalogTableHead>
              <CatalogTableHead icon={Package} className="min-w-[8rem]">
                Producto
              </CatalogTableHead>
              <ProductionTimeTableHead
                label="Efectivo"
                tooltip="Cronómetro en marcha (segmentos tipo producción). En área Montaje incluye el tiempo efectivo de turnos cerrados al guardar la OT."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Muerto"
                tooltip="Paradas con motivo (segmentos tipo tiempo muerto)."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Montaje"
                tooltip="Operación de montar cliché/cilindro (segmentos tipo mount), no el área Montaje. En Montaje el cronómetro suele ir a Efectivo."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <ProductionTimeTableHead
                label="Desmontaje"
                tooltip="Operación de desmontaje (segmentos tipo demount)."
                className={PRODUCTION_TIME_NUM_HEAD_CLASS}
              />
              <CatalogTableHead icon={Timer} className={cn(PRODUCTION_TIME_NUM_HEAD_CLASS, "text-foreground")}>
                Total
              </CatalogTableHead>
              <CatalogTableHead icon={Percent} className={cn(PRODUCTION_TIME_NUM_HEAD_CLASS, "text-foreground")}>
                % ef.
              </CatalogTableHead>
              <CatalogTableHead icon={Layers} className="min-w-[7rem]">
                Áreas
              </CatalogTableHead>
              <CatalogTableHeadRight icon={Settings2} className="min-w-[8rem]">
                Acciones
              </CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={OT_COL_COUNT} className="text-muted-foreground">
                  Cargando órdenes…
                </TableCell>
              </TableRow>
            ) : candidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={OT_COL_COUNT} className="text-muted-foreground">
                  {REPORT_EMPTY_WORK_ORDER_TIMES}
                </TableCell>
              </TableRow>
            ) : (
              candidates.map((row, idx) => {
                const isSelected = !aggregateAll && selectedId === row.work_order_id
                return (
                  <TableRow
                    key={row.work_order_id}
                    className={cn(
                      catalogTableBodyRowClass,
                      "cursor-pointer",
                      isSelected ? "bg-primary/10 hover:bg-primary/15" : "",
                    )}
                    onClick={() => onSelectRow(row)}
                  >
                    <TableCell
                      className={cn("tabular-nums text-muted-foreground", catalogTableBodyCellClass)}
                    >
                      {idx + 1}
                    </TableCell>
                    <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                      {row.work_order_code}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>{row.client_name ?? "—"}</TableCell>
                    <TableCell className={catalogTableBodyCellClass}>{row.product_name ?? "—"}</TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(row.production_seconds)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(row.downtime_seconds)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(row.mount_seconds)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(row.demount_seconds)}
                    </TableCell>
                    <TableCell
                      className={cn("text-right tabular-nums text-sm font-medium", catalogTableBodyCellClass)}
                    >
                      {formatDurationHms(row.total_seconds)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {row.effective_percent}%
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <div className="flex flex-wrap gap-1">
                        {row.areas.map((a) => (
                          <Badge key={a} variant="secondary" className="text-[11px] font-normal">
                            {PRODUCTION_AREA_LABELS[a] ?? a}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-primary/25"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenRow(row)
                          }}
                        >
                          Abrir
                        </Button>
                        <Button asChild variant="outline" size="sm" className="border-primary/25">
                          <Link to={`/ordenes-trabajo/${row.work_order_id}`} onClick={(e) => e.stopPropagation()}>
                            Ver OT
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {totalsFooter ? (
            <TableFooter>
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={4} className={catalogTableBodyCellClass}>
                  Totales (órdenes listadas)
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totalsFooter.prod)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totalsFooter.down)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totalsFooter.mount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totalsFooter.demount)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {formatDurationHms(totalsFooter.total)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                  {totalsFooter.eff}%
                </TableCell>
                <TableCell className={catalogTableBodyCellClass} />
                <TableCell className={catalogTableBodyCellClass} />
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  )
}
