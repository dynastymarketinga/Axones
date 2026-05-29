"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ApiError,
  apiDownloadFile,
  apiFetch,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import { TooltipProvider } from "@/components/ui/tooltip"

import { ProductionTimeActions } from "./production-time-actions"
import {
  ProductionTimeAreaKpiCards,
  ProductionTimeAreaSummaryTable,
  ProductionTimeMachineTable,
  ProductionTimePlantKpi,
} from "./production-time-area-summary"
import {
  exportPlantTimesExcel,
  exportWorkOrderTimeReportExcel,
  type WorkOrderTimeReportPayload,
} from "./production-time-excel"
import {
  ProductionTimeSegmentNotice,
  ProductionTimeSingleAreaBanner,
} from "./production-time-insights"
import { ProductionTimeOtTable } from "./production-time-ot-table"
import { ProductionTimeReportFilters } from "./production-time-report-filters"
import {
  buildWorkOrderTimeReportQuery,
  pivotProductionRows,
  ReportPageShell,
  rollupByArea,
  useReportRange,
  type ProductionTimeAggRow,
  type ProductionTimeRawRow,
  type WorkOrderTimeCandidate,
} from "./report-shared"

type CandidatesResponse = {
  work_orders: WorkOrderTimeCandidate[]
}

export type ProductionTimeTab = "resumen" | "areas" | "ordenes"

const TAB_VALUES: ProductionTimeTab[] = ["resumen", "areas", "ordenes"]

function parseTab(value: string | null): ProductionTimeTab {
  if (value && TAB_VALUES.includes(value as ProductionTimeTab)) {
    return value as ProductionTimeTab
  }
  return "resumen"
}

