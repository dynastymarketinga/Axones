"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ApiError, apiDownloadFile, apiFetch } from "@/lib/api"
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
} from "./production-time-excel"
import {
  ProductionTimeSegmentNotice,
  ProductionTimeSingleAreaBanner,
} from "./production-time-insights"
import { ProductionTimeOtTable } from "./production-time-ot-table"
import { ProductionTimeReportFilters } from "./production-time-report-filters"
import { getReportIdentity } from "./ReportIdentityBanner"
import {
  parseIncludeLive,
  pivotProductionRows,
  ReportPageShell,
  rollupByArea,
  useReportRange,
  type ProductionTimeAggRow,
  type ProductionTimeLiveActiveEntry,
  type ProductionTimeRawRow,
  type WorkOrderTimeCandidate,
} from "./report-shared"

type CandidatesResponse = {
  work_orders: WorkOrderTimeCandidate[]
  live_active?: ProductionTimeLiveActiveEntry[]
}

export type ProductionTimeTab = "resumen" | "areas" | "ordenes"

const TAB_VALUES: ProductionTimeTab[] = ["resumen", "areas", "ordenes"]

function parseTab(value: string | null): ProductionTimeTab {
  if (value && TAB_VALUES.includes(value as ProductionTimeTab)) {
    return value as ProductionTimeTab
  }
  return "resumen"
}

const LIVE_REFRESH_MS = 30_000

