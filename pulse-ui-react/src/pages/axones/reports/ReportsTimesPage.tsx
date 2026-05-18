"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { ReportPeriodFields } from "@/components/axones/reports/ReportPeriodFields"
import type { ReportWorkOrderOption } from "@/components/axones/reports/ReportWorkOrderPicker"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
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
  apiDownloadFile,
  ApiError,
  apiFetch,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import { cn } from "@/lib/utils"

import {
  formatDurationHms,
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

const CANDIDATES_COL_COUNT = 12

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
  from: string
  to: string
  work_orders: WorkOrderTimeCandidate[]
}

function buildTimeReportQuery(
  from: string,
  to: string,
  aggregateAll: boolean,
  woId: string,
): Record<string, string | number> {
  const q: Record<string, string | number> = { from, to }
  if (!aggregateAll && woId.trim() !== "") {
    q.work_order_id = Number(woId.trim())
  }
  return q
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

export default function ReportsTimesPage() {
  const { from, setFrom, to, setTo, loading, setLoading } = useReportRange()
  const [woId, setWoId] = useState("")
  const [aggregateAll, setAggregateAll] = useState(false)
  const [candidates, setCandidates] = useState<WorkOrderTimeCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const previewAbortRef = useRef<AbortController | null>(null)
  const candidatesAbortRef = useRef<AbortController | null>(null)
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const pendingScrollToPreviewRef = useRef(false)

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
      else toast.error("No se pudo cargar el listado de OT.")
      setCandidates([])
    } finally {
      if (candidatesAbortRef.current === ac) {
        setLoadingCandidates(false)
      }
    }
  }, [from, to])

  useEffect(() => {
    void loadCandidates()
    return () => {
      candidatesAbortRef.current?.abort()
    }
  }, [loadCandidates])

  const loadPreview = useCallback(
    async (opts?: { silent?: boolean }) => {
      previewAbortRef.current?.abort()
      const canRun = aggregateAll || woId.trim() !== ""
      if (!canRun) {
        setPreviewHtml("")
        return
      }

      const ac = new AbortController()
      previewAbortRef.current = ac
      const silent = opts?.silent ?? false
      setLoadingPreview(true)
      try {
        const query = buildTimeReportQuery(from, to, aggregateAll, woId)
        const url = buildApiUrl("reports/work-order-time-report/preview", query)
        const res = await fetch(url, { headers: authHeadersDownload(), signal: ac.signal })
        if (!res.ok) {
          if (res.status === 401) {
            throw new ApiError("Sesión expirada o no autorizada.", 401, {})
          }
          const body = (await res.json().catch(() => ({}))) as { message?: string }
          throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
        }
        setPreviewHtml(await res.text())
        if (!silent) toast.success("Vista previa actualizada.")
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo generar la vista previa.")
      } finally {
        if (previewAbortRef.current === ac) {
          setLoadingPreview(false)
        }
      }
    },
    [aggregateAll, from, to, woId],
  )

  useEffect(() => {
    void loadPreview({ silent: true })
    return () => {
      previewAbortRef.current?.abort()
    }
  }, [loadPreview])

  useEffect(() => {
    if (!loadingPreview && previewHtml && pendingScrollToPreviewRef.current && previewIframeRef.current) {
      pendingScrollToPreviewRef.current = false
      requestAnimationFrame(() => {
        previewIframeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }, [loadingPreview, previewHtml])

  function selectRow(row: WorkOrderTimeCandidate) {
    setAggregateAll(false)
    setWoId(String(row.work_order_id))
  }

  function openRowPreview(row: WorkOrderTimeCandidate) {
    setAggregateAll(false)
    setWoId(String(row.work_order_id))
    pendingScrollToPreviewRef.current = true
  }

  function onAggregateChecked(checked: boolean) {
    setAggregateAll(checked)
    if (checked) setWoId("")
  }

  async function downloadPdf() {
    const canRun = aggregateAll || woId.trim() !== ""
    if (!canRun) {
      toast.error("Elija una OT en la tabla o active el agregado de todas las OT.")
      return
    }
    setLoading(true)
    try {
      const query = buildTimeReportQuery(from, to, aggregateAll, woId)
      const tag = aggregateAll ? `${from}-${to}` : `ot-${woId.trim()}`
      await apiDownloadFile("reports/work-order-time-report.pdf", {
        query,
        fallbackName: `reporte-tiempos-${tag}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadCsvFile() {
    const canRun = aggregateAll || woId.trim() !== ""
    if (!canRun) {
      toast.error("Elija una OT en la tabla o active el agregado de todas las OT.")
      return
    }
    setLoading(true)
    try {
      const query = { ...buildTimeReportQuery(from, to, aggregateAll, woId), format: "csv" as const }
      const tag = aggregateAll ? `${from}-${to}` : `ot-${woId.trim()}`
      await apiDownloadFile("reports/work-order-time-report", {
        query,
        fallbackName: `reporte-tiempos-${tag}.csv`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el archivo.")
    } finally {
      setLoading(false)
    }
  }

  const selectedId = woId.trim() === "" ? null : Number(woId.trim())

  const woPickerOptions = useMemo<ReportWorkOrderOption[]>(
    () =>
      candidates.map((r) => ({
        work_order_id: r.work_order_id,
        work_order_code: r.work_order_code,
        client_name: r.client_name,
        product_name: r.product_name,
      })),
    [candidates],
  )

  const kgHeadClass =
    "min-w-[4.25rem] text-right text-xs font-medium tabular-nums text-muted-foreground"

  return (
    <TooltipProvider>
      <ReportPageShell
        title="Reporte de tiempos"
        description="Reporte del temporizador de producción: tiempo efectivo, tiempo muerto, montaje y desmontaje agregados por área (impresión, laminación, corte, montaje y tintas), con detalle de motivos de cada parada."
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        showRange={false}
      >
        <ReportFiltersPanel
          subtitle="Período, orden de trabajo o agregado global"
          loading={loadingCandidates || loadingPreview}
          activeFilterCount={aggregateAll ? 1 : woId.trim() ? 1 : 0}
        >
          <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

          <ReportFilterSection
            title="Orden de trabajo"
            accentClass="text-amber-800 dark:text-amber-200"
            dotClass="bg-amber-500"
            borderClass="border-amber-500/30 from-amber-500/[0.07]"
          >
            <div className="mb-4 flex items-center space-x-2">
              <Checkbox
                id="aggregate-all"
                checked={aggregateAll}
                onCheckedChange={(v) => onAggregateChecked(v === true)}
              />
              <Label htmlFor="aggregate-all" className="cursor-pointer text-sm font-normal leading-none">
                Agregado de todas las OT del rango
              </Label>
            </div>
            <ReportWorkOrderPicker
              value={woId}
              onValueChange={(id) => {
                setAggregateAll(false)
                setWoId(id)
              }}
              options={woPickerOptions}
              mode="static"
              disabled={aggregateAll}
              placeholder="Seleccione en la tabla o busque por código…"
              highlighted={!aggregateAll && !!woId.trim()}
              className="max-w-xl"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              Desactivado mientras el agregado global está activo. Pulse una fila de la tabla o elija aquí por código OT.
            </p>
          </ReportFilterSection>

          <ReportFilterSection
            title="Acciones"
            accentClass="text-emerald-800 dark:text-emerald-200"
            dotClass="bg-emerald-500"
            borderClass="border-emerald-500/30 from-emerald-500/[0.07]"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={loadingPreview}
                onClick={() => void loadPreview({ silent: false })}
              >
                {loadingPreview ? "Generando…" : "Vista previa"}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => void downloadPdf()}>
                Descargar PDF
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => void downloadCsvFile()}>
                Descargar datos del reporte
              </Button>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              La vista previa se actualiza al cambiar fechas o selección. PDF y exportaciones usan los mismos filtros.
            </p>
          </ReportFilterSection>
        </ReportFiltersPanel>

        <div className="space-y-4">
          <div className="bg-card flex flex-col gap-3 rounded-2xl border p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Órdenes con tiempo en el rango</p>
                <p className="text-muted-foreground text-xs">
                  Pulse una fila para seleccionar la OT. Use <strong>Abrir</strong> para cargar la vista previa y
                  desplazarse al detalle. Los tiempos son la suma de todas las áreas en el período.
                </p>
              </div>
              {loadingCandidates ? (
                <span className="text-muted-foreground text-xs">Cargando listado…</span>
              ) : null}
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
                      "Tiempo de producción (segmentos cerrados tipo producción), todas las áreas.",
                      kgHeadClass,
                    )}
                    {headTime(
                      "Muerto",
                      "Tiempo muerto / paradas registradas en el temporizador.",
                      kgHeadClass,
                    )}
                    {headTime("Montaje", "Montajes registrados en el temporizador.", kgHeadClass)}
                    {headTime("Desmontaje", "Desmontajes registrados.", kgHeadClass)}
                    <CatalogTableHead icon={Timer} className={cn(kgHeadClass, "text-foreground")}>
                      Total
                    </CatalogTableHead>
                    <CatalogTableHead icon={Percent} className={cn(kgHeadClass, "text-foreground")}>
                      % ef.
                    </CatalogTableHead>
                    <CatalogTableHead icon={Layers} className="min-w-[7rem]">
                      Áreas
                    </CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2} className="min-w-[5.5rem]">
                      Acciones
                    </CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCandidates ? (
                    <TableRow>
                      <TableCell colSpan={CANDIDATES_COL_COUNT} className="text-muted-foreground">
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={CANDIDATES_COL_COUNT} className="text-muted-foreground">
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
                          onClick={() => selectRow(row)}
                        >
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
                          <TableCell className={catalogTableBodyCellClass}>
                            {row.client_name ?? "—"}
                          </TableCell>
                          <TableCell className={catalogTableBodyCellClass}>
                            {row.product_name ?? "—"}
                          </TableCell>
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
                          <TableCell className={cn("text-right tabular-nums text-sm font-medium", catalogTableBodyCellClass)}>
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
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-primary/25"
                              onClick={(e) => {
                                e.stopPropagation()
                                openRowPreview(row)
                              }}
                            >
                              Abrir
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {previewHtml ? (
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            <iframe
              ref={previewIframeRef}
              title="Vista previa del reporte de tiempos"
              srcDoc={previewHtml}
              className="h-[760px] w-full rounded-md border"
            />
          </div>
        ) : loadingPreview ? (
          <p className="text-muted-foreground text-xs">Generando vista previa…</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Elija una OT en el listado o active <strong>Agregado de todas las OT del rango</strong>. La vista previa se
            actualiza sola al cambiar la selección o las fechas; use <strong>Vista previa</strong> para refrescar
            manualmente. PDF y exportaciones descargables usan los mismos filtros.
          </p>
        )}
      </ReportPageShell>
    </TooltipProvider>
  )
}
