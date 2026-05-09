"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  BarChart3,
  Barcode,
  Hash,
  Layers,
  ListOrdered,
  Package,
  Percent,
  Settings2,
  Timer,
  Users,
} from "lucide-react"
import { toast } from "sonner"

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ApiError,
  apiDownloadFile,
  apiFetch,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import { cn } from "@/lib/utils"

import {
  formatDurationHms,
  REPORT_EMPTY_PRODUCTION_TIME_BY_AREA,
  REPORT_EMPTY_WORK_ORDER_TIMES,
  ReportPageShell,
  useReportRange,
} from "./report-shared"

const AREA_LABELS: Record<string, string> = {
  printing: "Impresión",
  laminacion: "Laminación",
  corte: "Corte",
  montaje: "Montaje",
  tintas: "Tintas",
}

const AREA_ORDER = ["printing", "laminacion", "corte", "montaje", "tintas"]

const OT_COL_COUNT = 12
const AREA_TABLE_COL_COUNT = 8

type ProductionTimeRawRow = {
  area: string
  segment_type: string
  machine_code: string
  total_seconds: number
  segment_count: number
}

type ProductionTimeAggRow = {
  area: string
  machine_code: string
  mount_sec: number
  demount_sec: number
  prod_sec: number
  down_sec: number
  segment_count: number
}

type WorkOrderTimeCandidate = {
  work_order_id: number
  work_order_code: string
  client_name: string | null
  product_name: string | null
  areas: string[]
  production_seconds: number
  downtime_seconds: number
  mount_seconds: number
  demount_seconds: number
  total_seconds: number
  effective_percent: string
}

type CandidatesResponse = {
  work_orders: WorkOrderTimeCandidate[]
}