export default function ReportsProductionPage() {
  const { from, setFrom, to, setTo, loading, setLoading } = useReportRange()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<ProductionTimeTab>(() =>
    parseTab(searchParams.get("tab")),
  )
  const [woId, setWoId] = useState(() => searchParams.get("ot") ?? "")
  const [aggregateAll, setAggregateAll] = useState(
    () => searchParams.get("aggregate") === "all",
  )
  const [includeLive, setIncludeLive] = useState(() =>
    parseIncludeLive(searchParams.get("live")),
  )
  const [liveAsOf, setLiveAsOf] = useState<string | null>(null)
  const [liveActive, setLiveActive] = useState<ProductionTimeLiveActiveEntry[]>([])

  const [rawAreaRows, setRawAreaRows] = useState<ProductionTimeRawRow[]>([])
  const [aggRows, setAggRows] = useState<ProductionTimeAggRow[]>([])
  const [candidates, setCandidates] = useState<WorkOrderTimeCandidate[]>([])
  const [loadingCandidates, setLoadingCandidates] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const summaryAbortRef = useRef<AbortController | null>(null)
  const candidatesAbortRef = useRef<AbortController | null>(null)

  const canRunOtReport = aggregateAll || woId.trim() !== ""

  const openPlantPreviewWindow = useCallback(() => {
    const params = new URLSearchParams({ view: "planta", from, to })
    const url = `${window.location.origin}/axones/reportes/produccion/vista-previa?${params.toString()}`
    const popup = window.open(url, "_blank")
    if (!popup) toast.error("El navegador bloqueó la ventana emergente de vista previa.")
  }, [from, to])

  const openOtPreviewWindow = useCallback(
    (otOverride?: string) => {
      if (!canRunOtReport && !otOverride?.trim()) return
      const params = new URLSearchParams({ view: "ot", from, to })
      if (aggregateAll && !otOverride?.trim()) {
        params.set("aggregate", "all")
      } else {
        const id = (otOverride ?? woId).trim()
        if (id) params.set("ot", id)
      }
      const url = `${window.location.origin}/axones/reportes/produccion/vista-previa?${params.toString()}`
      const popup = window.open(url, "_blank")
      if (!popup) toast.error("El navegador bloqueó la ventana emergente de vista previa.")
    },
    [aggregateAll, canRunOtReport, from, to, woId],
  )

  useEffect(() => {
    const ot = searchParams.get("ot")
    const tab = searchParams.get("tab")
    const agg = searchParams.get("aggregate") === "all"
    const live = parseIncludeLive(searchParams.get("live"))

    if (ot) {
      setWoId(ot)
      setAggregateAll(false)
      setActiveTab("ordenes")
      setIncludeLive(live)
      return
    }

    setAggregateAll(agg)
    setIncludeLive(live)
    if (agg) setWoId("")

    if (tab) {
      setActiveTab(parseTab(tab))
    } else if (agg) {
      setActiveTab("ordenes")
    }
  }, [searchParams])

  function handleIncludeLiveChange(checked: boolean) {
    setIncludeLive(checked)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (checked) p.delete("live")
        else p.set("live", "0")
        return p
      },
      { replace: true },
    )
  }

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
      const query: Record<string, string> = { from, to }
      if (includeLive) query.live = "1"
      const data = await apiFetch<{ rows?: ProductionTimeRawRow[]; live_as_of?: string }>(
        "reports/production-time-by-area",
        {
          query,
          signal: ac.signal,
        },
      )
      const rows = data.rows ?? []
      setRawAreaRows(rows)
      setAggRows(pivotProductionRows(rows))
      if (includeLive && data.live_as_of) setLiveAsOf(data.live_as_of)
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
  }, [from, to, includeLive])

  const loadCandidates = useCallback(async () => {
    candidatesAbortRef.current?.abort()
    const ac = new AbortController()
    candidatesAbortRef.current = ac
    setLoadingCandidates(true)
    try {
      const query: Record<string, string> = { from, to }
      if (includeLive) query.live = "1"
      const data = await apiFetch<CandidatesResponse & { live_as_of?: string }>(
        "reports/work-order-time-report/candidates",
        {
          query,
          signal: ac.signal,
        },
      )
      setCandidates(data.work_orders ?? [])
      if (includeLive) {
        if (data.live_as_of) setLiveAsOf(data.live_as_of)
        setLiveActive(data.live_active ?? [])
      } else {
        setLiveActive([])
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado de órdenes.")
      setCandidates([])
      setLiveActive([])
    } finally {
      if (candidatesAbortRef.current === ac) {
        setLoadingCandidates(false)
      }
    }
  }, [from, to, includeLive])

  useEffect(() => {
    void loadSummary()
    void loadCandidates()
    return () => {
      summaryAbortRef.current?.abort()
      candidatesAbortRef.current?.abort()
    }
  }, [loadSummary, loadCandidates])

  useEffect(() => {
    if (!includeLive) {
      setLiveActive([])
      return
    }
    const timer = window.setInterval(() => {
      void loadSummary()
      void loadCandidates()
    }, LIVE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [includeLive, loadSummary, loadCandidates])

  function selectRow(row: WorkOrderTimeCandidate) {
    handleWoIdChange(String(row.work_order_id))
  }

  function openRowPreview(row: WorkOrderTimeCandidate) {
    handleWoIdChange(String(row.work_order_id))
    openOtPreviewWindow(String(row.work_order_id))
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

  const filtersLoading = loadingCandidates

  const areaRows = useMemo(() => rollupByArea(aggRows), [aggRows])

  return (
    <TooltipProvider>
      <ReportPageShell
        identityKey="produccion-tiempos"
        title="Producción y tiempos"
        description="Cronómetros de planta: tiempo efectivo, muerto y montaje por área (Montaje, Impresión, Laminación y Corte)."
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
          includeLive={includeLive}
          onIncludeLiveChange={handleIncludeLiveChange}
          aggregateAll={aggregateAll}
          onAggregateAllChange={handleAggregateAllChange}
          woId={woId}
          onWoIdChange={handleWoIdChange}
          candidates={candidates}
          loading={filtersLoading}
          actionsSlot={
            <ProductionTimeActions
              loadingDownloads={loading}
              onPreview={openPlantPreviewWindow}
              onPdf={() => void downloadPlantPdf()}
              onExcel={() => void downloadAreaExcel()}
            />
          }
          theme={getReportIdentity("produccion-tiempos").theme}
        />

        <div className="space-y-3">
          <ProductionTimeSingleAreaBanner areaRows={areaRows} />
          <ProductionTimeSegmentNotice
            candidates={candidates}
            woId={woId}
            aggregateAll={aggregateAll}
            includeLive={includeLive}
            liveAsOf={liveAsOf}
            liveActive={liveActive}
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
            <div className="bg-card space-y-3 rounded-2xl border p-3 shadow-sm sm:p-4">
              <p className="text-sm font-medium">Resumen general de planta</p>
              <p className="text-muted-foreground text-xs">
                Totales de todas las órdenes con tiempo registrado en el período (suma de las cuatro áreas con cronómetro).
                {includeLive ? " Incluye turnos en curso." : ""}
              </p>
              <ProductionTimePlantKpi candidates={candidates} />
            </div>
            <div className="bg-card space-y-3 rounded-2xl border p-3 shadow-sm sm:p-4">
              <p className="text-sm font-medium">Tiempos por área de producción</p>
              <p className="text-muted-foreground text-xs">
                Vista rápida por Montaje, Impresión, Laminación y Corte. Detalle en la pestaña{" "}
                <strong>Tiempos por área</strong>.
              </p>
              <ProductionTimeAreaKpiCards areaRows={areaRows} />
            </div>
          </TabsContent>

          <TabsContent value="areas" className="mt-4 space-y-4 focus-visible:outline-none">
            <ProductionTimeAreaSummaryTable
              areaRows={areaRows}
              loading={loadingSummary}
              includeLive={includeLive}
            />
            <ProductionTimeMachineTable
              aggRows={aggRows}
              loading={loadingSummary}
              includeLive={includeLive}
            />
          </TabsContent>

          <TabsContent value="ordenes" className="mt-4 space-y-4 focus-visible:outline-none">
            <ProductionTimeOtTable
              candidates={candidates}
              loading={loadingCandidates}
              selectedWoId={woId}
              aggregateAll={aggregateAll}
              includeLive={includeLive}
              onSelectRow={selectRow}
              onOpenRow={openRowPreview}
            />

            {!canRunOtReport ? (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Elija una OT en el listado (tarjetas en móvil, tabla en pantalla grande) o active{" "}
                <strong>Agregado de todas las OT del rango</strong>.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Pulse <strong>Abrir</strong> en una fila o tarjeta para ver el detalle de esa OT con paradas en una
                pestaña nueva.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </ReportPageShell>
    </TooltipProvider>
  )
}