export default function ReportsProductionPage() {
  const { from, setFrom, to, setTo, loading, setLoading, downloadCsv } = useReportRange()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<ProductionTimeTab>(() =>
    parseTab(searchParams.get("tab")),
  )
  const [woId, setWoId] = useState(() => searchParams.get("ot") ?? "")
  const [aggregateAll, setAggregateAll] = useState(
    () => searchParams.get("aggregate") === "all",
  )

  const [plantPreviewHtml, setPlantPreviewHtml] = useState("")
  const [otPreviewHtml, setOtPreviewHtml] = useState("")
  const [loadingPlantPreview, setLoadingPlantPreview] = useState(false)
  const [loadingOtPreview, setLoadingOtPreview] = useState(false)

  const [rawAreaRows, setRawAreaRows] = useState<ProductionTimeRawRow[]>([])
  const [aggRows, setAggRows] = useState<ProductionTimeAggRow[]>([])
  const [candidates, setCandidates] = useState<WorkOrderTimeCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const plantPreviewAbortRef = useRef<AbortController | null>(null)
  const otPreviewAbortRef = useRef<AbortController | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)
  const candidatesAbortRef = useRef<AbortController | null>(null)
  const otPreviewIframeRef = useRef<HTMLIFrameElement | null>(null)
  const pendingScrollToOtPreviewRef = useRef(false)

  const canRunOtReport = aggregateAll || woId.trim() !== ""

  useEffect(() => {
    const ot = searchParams.get("ot")
    const tab = searchParams.get("tab")
    const agg = searchParams.get("aggregate") === "all"

    if (ot) {
      setWoId(ot)
      setAggregateAll(false)
      setActiveTab("ordenes")
      return
    }

    setAggregateAll(agg)
    if (agg) setWoId("")

    if (tab) {
      setActiveTab(parseTab(tab))
    } else if (agg) {
      setActiveTab("ordenes")
    }
  }, [searchParams])

  function handleAggregateAllChange(checked: boolean) {
    setAggregateAll(checked)
    if (checked) setWoId("")

    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (checked) {
          p.set("aggregate", "all")
          p.delete("ot")
          p.set("tab", "ordenes")
        } else {
          p.delete("aggregate")
        }
        return p
      },
      { replace: true },
    )

    if (checked) {
      setActiveTab("ordenes")
    }
  }

  function handleWoIdChange(id: string) {
    setAggregateAll(false)
    setWoId(id)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.delete("aggregate")
        if (id.trim()) {
          p.set("ot", id.trim())
          p.set("tab", "ordenes")
        } else {
          p.delete("ot")
        }
        return p
      },
      { replace: true },
    )
    if (id.trim()) setActiveTab("ordenes")
  }

  function onTabChange(tab: string) {
    const next = parseTab(tab)
    setActiveTab(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set("tab", next)
        return p
      },
      { replace: true },
    )
  }

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
      const rows = data.rows ?? []
      setRawAreaRows(rows)
      setAggRows(pivotProductionRows(rows))
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen de tiempos.")
      setRawAreaRows([])
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

  const loadPlantPreview = useCallback(async () => {
    plantPreviewAbortRef.current?.abort()
    const ac = new AbortController()
    plantPreviewAbortRef.current = ac
    setLoadingPlantPreview(true)
    setActiveTab("areas")
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set("tab", "areas")
        return p
      },
      { replace: true },
    )
    try {
      const url = buildApiUrl("reports/production-time-by-area/preview", { from, to })
      const res = await fetch(url, { headers: authHeadersDownload(), signal: ac.signal })
      if (!res.ok) {
        if (res.status === 401) throw new ApiError("Sesión expirada o no autorizada.", 401, {})
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
      }
      setPlantPreviewHtml(await res.text())
      toast.success("Vista previa planta lista.")
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar la vista previa de planta.")
    } finally {
      if (plantPreviewAbortRef.current === ac) {
        setLoadingPlantPreview(false)
      }
    }
  }, [from, to])

  const loadOtPreview = useCallback(
    async (opts?: { silent?: boolean }) => {
      otPreviewAbortRef.current?.abort()
      if (!canRunOtReport) {
        setOtPreviewHtml("")
        return
      }

      const ac = new AbortController()
      otPreviewAbortRef.current = ac
      const silent = opts?.silent ?? false
      setLoadingOtPreview(true)
      try {
        const query = buildWorkOrderTimeReportQuery(from, to, aggregateAll, woId)
        const url = buildApiUrl("reports/work-order-time-report/preview", query)
        const res = await fetch(url, { headers: authHeadersDownload(), signal: ac.signal })
        if (!res.ok) {
          if (res.status === 401) throw new ApiError("Sesión expirada o no autorizada.", 401, {})
          const body = (await res.json().catch(() => ({}))) as { message?: string }
          throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
        }
        setOtPreviewHtml(await res.text())
        if (!silent) toast.success("Vista previa OT actualizada.")
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo generar la vista previa OT.")
      } finally {
        if (otPreviewAbortRef.current === ac) {
          setLoadingOtPreview(false)
        }
      }
    },
    [aggregateAll, canRunOtReport, from, to, woId],
  )

  useEffect(() => {
    if (!canRunOtReport) {
      setOtPreviewHtml("")
      return
    }
    void loadOtPreview({ silent: true })
    return () => {
      otPreviewAbortRef.current?.abort()
    }
  }, [loadOtPreview, canRunOtReport])

  useEffect(() => {
    if (
      activeTab === "ordenes" &&
      !loadingOtPreview &&
      otPreviewHtml &&
      pendingScrollToOtPreviewRef.current &&
      otPreviewIframeRef.current
    ) {
      pendingScrollToOtPreviewRef.current = false
      requestAnimationFrame(() => {
        otPreviewIframeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }, [activeTab, loadingOtPreview, otPreviewHtml])

  function selectRow(row: WorkOrderTimeCandidate) {
    handleWoIdChange(String(row.work_order_id))
  }

  function openRowPreview(row: WorkOrderTimeCandidate) {
    handleWoIdChange(String(row.work_order_id))
    pendingScrollToOtPreviewRef.current = true
  }

  async function downloadPlantPdf() {
    setLoading(true)
    try {
      await apiDownloadFile("reports/production-time-by-area.pdf", {
        query: { from, to },
        fallbackName: `production-time-by-area-${from}-${to}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF de planta.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadOtPdf() {
    if (!canRunOtReport) {
      toast.error("Elija una OT en la tabla o active el agregado de todas las OT.")
      return
    }
    setLoading(true)
    try {
      const query = buildWorkOrderTimeReportQuery(from, to, aggregateAll, woId)
      const tag = aggregateAll ? `${from}-${to}` : `ot-${woId.trim()}`
      await apiDownloadFile("reports/work-order-time-report.pdf", {
        query,
        fallbackName: `reporte-tiempos-${tag}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF de OT.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadAreaExcel() {
    setLoading(true)
    try {
      await exportPlantTimesExcel({
        from,
        to,
        candidates,
        areaRows,
        aggRows,
        rawRows: rawAreaRows,
      })
      toast.success("Excel generado.")
    } catch (e) {
      toast.error("No se pudo generar el Excel de planta.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadOtExcel() {
    if (!canRunOtReport) {
      toast.error("Elija una OT en la tabla o active el agregado de todas las OT.")
      return
    }
    setLoading(true)
    try {
      const query = buildWorkOrderTimeReportQuery(from, to, aggregateAll, woId)
      const payload = await apiFetch<WorkOrderTimeReportPayload>("reports/work-order-time-report", {
        query,
      })
      const tag = aggregateAll ? `reporte-tiempos-${from}-${to}` : `reporte-tiempos-ot-${woId.trim()}`
      await exportWorkOrderTimeReportExcel(payload, tag)
      toast.success("Excel generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el Excel de OT.")
    } finally {
      setLoading(false)
    }
  }

  const filtersLoading = useMemo(
    () => loadingCandidates || loadingOtPreview,
    [loadingCandidates, loadingOtPreview],
  )

  const areaRows = useMemo(() => rollupByArea(aggRows), [aggRows])

  return (
    <TooltipProvider>
      <ReportPageShell
        title="Producción y tiempos"
        description="Tiempos por orden de trabajo y por las cinco áreas (montaje, impresión, laminación, corte, tintas). Use las pestañas para navegar; exporte PDF o Excel con tablas formateadas."
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        showRange={false}
      >
        <ProductionTimeReportFilters
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          aggregateAll={aggregateAll}
          onAggregateAllChange={handleAggregateAllChange}
          woId={woId}
          onWoIdChange={handleWoIdChange}
          candidates={candidates}
          loading={filtersLoading}
          actionsSlot={
            <ProductionTimeActions
              loadingPlantPreview={loadingPlantPreview}
              loadingOtPreview={loadingOtPreview}
              loadingDownloads={loading}
              canRunOtReport={canRunOtReport}
              aggregateAll={aggregateAll}
              onPlantPreview={() => void loadPlantPreview()}
              onPlantPdf={() => void downloadPlantPdf()}
              onOtPreview={() => {
                setActiveTab("ordenes")
                onTabChange("ordenes")
                void loadOtPreview({ silent: false })
              }}
              onOtPdf={() => void downloadOtPdf()}
              onOtExcel={() => void downloadOtExcel()}
              onAreaExcel={() => void downloadAreaExcel()}
              onInkCsv={() =>
                void downloadCsv("reports/tinta-consumption-by-client", "tinta-consumption-by-client.csv", {
                  from,
                  to,
                })
              }
            />
          }
        />

        <div className="space-y-3">
          <ProductionTimeSingleAreaBanner areaRows={areaRows} />
          <ProductionTimeSegmentNotice
            candidates={candidates}
            woId={woId}
            aggregateAll={aggregateAll}
          />
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="mb-1 grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
            <TabsTrigger value="resumen" className="px-3 py-2 text-xs sm:text-sm">
              Resumen general
            </TabsTrigger>
            <TabsTrigger value="areas" className="px-3 py-2 text-xs sm:text-sm">
              Tiempos por área
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="px-3 py-2 text-xs sm:text-sm">
              Órdenes en el rango
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-4 space-y-4 focus-visible:outline-none">
            <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
              <p className="text-sm font-medium">Resumen general de planta</p>
              <p className="text-muted-foreground text-xs">
                Totales de todas las órdenes con tiempo registrado en el período (suma de las cinco áreas).
              </p>
              <ProductionTimePlantKpi candidates={candidates} />
            </div>
            <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
              <p className="text-sm font-medium">Tiempos por área de producción</p>
              <p className="text-muted-foreground text-xs">
                Vista rápida por Montaje, Impresión, Laminación, Corte y Tintas. Detalle en la pestaña{" "}
                <strong>Tiempos por área</strong>.
              </p>
              <ProductionTimeAreaKpiCards areaRows={areaRows} />
            </div>
          </TabsContent>

          <TabsContent value="areas" className="mt-4 space-y-4 focus-visible:outline-none">
            <ProductionTimeAreaSummaryTable areaRows={areaRows} loading={loadingSummary} />
            <ProductionTimeMachineTable aggRows={aggRows} loading={loadingSummary} />

            {plantPreviewHtml ? (
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">
                  Vista previa — planta (área y máquina)
                </p>
                <iframe
                  title="Vista previa: tiempos por área"
                  srcDoc={plantPreviewHtml}
                  className="h-[min(760px,70vh)] w-full rounded-md border"
                />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="ordenes" className="mt-4 space-y-4 focus-visible:outline-none">
            <ProductionTimeOtTable
              candidates={candidates}
              loading={loadingCandidates}
              selectedWoId={woId}
              aggregateAll={aggregateAll}
              onSelectRow={selectRow}
              onOpenRow={openRowPreview}
            />

            {otPreviewHtml ? (
              <div className="rounded-xl border bg-white p-2 shadow-sm">
                <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">
                  Vista previa — orden de trabajo (con paradas)
                </p>
                <iframe
                  ref={otPreviewIframeRef}
                  title="Vista previa del reporte de tiempos OT"
                  srcDoc={otPreviewHtml}
                  className="h-[min(760px,70vh)] w-full rounded-md border"
                />
              </div>
            ) : loadingOtPreview && canRunOtReport ? (
              <p className="text-muted-foreground text-xs">Generando vista previa OT…</p>
            ) : !canRunOtReport ? (
              <p className="text-muted-foreground text-xs">
                Elija una OT en el listado o active <strong>Agregado de todas las OT del rango</strong> para ver la
                vista previa con detalle de paradas.
              </p>
            ) : null}
          </TabsContent>
        </Tabs>
      </ReportPageShell>
    </TooltipProvider>
  )
}
