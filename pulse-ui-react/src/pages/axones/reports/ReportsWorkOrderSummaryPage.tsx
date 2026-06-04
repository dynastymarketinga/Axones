"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ClipboardList, Info } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { appAbsoluteUrl } from "@/lib/app-base-path"
import { ApiError, apiDownloadFile, apiFetch } from "@/lib/api"

import {
  formatDurationHms,
  PRODUCTION_AREA_LABELS,
  ReportPageShell,
  useReportRange,
} from "./report-shared"
import { getReportIdentity } from "./ReportIdentityBanner"
import { WorkOrderSummaryReportFilters } from "./work-order-summary-report-filters"

type BobinaUsageRow = {
  sku?: string | null
  name?: string | null
  quantity_used_kg?: string
  quantity_finished_kg?: string
  bobina_id?: number | null
}

type InkLineRow = {
  sku?: string | null
  name?: string | null
  quantity_original_kg?: string
  quantity_solventada_kg?: string
  quantity_return_kg?: string
  quantity_consumed_kg?: string
}

type ChemicalRow = {
  chemical_type?: string
  quantity_loaded_kg?: string
  quantity_return_kg?: string
  quantity_consumed_kg?: string
}

type AreaConsumables = {
  area: string
  area_label: string
  bobina_usages?: BobinaUsageRow[]
  ink_control_lines?: InkLineRow[]
  chemical_usages?: ChemicalRow[]
  solvent_quantity_kg?: string
  solvent_notes?: string | null
}

type AreaTimes = {
  area: string
  area_label: string
  production_seconds: number
  downtime_seconds: number
  mount_seconds: number
  total_seconds: number
}

type ProductionSummaryPayload = {
  virgin_material?: {
    printing_total_entrada_kg?: string
    laminacion_total_virgen_kg?: string
  }
  material_listo?: {
    impreso?: { num_bobinas?: number; peso_total_kg?: string }
    laminado?: { peso_total_salida_kg?: string; num_bobinas?: number }
    corte_kg_salida?: string
    total_listo_despacho_kg?: string
    total_general_kg?: string
  }
  scrap?: {
    printing?: { transparente_kg?: string; impreso_kg?: string; total_kg?: string }
    laminacion?: {
      transparente_kg?: string
      impreso_kg?: string
      laminado_kg?: string
      total_kg?: string
    }
    corte?: { refile_kg?: string; impreso_kg?: string; mal_corte_kg?: string; total_kg?: string }
    grand_total_kg?: string
  }
  montaje_consumo?: {
    lines?: Array<{ sticky_back?: string; codigo?: string; color?: string; cantidad?: string }>
    total_produccion_kg?: string
    total_merma_kg?: string
  }
  tintas?: {
    total_original_kg?: string
    total_solventadas_kg?: string
    total_consumed_kg?: string
    alcohol_kg?: string
    metoxil_kg?: string
    npa_kg?: string
  }
  laminacion_quimicos?: {
    adhesivo_consumido_kg?: string
    catalizador_consumido_kg?: string
    acetato_consumido_lt?: string
  }
}

type ControlsSummaryPayload = {
  work_order: {
    id: number
    code: string
    client_name?: string | null
    product_name?: string | null
    client_order_code?: string | null
    status?: string
  }
  production_summary?: ProductionSummaryPayload
  consumables: {
    by_area: Record<string, AreaConsumables>
  }
  times: {
    by_area: AreaTimes[]
    totals: {
      production_seconds: number
      downtime_seconds: number
      mount_seconds: number
      total_seconds: number
      effective_percent?: string
    }
  }
}

const CONTROL_AREA_ORDER = ["printing", "laminacion", "corte"] as const