function pivotProductionRows(rows: ProductionTimeRawRow[]): ProductionTimeAggRow[] {
  const agg = new Map<string, ProductionTimeAggRow>()
  for (const r of rows) {
    const area = String(r.area ?? "")
    const machine = String(r.machine_code ?? "")
    const type = String(r.segment_type ?? "")
    const sec = Number(r.total_seconds ?? 0)
    const cnt = Number(r.segment_count ?? 0)
    const k = `${area}|${machine}`
    let row = agg.get(k)
    if (!row) {
      row = {
        area,
        machine_code: machine,
        mount_sec: 0,
        demount_sec: 0,
        prod_sec: 0,
        down_sec: 0,
        segment_count: 0,
      }
      agg.set(k, row)
    }
    row.segment_count += cnt
    if (type === "mount") row.mount_sec += sec
    if (type === "demount") row.demount_sec += sec
    if (type === "production") row.prod_sec += sec
    if (type === "downtime") row.down_sec += sec
  }

  return Array.from(agg.values()).sort((a, b) => {
    const ia = AREA_ORDER.indexOf(a.area)
    const ib = AREA_ORDER.indexOf(b.area)
    const ao = (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    if (ao !== 0) return ao
    return a.machine_code.localeCompare(b.machine_code, "es")
  })
}

function headTime(label: string, tooltip: string, className: string) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground decoration-muted-foreground/80">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[16rem] text-xs leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

export default function ReportsProductionPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [aggRows, setAggRows] = useState<ProductionTimeAggRow[]>([])
  const [candidates, setCandidates] = useState<WorkOrderTimeCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const previewAbortRef = useRef<AbortController | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)
  const candidatesAbortRef = useRef<AbortController | null>(null)

  const loadSummary = useCallback(async () => {
    summaryAbortRef.current?.abort()
    const ac = new AbortController()
    summaryAbortRef.current = ac
    setLoadingSummary(true)
    try {
      const data = await apiFetch<{ rows?: ProductionTimeRawRow[] }>("reports/production-time-by-area", {
        query: { from, to },
        signal: ac.signal,
      })
      setAggRows(pivotProductionRows(data.rows ?? []))
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen de tiempos.")
      setAggRows([])
    } finally {
      if (summaryAbortRef.current === ac) {
        setLoadingSummary(false)
      }
    }
  }, [from, to])

  const loadCandidates = useCallback(async () => {
    candidatesAbortRef.current?.abort()
    const ac = new AbortController()
    candidatesAbortRef.current = ac
    setLoadingCandidates(true)
    try {
      const data = await apiFetch<CandidatesResponse>("reports/work-order-time-report/candidates", {
        query: { from, to },
        signal: ac.signal,
      })
      setCandidates(data.work_orders ?? [])
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado de órdenes.")
      setCandidates([])
    } finally {
      if (candidatesAbortRef.current === ac) {
        setLoadingCandidates(false)
      }
    }
  }, [from, to])

  useEffect(() => {
    void loadSummary()
    void loadCandidates()
    return () => {
      summaryAbortRef.current?.abort()
      candidatesAbortRef.current?.abort()
    }
  }, [loadSummary, loadCandidates])

  const loadPreview = useCallback(async () => {
    previewAbortRef.current?.abort()
    const ac = new AbortController()
    previewAbortRef.current = ac
    setLoadingPreview(true)
    try {
      const url = buildApiUrl("reports/production-time-by-area/preview", { from, to })
      const res = await fetch(url, { headers: authHeadersDownload(), signal: ac.signal })
      if (!res.ok) {
        if (res.status === 401) throw new ApiError("Sesión expirada o no autorizada.", 401, {})
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
      }
      setPreviewHtml(await res.text())
      toast.success("Vista previa lista.")
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar la vista previa.")
    } finally {
      if (previewAbortRef.current === ac) {
        setLoadingPreview(false)
      }
    }
  }, [from, to])

  async function downloadPdf() {
    try {
      await apiDownloadFile("reports/production-time-by-area.pdf", {
        query: { from, to },
        fallbackName: `production-time-by-area-${from}-${to}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    }
  }

  const numHead =
    "min-w-[4.25rem] text-right text-xs font-medium tabular-nums text-muted-foreground"

  const totalsFooterArea = useMemo(() => {
    if (!aggRows.length) return null
    let prod = 0
    let down = 0
    let mount = 0
    let demount = 0
    let segments = 0
    for (const r of aggRows) {
      prod += r.prod_sec
      down += r.down_sec
      mount += r.mount_sec
      demount += r.demount_sec
      segments += r.segment_count
    }
    return { prod, down, mount, demount, segments }
  }, [aggRows])

  const totalsFooterOt = useMemo(() => {
    if (!candidates.length) return null
    let prod = 0
    let down = 0
    let mount = 0
    let demount = 0
    let total = 0
    for (const r of candidates) {
      prod += r.production_seconds
      down += r.downtime_seconds
      mount += r.mount_seconds
      demount += r.demount_seconds
      total += r.total_seconds
    }
    const eff = total > 0 ? ((prod / total) * 100).toFixed(2) : "0.00"
    return { prod, down, mount, demount, total, eff }
  }, [candidates])

  return (
    <TooltipProvider>
      <ReportPageShell
        title="Producción y tiempos"
        description="Tiempos por orden de trabajo y agregado por área/máquina (montaje, producción, paradas). Consumo de tintas por cliente disponible en CSV."
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
      >
        <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-sm font-medium">Órdenes de trabajo con tiempo registrado</p>
            <p className="text-muted-foreground text-xs">
              Misma lógica que el reporte de tiempos por OT: suma de segmentos cerrados en impresión, laminación, corte,
              montaje y tintas. Use <strong>Ver OT</strong> para abrir la planilla como en el listado de órdenes de
              trabajo.
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
                  {headTime(
                    "Efectivo",
                    "Tiempo de producción (segmentos cerrados), todas las áreas.",
                    numHead,
                  )}
                  {headTime("Muerto", "Paradas / tiempo muerto en temporizadores.", numHead)}
                  {headTime("Montaje", "Montajes registrados.", numHead)}
                  {headTime("Desmontaje", "Desmontajes registrados.", numHead)}
                  <CatalogTableHead icon={Timer} className={cn(numHead, "text-foreground")}>
                    Total
                  </CatalogTableHead>
                  <CatalogTableHead icon={Percent} className={cn(numHead, "text-foreground")}>
                    % ef.
                  </CatalogTableHead>
                  <CatalogTableHead icon={Layers} className="min-w-[7rem]">
                    Áreas
                  </CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2} className="min-w-[6rem]">
                    Acciones
                  </CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCandidates ? (
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
                  candidates.map((row, idx) => (
                    <TableRow key={row.work_order_id} className={catalogTableBodyRowClass}>
                      <TableCell
                        className={cn(
                          "tabular-nums text-muted-foreground",
                          catalogTableBodyCellClass,
                        )}
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
                        className={cn(
                          "text-right tabular-nums text-sm font-medium",
                          catalogTableBodyCellClass,
                        )}
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
                              {AREA_LABELS[a] ?? a}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                        <Button asChild variant="outline" size="sm" className="border-primary/25">
                          <Link to={`/ordenes-trabajo/${row.work_order_id}`}>Ver OT</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {totalsFooterOt && candidates.length > 0 ? (
                <TableFooter>
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={4} className={catalogTableBodyCellClass}>
                      Totales (órdenes listadas)
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterOt.prod)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterOt.down)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterOt.mount)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterOt.demount)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterOt.total)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {totalsFooterOt.eff}%
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass} />
                    <TableCell className={catalogTableBodyCellClass} />
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </div>

        <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">Agregado por área y máquina</span> — mismo criterio que el PDF
            general: segmentos cerrados en el rango, agrupados por código de máquina dentro de cada área.
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
                  {headTime(
                    "Efectivo",
                    "Tiempo en segmentos de producción (todas las OT del rango).",
                    numHead,
                  )}
                  {headTime("Muerto", "Paradas / tiempo muerto registrado en temporizadores.", numHead)}
                  {headTime("Montaje", "Tiempo en montaje.", numHead)}
                  {headTime("Desmontaje", "Tiempo en desmontaje.", numHead)}
                  <CatalogTableHead icon={BarChart3} className={cn(numHead, "text-foreground")}>
                    Segmentos
                  </CatalogTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingSummary ? (
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
                      <TableCell
                        className={cn(
                          "tabular-nums text-muted-foreground",
                          catalogTableBodyCellClass,
                        )}
                      >
                        {idx + 1}
                      </TableCell>
                      <TableCell className={catalogTableBodyCellClass}>
                        {AREA_LABELS[row.area] ?? row.area}
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
              {totalsFooterArea && aggRows.length > 0 ? (
                <TableFooter>
                  <TableRow className="border-t-2 border-primary/20 bg-muted/40 font-medium">
                    <TableCell colSpan={3} className={catalogTableBodyCellClass}>
                      Total
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterArea.prod)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterArea.down)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterArea.mount)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {formatDurationHms(totalsFooterArea.demount)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums text-sm", catalogTableBodyCellClass)}>
                      {totalsFooterArea.segments}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={loadingPreview} onClick={() => void loadPreview()}>
            {loadingPreview ? "Generando…" : "Vista previa (PDF en pantalla)"}
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => void downloadPdf()}>
            Descargar PDF
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              void downloadCsv(
                "reports/production-time-by-area",
                "production-time-by-area.csv",
                { from, to },
              )
            }
          >
            Tiempos por área
          </Button>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              void downloadCsv(
                "reports/tinta-consumption-by-client",
                "tinta-consumption-by-client.csv",
                { from, to },
              )
            }
          >
            Consumo tintas por cliente
          </Button>
        </div>

        {previewHtml ? (
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            <iframe
              title="Vista previa: tiempos por área"
              srcDoc={previewHtml}
              className="h-[760px] w-full rounded-md border"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Pulse <strong>Vista previa (PDF en pantalla)</strong> para ver el mismo contenido que el PDF sin descargarlo.
            El rango de fechas es el de la tarjeta superior.
          </p>
        )}
      </ReportPageShell>
    </TooltipProvider>
  )
}
