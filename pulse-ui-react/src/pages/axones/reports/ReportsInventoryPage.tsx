"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, PackageX, ArrowRightLeft, Boxes } from "lucide-react"
import { toast } from "sonner"

import {
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { appAbsoluteUrl } from "@/lib/app-base-path"
import { ApiError, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"

import { InventoryReportFilters } from "./inventory-report-filters"
import { getReportIdentity } from "./ReportIdentityBanner"
import { ReportPageShell, useReportRange } from "./report-shared"

type SupplierRecord = {
  id: number
  name: string
}

type RejectedBobinaRow = {
  numero_bobina: string | null
  proveedor: string | null
  operador: string | null
  material: string | null
  peso_kg: string | null
  motivo: string | null
  observacion: string | null
  fecha_bobina: string | null
  fecha_registro: string | null
  work_order_code: string | null
}

type RejectedBobinasPayload = {
  rows: RejectedBobinaRow[]
}

type InventoryDailyRow = {
  day: string
  movement_type: string
  total_quantity: string
  movement_count: number
}

type InventoryDailyPayload = {
  rows: InventoryDailyRow[]
}

type ConsumptionRow = {
  client_name: string | null
  product_name: string | null
  total_quantity: string
  movement_count: number
}

type ConsumptionPayload = {
  rows: ConsumptionRow[]
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

export default function ReportsInventoryPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const [activeTab, setActiveTab] = useState("rejected")
  const [rejectedRows, setRejectedRows] = useState<RejectedBobinaRow[]>([])
  const [inventoryRows, setInventoryRows] = useState<InventoryDailyRow[]>([])
  const [consumptionRows, setConsumptionRows] = useState<ConsumptionRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [inventoryLoading, setInventoryLoading] = useState(false)
  const [consumptionLoading, setConsumptionLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(20)

  const rejectedBobinasQuery = useMemo(() => {
    return { from, to }
  }, [from, to])

  const openRejectedPdfPreviewWindow = useCallback(async () => {
    const params = new URLSearchParams({
      from,
      to,
    })
    const url = appAbsoluteUrl(
      `/reportes/inventario/bobinas-rechazadas/vista-previa?${params.toString()}`,
    )
    const popup = window.open(url, "_blank")
    if (!popup) toast.error("El navegador bloqueó la ventana emergente de vista previa.")
  }, [from, to])

  const loadRejectedList = useCallback(async () => {
    setListLoading(true)
    try {
      const data = await apiFetch<RejectedBobinasPayload>("reports/rejected-bobinas", {
        query: rejectedBobinasQuery,
      })
      setRejectedRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado de bobinas rechazadas.")
      setRejectedRows([])
    } finally {
      setListLoading(false)
    }
  }, [rejectedBobinasQuery])

  const loadInventoryMovementSummary = useCallback(async () => {
    setInventoryLoading(true)
    try {
      const data = await apiFetch<InventoryDailyPayload>("reports/inventory-daily", {
        query: { from, to },
      })
      setInventoryRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen de movimientos de inventario.")
      setInventoryRows([])
    } finally {
      setInventoryLoading(false)
    }
  }, [from, to])

  const loadConsumptionSummary = useCallback(async () => {
    setConsumptionLoading(true)
    try {
      const data = await apiFetch<ConsumptionPayload>("reports/consumption-by-client-product", {
        query: { from, to },
      })
      setConsumptionRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el consumo por cliente/producto.")
      setConsumptionRows([])
    } finally {
      setConsumptionLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void loadRejectedList()
  }, [loadRejectedList])

  useEffect(() => {
    void loadInventoryMovementSummary()
    void loadConsumptionSummary()
  }, [loadInventoryMovementSummary, loadConsumptionSummary])

  useEffect(() => {
    setPage(1)
  }, [from, to])

  const totalKg = useMemo(
    () =>
      rejectedRows.reduce((sum, row) => {
        const n = Number.parseFloat(String(row.peso_kg ?? "0"))
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [rejectedRows],
  )

  const totalRows = rejectedRows.length
  const lastPage = Math.max(1, Math.ceil(totalRows / perPage))
  const currentPage = Math.min(page, lastPage)
  const start = (currentPage - 1) * perPage
  const end = start + perPage
  const pagedRows = rejectedRows.slice(start, end)
  const movementByDay = useMemo(() => {
    const map = new Map<
      string,
      { in: number; out: number; adjustment_add: number; adjustment_sub: number; count: number }
    >()
    for (const row of inventoryRows) {
      const key = row.day
      if (!map.has(key)) {
        map.set(key, { in: 0, out: 0, adjustment_add: 0, adjustment_sub: 0, count: 0 })
      }
      const acc = map.get(key)!
      const qty = Number.parseFloat(row.total_quantity || "0")
      const cnt = Number(row.movement_count || 0)
      if (row.movement_type === "in") acc.in += qty
      if (row.movement_type === "out") acc.out += qty
      if (row.movement_type === "adjustment_add") acc.adjustment_add += qty
      if (row.movement_type === "adjustment_sub") acc.adjustment_sub += qty
      acc.count += cnt
    }
    return Array.from(map.entries())
      .map(([day, totals]) => ({ day, ...totals }))
      .sort((a, b) => b.day.localeCompare(a.day))
  }, [inventoryRows])
  const movementTotals = useMemo(
    () =>
      movementByDay.reduce(
        (acc, row) => ({
          in: acc.in + row.in,
          out: acc.out + row.out,
          adj: acc.adj + row.adjustment_add + row.adjustment_sub,
          count: acc.count + row.count,
        }),
        { in: 0, out: 0, adj: 0, count: 0 },
      ),
    [movementByDay],
  )
  const maxMovementAbs = useMemo(
    () => Math.max(1, ...movementByDay.map((r) => Math.max(r.in, r.out, r.adjustment_add, r.adjustment_sub))),
    [movementByDay],
  )
  const consumptionTotalKg = useMemo(
    () =>
      consumptionRows.reduce((sum, row) => {
        const n = Number.parseFloat(row.total_quantity || "0")
        return sum + (Number.isFinite(n) ? n : 0)
      }, 0),
    [consumptionRows],
  )
  const maxConsumptionKg = useMemo(
    () => Math.max(1, ...consumptionRows.map((r) => Number.parseFloat(r.total_quantity || "0"))),
    [consumptionRows],
  )

  return (
    <ReportPageShell
      identityKey="inventario"
      title="Reporte de inventario"
      description="Movimientos de almacén, consumo por cliente/producto y bobinas rechazadas."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      showRange={false}
    >
      <InventoryReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        loading={loading}
        theme={getReportIdentity("inventario").theme}
        onDownloadDaily={() => void downloadCsv("reports/inventory-daily", "inventory-daily.csv", { from, to })}
        onDownloadConsumption={() =>
          void downloadCsv("reports/consumption-by-client-product", "consumption-by-client-product.csv", { from, to })
        }
        onDownloadRejectedCsv={() =>
          void downloadCsv("reports/rejected-bobinas", "bobinas-rechazadas.csv", rejectedBobinasQuery)
        }
        onPreviewRejectedPdf={() => {
          toast.info("Generando vista previa del PDF...")
          void openRejectedPdfPreviewWindow()
        }}
      />

        <ReportFilterSection
          title="Vistas en pantalla"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
          borderClass="border-sky-500/30 from-sky-500/[0.07]"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
            <TabsList className="grid w-full grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-3">
              <TabsTrigger value="rejected" className="gap-2">
                <PackageX className="h-4 w-4" />
                Bobinas rechazadas
              </TabsTrigger>
              <TabsTrigger value="inventory" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Movimiento de inventario
              </TabsTrigger>
              <TabsTrigger value="consumption" className="gap-2">
                <Boxes className="h-4 w-4" />
                Consumo cliente/producto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rejected" className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Tabla en pantalla con el mismo período y proveedor del filtro, organizada por columnas y
                celdas.
              </p>
              {!listLoading && rejectedRows.length > 0 ? (
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-rose-500/10 px-3 py-1 font-medium text-rose-900 dark:text-rose-100">
                    {rejectedRows.length} registro{rejectedRows.length === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground">
                    Total{" "}
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {totalKg.toFixed(3)}
                    </span>{" "}
                    kg
                  </span>
                </div>
              ) : null}
              {listLoading ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  Cargando bobinas rechazadas…
                </div>
              ) : rejectedRows.length === 0 ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  No hay bobinas rechazadas para el período o proveedor seleccionado.
                </div>
              ) : (
                <>
                  <div className="bg-card overflow-x-auto rounded-xl border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className={catalogTableHeaderRowClass}>
                          <TableHead>Número</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Operador</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Peso (Kg)</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Observación</TableHead>
                          <TableHead>Fecha bobina</TableHead>
                          <TableHead>Fecha registro</TableHead>
                          <TableHead>OT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map((row, idx) => (
                          <TableRow
                            key={`${row.numero_bobina ?? "n/a"}-${row.work_order_code ?? "n/a"}-${idx}`}
                            className={catalogTableBodyRowClass}
                          >
                            <TableCell className={cn("font-mono", catalogTableBodyCellClass)}>
                              {row.numero_bobina ?? "—"}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.proveedor ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.operador ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.material ?? "—"}</TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.peso_kg ?? "0.000"}
                            </TableCell>
                            <TableCell className={cn("min-w-[200px]", catalogTableBodyCellClass)}>
                              {row.motivo ?? "—"}
                            </TableCell>
                            <TableCell className={cn("min-w-[200px]", catalogTableBodyCellClass)}>
                              {row.observacion ?? "—"}
                            </TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.fecha_bobina ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.fecha_registro ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.work_order_code ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted-foreground text-sm">
                      Mostrando{" "}
                      <span className="font-mono text-foreground">{start + 1}</span> -{" "}
                      <span className="font-mono text-foreground">{Math.min(end, totalRows)}</span> de{" "}
                      <span className="font-mono text-foreground">{totalRows}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={String(perPage)}
                        onValueChange={(v) => {
                          const n = Number(v)
                          if (!Number.isFinite(n)) return
                          setPerPage(n)
                          setPage(1)
                        }}
                      >
                        <SelectTrigger className="h-9 w-[118px]" aria-label="Filas por página">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PER_PAGE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n} filas
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </Button>
                      <span className="text-muted-foreground px-1 text-sm">
                        Página <span className="font-mono text-foreground">{currentPage}</span> /{" "}
                        <span className="font-mono text-foreground">{lastPage}</span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= lastPage}
                        onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="inventory" className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Resumen visual de movimientos diarios del inventario de materiales en el período.
              </p>
              {inventoryLoading ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  Cargando movimiento de inventario…
                </div>
              ) : movementByDay.length === 0 ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  No hay movimientos de inventario para el período seleccionado.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border bg-card p-3">
                      <p className="text-muted-foreground text-xs">Entradas (kg)</p>
                      <p className="font-mono text-lg font-semibold">{movementTotals.in.toFixed(3)}</p>
                    </div>
                    <div className="rounded-xl border bg-card p-3">
                      <p className="text-muted-foreground text-xs">Salidas (kg)</p>
                      <p className="font-mono text-lg font-semibold">{movementTotals.out.toFixed(3)}</p>
                    </div>
                    <div className="rounded-xl border bg-card p-3">
                      <p className="text-muted-foreground text-xs">Ajustes (kg)</p>
                      <p className="font-mono text-lg font-semibold">{movementTotals.adj.toFixed(3)}</p>
                    </div>
                    <div className="rounded-xl border bg-card p-3">
                      <p className="text-muted-foreground text-xs">Movimientos</p>
                      <p className="font-mono text-lg font-semibold">{movementTotals.count}</p>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-xl border bg-card p-3">
                    {movementByDay.slice(0, 8).map((row) => (
                      <div key={row.day} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{row.day}</span>
                          <span className="text-muted-foreground">{row.count} mov.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="text-muted-foreground flex items-center gap-1 text-[11px]"><ArrowUp className="h-3 w-3" /> Entradas</div>
                            <div className="h-2 rounded bg-muted">
                              <div className="h-2 rounded bg-emerald-500" style={{ width: `${Math.max(4, (row.in / maxMovementAbs) * 100)}%` }} />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-muted-foreground flex items-center gap-1 text-[11px]"><ArrowDown className="h-3 w-3" /> Salidas</div>
                            <div className="h-2 rounded bg-muted">
                              <div className="h-2 rounded bg-rose-500" style={{ width: `${Math.max(4, (row.out / maxMovementAbs) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-card overflow-x-auto rounded-xl border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className={catalogTableHeaderRowClass}>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Salidas</TableHead>
                          <TableHead className="text-right">Ajuste +</TableHead>
                          <TableHead className="text-right">Ajuste -</TableHead>
                          <TableHead className="text-right">Movimientos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movementByDay.map((row) => (
                          <TableRow key={row.day} className={catalogTableBodyRowClass}>
                            <TableCell className={catalogTableBodyCellClass}>{row.day}</TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.in.toFixed(3)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.out.toFixed(3)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.adjustment_add.toFixed(3)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.adjustment_sub.toFixed(3)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="consumption" className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Consumo de materiales por combinación cliente/producto en el período seleccionado.
              </p>
              {!consumptionLoading && consumptionRows.length > 0 ? (
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 font-medium text-sky-900 dark:text-sky-100">
                    {consumptionRows.length} cliente/producto
                  </span>
                  <span className="text-muted-foreground">
                    Total{" "}
                    <span className="font-mono font-semibold tabular-nums text-foreground">
                      {consumptionTotalKg.toFixed(3)}
                    </span>{" "}
                    kg
                  </span>
                </div>
              ) : null}
              {consumptionLoading ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  Cargando consumo por cliente/producto…
                </div>
              ) : consumptionRows.length === 0 ? (
                <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                  No hay consumo por cliente/producto para el período seleccionado.
                </div>
              ) : (
                <>
                  <div className="space-y-2 rounded-xl border bg-card p-3">
                    {consumptionRows.slice(0, 8).map((row, idx) => {
                      const qty = Number.parseFloat(row.total_quantity || "0")
                      return (
                        <div key={`${row.client_name ?? "n/a"}-${row.product_name ?? "n/a"}-${idx}`} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate font-medium">
                              {(row.client_name ?? "—") + " · " + (row.product_name ?? "—")}
                            </span>
                            <span className="font-mono">{qty.toFixed(3)} kg</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div className="h-2 rounded bg-sky-500" style={{ width: `${Math.max(6, (qty / maxConsumptionKg) * 100)}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="bg-card overflow-x-auto rounded-xl border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className={catalogTableHeaderRowClass}>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Consumo total (Kg)</TableHead>
                          <TableHead className="text-right">Movimientos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consumptionRows.map((row, idx) => (
                          <TableRow key={`${row.client_name ?? "n/a"}-${row.product_name ?? "n/a"}-${idx}`} className={catalogTableBodyRowClass}>
                            <TableCell className={catalogTableBodyCellClass}>{row.client_name ?? "—"}</TableCell>
                            <TableCell className={catalogTableBodyCellClass}>{row.product_name ?? "—"}</TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.total_quantity ?? "0.000"}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono tabular-nums", catalogTableBodyCellClass)}>
                              {row.movement_count ?? 0}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </ReportFilterSection>
    </ReportPageShell>
  )
}