function parseKgNum(raw: string | undefined): number {
  const n = Number.parseFloat(String(raw ?? "0").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function summaryHasRecordedData(
  ps: ProductionSummaryPayload | undefined,
  times: ControlsSummaryPayload["times"] | undefined,
): boolean {
  if (!ps) return false
  const kg =
    parseKgNum(ps.virgin_material?.printing_total_entrada_kg) +
    parseKgNum(ps.virgin_material?.laminacion_total_virgen_kg) +
    parseKgNum(ps.material_listo?.impreso?.peso_total_kg) +
    parseKgNum(ps.material_listo?.laminado?.peso_total_salida_kg) +
    parseKgNum(ps.material_listo?.corte_kg_salida) +
    parseKgNum(ps.scrap?.grand_total_kg) +
    parseKgNum(ps.tintas?.total_consumed_kg) +
    parseKgNum(ps.laminacion_quimicos?.adhesivo_consumido_kg)
  const bobinas =
    (ps.material_listo?.impreso?.num_bobinas ?? 0) + (ps.material_listo?.laminado?.num_bobinas ?? 0)
  const montaje =
    (ps.montaje_consumo?.lines?.length ?? 0) > 0 ||
    parseKgNum(ps.montaje_consumo?.total_produccion_kg) > 0.0005 ||
    parseKgNum(ps.montaje_consumo?.total_merma_kg) > 0.0005
  const timeSec =
    (times?.totals?.production_seconds ?? 0) +
    (times?.totals?.downtime_seconds ?? 0) +
    (times?.totals?.mount_seconds ?? 0)
  return kg > 0.0005 || bobinas > 0 || montaje || timeSec > 0
}

export default function ReportsWorkOrderSummaryPage() {
  const { loading, setLoading, downloadCsv } = useReportRange()
  const [searchParams, setSearchParams] = useSearchParams()
  const [woId, setWoId] = useState(() => {
    const fromUrl = searchParams.get("work_order_id") ?? searchParams.get("ot")
    return fromUrl?.trim() ?? ""
  })
  const [summary, setSummary] = useState<ControlsSummaryPayload | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  const openPreviewWindow = useCallback(() => {
    const id = woId.trim()
    if (!id) return
    const params = new URLSearchParams({ work_order_id: id })
    const url = appAbsoluteUrl(
      `/reportes/resumen-ordenes-trabajo/vista-previa?${params.toString()}`,
    )
    const popup = window.open(url, "_blank")
    if (!popup) toast.error("El navegador bloqueó la ventana emergente de vista previa.")
  }, [woId])

  const handleWoIdChange = useCallback(
    (id: string) => {
      setWoId(id)
      if (id.trim()) {
        setSearchParams({ work_order_id: id.trim() }, { replace: true })
      } else {
        setSearchParams({}, { replace: true })
      }
    },
    [setSearchParams],
  )

  const loadSummary = useCallback(async (id: string) => {
    const num = Number(id.trim())
    if (!Number.isFinite(num) || num < 1) {
      setSummary(null)
      return
    }
    setLoadingSummary(true)
    try {
      const data = await apiFetch<ControlsSummaryPayload>(
        `reports/work-order-controls-summary?work_order_id=${num}`,
      )
      setSummary(data)
    } catch (e) {
      setSummary(null)
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el resumen.")
    } finally {
      setLoadingSummary(false)
    }
  }, [])

  useEffect(() => {
    if (!woId.trim()) {
      setSummary(null)
      return
    }
    void loadSummary(woId)
  }, [woId, loadSummary])

  async function downloadPdf() {
    if (!woId.trim()) return
    setLoading(true)
    try {
      await apiDownloadFile("reports/work-order-controls-summary.pdf", {
        query: { work_order_id: Number(woId.trim()) },
        fallbackName: `resumen-ot-controles-${woId.trim()}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    } finally {
      setLoading(false)
    }
  }

  const totals = summary?.times.totals
  const byArea = summary?.consumables.by_area ?? {}
  const ps = summary?.production_summary
  const hasRecordedData = useMemo(
    () => summaryHasRecordedData(ps, summary?.times),
    [ps, summary?.times],
  )

  function SummaryMetric({ label, value }: { label: string; value: string | number }) {
    return (
      <div className="rounded-md border px-3 py-2 text-sm">
        <span className="text-muted-foreground block text-xs">{label}</span>
        <span className="font-mono font-semibold">{value}</span>
      </div>
    )
  }

  return (
    <ReportPageShell
      identityKey="resumen-ot"
      title="Resumen de órdenes de trabajo"
      description="Ficha de una OT: material, merma, tintas, químicos y tiempos de impresión, laminación y corte."
      showRange={false}
    >
      <WorkOrderSummaryReportFilters
        woId={woId}
        onWoIdChange={handleWoIdChange}
        loading={loading || loadingSummary}
        activeFilterCount={woId.trim() ? 1 : 0}
        theme={getReportIdentity("resumen-ot").theme}
        onPreview={() => openPreviewWindow()}
        onPdf={() => void downloadPdf()}
        onCsv={() =>
          void downloadCsv(
            "reports/work-order-controls-summary",
            `resumen-ot-controles-${woId.trim()}.csv`,
            { work_order_id: Number(woId.trim()) },
          )
        }
      />

      {!woId.trim() ? (
        <Card className="border-dashed border-amber-500/35 bg-amber-500/[0.04]">
          <CardContent className="flex gap-3 pt-6">
            <ClipboardList className="mt-0.5 h-8 w-8 shrink-0 text-primary/80" aria-hidden />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-foreground">Aquí verá tablas y totales al elegir la OT</p>
              <p className="text-muted-foreground leading-snug">
                Este reporte no lista todas las órdenes: debe seleccionar una en{" "}
                <span className="font-medium text-foreground">Orden de trabajo</span>. Después aparecen
                tarjetas con material virgen, material listo, desperdicio, montaje, tintas, químicos de
                laminación y tiempos (suma de impresión, laminación y corte).
              </p>
              <p className="text-muted-foreground leading-snug">
                Los datos salen de la planilla de producción después de{" "}
                <span className="font-medium text-foreground">Guardar</span> en cada área (salida de
                bobinas, desperdicio, cronómetro, etc.).
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {woId.trim() ? (
        <div className="space-y-6">
          {loadingSummary ? (
            <p className="text-muted-foreground text-sm">Cargando resumen…</p>
          ) : summary ? (
            <>
              {!hasRecordedData ? (
                <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-950/30">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <div className="space-y-1.5 text-amber-950 dark:text-amber-100">
                    <p className="font-medium">La OT está seleccionada pero los totales están en cero</p>
                    <p className="text-xs leading-snug opacity-90">
                      Registre en producción: salida de bobina impresa/laminada, desperdicio del turno y
                      use el cronómetro; luego pulse Guardar. En impresión, «Producido» usa la rejilla{" "}
                      <span className="font-semibold">Proceso — salida bobina impresa</span>, no los kg de
                      la especificación de la OT.
                    </p>
                    <Link
                      to={`/ordenes-trabajo/${woId.trim()}/produccion?tab=printing`}
                      className="text-xs font-semibold underline underline-offset-2"
                    >
                      Ir a producción de esta OT
                    </Link>
                  </div>
                </div>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {summary.work_order.code}
                    {summary.work_order.client_name
                      ? ` · ${summary.work_order.client_name}`
                      : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground space-y-1 text-sm">
                  <p>
                    <span className="text-foreground font-medium">Producto:</span>{" "}
                    {summary.work_order.product_name ?? "—"}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Pedido cliente:</span>{" "}
                    {summary.work_order.client_order_code ?? "—"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Material virgen consumible</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <SummaryMetric
                    label="Impresión — total entrada"
                    value={`${ps?.virgin_material?.printing_total_entrada_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Laminación — material virgen"
                    value={`${ps?.virgin_material?.laminacion_total_virgen_kg ?? "0.000"} kg`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Material listo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryMetric
                    label="Impreso — Nº bobinas"
                    value={ps?.material_listo?.impreso?.num_bobinas ?? 0}
                  />
                  <SummaryMetric
                    label="Impreso — peso total"
                    value={`${ps?.material_listo?.impreso?.peso_total_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Laminado — peso total salida"
                    value={`${ps?.material_listo?.laminado?.peso_total_salida_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Laminado — Nº bobinas"
                    value={ps?.material_listo?.laminado?.num_bobinas ?? 0}
                  />
                  <SummaryMetric
                    label="Corte — kg salida"
                    value={`${ps?.material_listo?.corte_kg_salida ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Listo para despachar (solo corte)"
                    value={`${ps?.material_listo?.total_listo_despacho_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Resumen general (imp. + lam. + corte)"
                    value={`${ps?.material_listo?.total_general_kg ?? "0.000"} kg`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desperdicio total</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryMetric
                      label="Impresión (transp. / impreso)"
                      value={`${ps?.scrap?.printing?.transparente_kg ?? "0.000"} / ${ps?.scrap?.printing?.impreso_kg ?? "0.000"} kg`}
                    />
                    <SummaryMetric
                      label="Laminación (T / I / L)"
                      value={`${ps?.scrap?.laminacion?.transparente_kg ?? "0.000"} / ${ps?.scrap?.laminacion?.impreso_kg ?? "0.000"} / ${ps?.scrap?.laminacion?.laminado_kg ?? "0.000"} kg`}
                    />
                    <SummaryMetric
                      label="Corte (refile / impreso / mal corte)"
                      value={`${ps?.scrap?.corte?.refile_kg ?? "0.000"} / ${ps?.scrap?.corte?.impreso_kg ?? "0.000"} / ${ps?.scrap?.corte?.mal_corte_kg ?? "0.000"} kg`}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Total general:{" "}
                    <span className="text-foreground font-mono font-semibold">
                      {ps?.scrap?.grand_total_kg ?? "0.000"} kg
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Consumo de montaje</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryMetric
                      label="Producción montaje (kg)"
                      value={ps?.montaje_consumo?.total_produccion_kg ?? "0.000"}
                    />
                    <SummaryMetric
                      label="Merma montaje (kg)"
                      value={ps?.montaje_consumo?.total_merma_kg ?? "0.000"}
                    />
                  </div>
                  {(ps?.montaje_consumo?.lines?.length ?? 0) > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sticky back</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(ps?.montaje_consumo?.lines ?? []).map((row, i) => (
                          <TableRow key={`mont-${i}`}>
                            <TableCell>{row.sticky_back || "—"}</TableCell>
                            <TableCell>{row.codigo || "—"}</TableCell>
                            <TableCell>{row.color || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.cantidad || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-xs">Sin materiales registrados en montaje.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Total tintas usadas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <SummaryMetric
                    label="Total original"
                    value={`${ps?.tintas?.total_original_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Total solventadas"
                    value={`${ps?.tintas?.total_solventadas_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Consumo neto"
                    value={`${ps?.tintas?.total_consumed_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric label="Alcohol" value={`${ps?.tintas?.alcohol_kg ?? "0.000"} kg`} />
                  <SummaryMetric label="Metoxil" value={`${ps?.tintas?.metoxil_kg ?? "0.000"} kg`} />
                  <SummaryMetric label="NPA" value={`${ps?.tintas?.npa_kg ?? "0.000"} kg`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Químicos laminación</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <SummaryMetric
                    label="Adhesivo consumido"
                    value={`${ps?.laminacion_quimicos?.adhesivo_consumido_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Catalizador consumido"
                    value={`${ps?.laminacion_quimicos?.catalizador_consumido_kg ?? "0.000"} kg`}
                  />
                  <SummaryMetric
                    label="Acetato consumido"
                    value={`${ps?.laminacion_quimicos?.acetato_consumido_lt ?? "0.000"} Lt`}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tiempos (Impresión + Laminación + Corte)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                      <span className="text-muted-foreground block text-xs">Tiempo efectivo</span>
                      <span className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatDurationHms(totals?.production_seconds ?? 0)}
                      </span>
                    </div>
                    <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                      <span className="text-muted-foreground block text-xs">Tiempo muerto</span>
                      <span className="font-mono text-lg font-semibold text-red-700 dark:text-red-300">
                        {formatDurationHms(totals?.downtime_seconds ?? 0)}
                      </span>
                    </div>
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <span className="text-muted-foreground block text-xs">Montaje y arranque</span>
                      <span className="font-mono text-lg font-semibold text-amber-800 dark:text-amber-200">
                        {formatDurationHms(totals?.mount_seconds ?? 0)}
                      </span>
                    </div>
                    <div className="rounded-md border px-3 py-2">
                      <span className="text-muted-foreground block text-xs">Total</span>
                      <span className="font-mono text-lg font-semibold">
                        {formatDurationHms(totals?.total_seconds ?? 0)}
                      </span>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Área</TableHead>
                        <TableHead className="text-right">Efectivo</TableHead>
                        <TableHead className="text-right">Muerto</TableHead>
                        <TableHead className="text-right">Montaje / arranque</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(summary.times.by_area ?? []).map((row) => (
                        <TableRow key={row.area}>
                          <TableCell>{row.area_label ?? PRODUCTION_AREA_LABELS[row.area] ?? row.area}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatDurationHms(row.production_seconds)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatDurationHms(row.downtime_seconds)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatDurationHms(row.mount_seconds)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatDurationHms(row.total_seconds)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-muted-foreground text-xs">
                    Suma de segmentos cerrados del cronómetro en cada control de producción. No incluye Montaje ni Tintas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Consumibles por área de control</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {CONTROL_AREA_ORDER.map((areaKey) => {
                    const block = byArea[areaKey]
                    if (!block) return null
                    const label = block.area_label ?? PRODUCTION_AREA_LABELS[areaKey] ?? areaKey
                    const bobinas = block.bobina_usages ?? []
                    return (
                      <div key={areaKey} className="space-y-2">
                        <h3 className="text-sm font-semibold">{label}</h3>
                        {bobinas.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right">Usado (kg)</TableHead>
                                <TableHead className="text-right">Terminado (kg)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bobinas.map((row, i) => (
                                <TableRow key={`${areaKey}-b-${i}`}>
                                  <TableCell>
                                    {row.sku ? `${row.sku} · ` : ""}
                                    {row.name ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {row.quantity_used_kg ?? "0.000"}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-sm">
                                    {row.quantity_finished_kg ?? "0.000"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <p className="text-muted-foreground text-xs">Sin bobinas registradas.</p>
                        )}

                        {areaKey === "printing" && (block.ink_control_lines?.length ?? 0) > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium">Tintas</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tinta</TableHead>
                                  <TableHead className="text-right">Consumo neto (kg)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(block.ink_control_lines ?? []).map((row, i) => (
                                  <TableRow key={`ink-${i}`}>
                                    <TableCell>{row.name ?? row.sku ?? "—"}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {row.quantity_consumed_kg ?? "0.000"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {areaKey === "printing" && (block.chemical_usages?.length ?? 0) > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium">Químicos</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tipo</TableHead>
                                  <TableHead className="text-right">Consumo neto (kg)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(block.chemical_usages ?? []).map((row, i) => (
                                  <TableRow key={`chem-${i}`}>
                                    <TableCell className="capitalize">{row.chemical_type ?? "—"}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">
                                      {row.quantity_consumed_kg ?? "0.000"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        {areaKey === "laminacion" && (
                          <p className="text-muted-foreground text-xs">
                            Solvente:{" "}
                            <span className="text-foreground font-mono">
                              {block.solvent_quantity_kg ?? "0.000"} kg
                            </span>
                            {block.solvent_notes ? ` · ${block.solvent_notes}` : ""}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No hay datos para esta OT.</p>
          )}
        </div>
      ) : null}
    </ReportPageShell>
  )
}
