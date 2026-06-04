"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Activity,
  Barcode,
  CircleDot,
  Columns3,
  ListOrdered,
  Package,
  Settings2,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import { ScrapClassificationHelp } from "@/components/axones/ScrapClassificationHelp"
import { ScrapReportFilters } from "@/components/axones/ScrapReportFilters"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  type ApiErrorBody,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  buildHistoryKgTabQuery,
  DEFAULT_SCRAP_SUBSTRATE_GROUPS,
  fetchScrapSubstrateConfig,
  type ScrapSubstrateGroupConfig,
} from "@/lib/scrap-substrate-catalog"
import { ReportPageShell, useReportRange } from "./report-shared"
import { getReportIdentity } from "./ReportIdentityBanner"
import { useReportEntityFilters } from "./use-report-entity-filters"

const WORK_ORDER_CODE_DEBOUNCE_MS = 400

type ScrapAggregateTab = "por-ot" | "por-areas"
type ScrapTab = string

type ScrapReportPayload = {
  rows: Record<string, unknown>[]
  substrate_group: string
  layout: string
}

const SCRAP_AGGREGATE_TAB_QUERY: Record<
  ScrapAggregateTab,
  { substrate_group: string; layout: string }
> = {
  "por-ot": { substrate_group: "all", layout: "by_work_order" },
  "por-areas": { substrate_group: "all", layout: "by_area" },
}

function buildScrapTabQuery(
  groups: ScrapSubstrateGroupConfig[],
): Record<string, { substrate_group: string; layout: string }> {
  const q: Record<string, { substrate_group: string; layout: string }> = {}
  for (const g of groups) {
    q[g.id] = buildHistoryKgTabQuery(g.id)
  }
  return { ...q, ...SCRAP_AGGREGATE_TAB_QUERY }
}

function scrapAreaLabel(area: string): string {
  if (area === "printing") return "Impresión"
  if (area === "corte") return "Corte"
  if (area === "laminacion") return "Laminación"
  if (area === "montaje") return "Montaje"
  return area
}

function workOrderStatusLabel(status?: string | null): string {
  const k = (status ?? "").toLowerCase().trim()
  if (k === "open") return "Pendiente"
  if (k === "in_progress") return "En proceso"
  if (k === "completed") return "Completada"
  if (k === "cancelled") return "Cancelada"
  return status?.trim() || "—"
}

function workOrderStatusBadgeClass(status?: string | null): string {
  const k = (status ?? "").toLowerCase().trim()
  if (k === "completed") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-emerald-950 dark:text-emerald-100 border-emerald-500/28 bg-emerald-500/10"
  }
  if (k === "cancelled") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
  }
  if (k === "in_progress") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-sky-950 dark:text-sky-100 border-sky-500/30 bg-sky-500/10"
  }
  return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-amber-950 dark:text-amber-100 border-amber-500/30 bg-amber-500/10"
}

function cellStr(v: unknown): string {
  if (v == null || v === "") return "—"
  return String(v)
}

function parseKgCellForSum(v: unknown): number {
  if (v == null || v === "" || v === "—") return 0
  const n = Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

const HISTORY_KG_SUM_KEYS = [
  "imp_scrap_transparente_kg",
  "imp_scrap_impreso_kg",
  "lam_scrap_transparente_kg",
  "lam_scrap_impreso_kg",
  "lam_scrap_laminado_kg",
  "cor_scrap_refile_kg",
  "cor_scrap_impreso_kg",
  "cor_scrap_mal_corte_kg",
] as const

type HistoryKgTotalsShape = Record<(typeof HISTORY_KG_SUM_KEYS)[number], number>

/** El backend enmascara kg transparentes salvo en la pestaña Transparente. */
function historyKgHideTransparentColumns(tab: ScrapTab): boolean {
  return tab !== "transparente" && tab !== "por-ot" && tab !== "por-areas"
}

const HISTORY_KG_COL_COUNT_FULL = 18
const HISTORY_KG_COL_COUNT_COMPACT = 16

function historyKgHeadKg(
  label: string,
  tooltip: string,
  className: string,
): ReactNode {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-muted-foreground decoration-muted-foreground/80">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem] text-xs leading-snug">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

function historyKgTotals(rows: Record<string, unknown>[]): HistoryKgTotalsShape {
  const init: HistoryKgTotalsShape = {
    imp_scrap_transparente_kg: 0,
    imp_scrap_impreso_kg: 0,
    lam_scrap_transparente_kg: 0,
    lam_scrap_impreso_kg: 0,
    lam_scrap_laminado_kg: 0,
    cor_scrap_refile_kg: 0,
    cor_scrap_impreso_kg: 0,
    cor_scrap_mal_corte_kg: 0,
  }
  return rows.reduce<HistoryKgTotalsShape>((acc, r) => {
    for (const k of HISTORY_KG_SUM_KEYS) {
      acc[k] += parseKgCellForSum(r[k])
    }
    return acc
  }, init)
}

export default function ReportsScrapPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const entity = useReportEntityFilters()
  const [workOrderCode, setWorkOrderCode] = useState("")
  const [workOrderCodeApplied, setWorkOrderCodeApplied] = useState("")
  const [substrateGroups, setSubstrateGroups] = useState<ScrapSubstrateGroupConfig[]>(
    DEFAULT_SCRAP_SUBSTRATE_GROUPS,
  )
  const [activeTab, setActiveTab] = useState<ScrapTab>("bopp")
  const [listLoading, setListLoading] = useState(false)
  const [payload, setPayload] = useState<ScrapReportPayload | null>(null)

  const scrapTabQuery = useMemo(
    () => buildScrapTabQuery(substrateGroups),
    [substrateGroups],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const cfg = await fetchScrapSubstrateConfig()
      if (!cancelled && cfg.groups.length > 0) {
        setSubstrateGroups(cfg.groups)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const valid = [...substrateGroups.map((g) => g.id), "por-ot", "por-areas"]
    if (!valid.includes(activeTab)) {
      setActiveTab(substrateGroups[0]?.id ?? "por-ot")
    }
  }, [activeTab, substrateGroups])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setWorkOrderCodeApplied(workOrderCode.trim())
    }, WORK_ORDER_CODE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [workOrderCode])

  const workOrderOtQ = useMemo(() => {
    if (!workOrderCodeApplied) return {}
    return { work_order_code: workOrderCodeApplied }
  }, [workOrderCodeApplied])

  const baseQuery = useMemo(
    () => ({
      from,
      to,
      client_id: entity.clientIdQ,
      product_id: entity.productIdQ,
      ...workOrderOtQ,
    }),
    [from, to, entity.clientIdQ, entity.productIdQ, workOrderOtQ],
  )

  const previewAbortRef = useRef<AbortController | null>(null)
  const [docOpen, setDocOpen] = useState(false)
  const [docHtml, setDocHtml] = useState("")
  const [docLoading, setDocLoading] = useState(false)
  const [docQuery, setDocQuery] = useState<Record<
    string,
    string | number | undefined
  > | null>(null)

  const openDesperdicioPreview = useCallback(
    async (extra?: { focus_work_order_id?: number; focus_area?: string }) => {
      const q: Record<string, string | number | undefined> = {
        ...baseQuery,
        ...scrapTabQuery[activeTab],
      }
      if (extra?.focus_work_order_id != null) {
        q.focus_work_order_id = extra.focus_work_order_id
      }
      if (extra?.focus_area) {
        q.focus_area = extra.focus_area
      }
      setDocQuery(q)
      setDocOpen(true)
      previewAbortRef.current?.abort()
      const ac = new AbortController()
      previewAbortRef.current = ac
      setDocLoading(true)
      setDocHtml("")
      try {
        const url = buildApiUrl("reports/scrap-by-filters/preview", q)
        const res = await fetch(url, {
          headers: authHeadersDownload(),
          signal: ac.signal,
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as ApiErrorBody
          throw new ApiError(
            body.message || `Error ${res.status}`,
            res.status,
            body,
          )
        }
        setDocHtml(await res.text())
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo cargar la vista previa.")
        setDocHtml("")
      } finally {
        if (previewAbortRef.current === ac) {
          setDocLoading(false)
        }
      }
    },
    [activeTab, baseQuery, scrapTabQuery],
  )

  const downloadFocusedPdf = useCallback(async () => {
    if (!docQuery) return
    try {
      await apiDownloadFile("reports/scrap-by-filters.pdf", {
        query: docQuery,
        fallbackName: `desperdicio-${from}-${to}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    }
  }, [docQuery, from, to])

  const loadPreview = useCallback(async () => {
    const q = scrapTabQuery[activeTab]
    if (!q) return
    setListLoading(true)
    try {
      const data = await apiFetch<ScrapReportPayload>("reports/scrap-by-filters", {
        query: { ...baseQuery, ...q },
      })
      setPayload(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado.")
      setPayload(null)
    } finally {
      setListLoading(false)
    }
  }, [activeTab, baseQuery, scrapTabQuery])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  function renderDetailTable(rows: Record<string, unknown>[]) {
    return (
      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-14">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
              <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
              <CatalogTableHead icon={Package}>Producto</CatalogTableHead>
              <CatalogTableHead icon={CircleDot}>Estatus</CatalogTableHead>
              <CatalogTableHead icon={Columns3}>Tablero</CatalogTableHead>
              <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Sin registros de desperdicio en este período.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => {
                const woId = Number(r.work_order_id)
                const area = String(r.area ?? "")
                const st = r.work_order_status as string | null | undefined
                return (
                  <TableRow key={`${woId}-${area}-${idx}`} className={catalogTableBodyRowClass}>
                    <TableCell
                      className={cn(
                        "tabular-nums text-muted-foreground",
                        catalogTableBodyCellClass,
                      )}
                    >
                      {idx + 1}
                    </TableCell>
                    <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                      {String(r.work_order_code ?? "—")}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {r.client_name != null && r.client_name !== ""
                        ? String(r.client_name)
                        : "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {r.product_name != null && r.product_name !== ""
                        ? String(r.product_name)
                        : "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <Badge variant="outline" className={workOrderStatusBadgeClass(st)}>
                        {workOrderStatusLabel(st)}
                      </Badge>
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {scrapAreaLabel(area)}
                    </TableCell>
                    <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-primary/25"
                          onClick={() =>
                            void openDesperdicioPreview({
                              focus_work_order_id: woId,
                              focus_area: area,
                            })
                          }
                        >
                          Abrir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  function renderPivotTable(rows: Record<string, unknown>[]) {
    const kgHeadClass = "min-w-[4.5rem] text-right text-xs font-medium tabular-nums"
    return (
      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-14">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Barcode}>Código</CatalogTableHead>
              <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
              <CatalogTableHead icon={Package}>Producto</CatalogTableHead>
              <CatalogTableHead icon={CircleDot}>Estatus</CatalogTableHead>
              <TableHead className={kgHeadClass}>Imp. impreso (kg)</TableHead>
              <TableHead className={kgHeadClass}>Imp. transparente (kg)</TableHead>
              <TableHead className={kgHeadClass}>Laminación (kg)</TableHead>
              <TableHead className={kgHeadClass}>Corte (kg)</TableHead>
              <TableHead className={kgHeadClass}>Total (kg)</TableHead>
              <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground">
                  Sin registros de desperdicio en este período.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => {
                const woId = Number(r.work_order_id)
                const st = r.work_order_status as string | null | undefined
                return (
                  <TableRow key={woId} className={catalogTableBodyRowClass}>
                    <TableCell
                      className={cn(
                        "tabular-nums text-muted-foreground",
                        catalogTableBodyCellClass,
                      )}
                    >
                      {idx + 1}
                    </TableCell>
                    <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                      {String(r.work_order_code ?? "—")}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {r.client_name != null && r.client_name !== ""
                        ? String(r.client_name)
                        : "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {r.product_name != null && r.product_name !== ""
                        ? String(r.product_name)
                        : "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      <Badge variant="outline" className={workOrderStatusBadgeClass(st)}>
                        {workOrderStatusLabel(st)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {cellStr(r.imp_scrap_impreso_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {cellStr(r.imp_scrap_transparente_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {cellStr(r.laminacion_scrap_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", catalogTableBodyCellClass)}>
                      {cellStr(r.corte_scrap_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", catalogTableBodyCellClass)}>
                      {cellStr(r.total_scrap_kg)}
                    </TableCell>
                    <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-primary/25"
                          onClick={() =>
                            void openDesperdicioPreview({
                              focus_work_order_id: woId,
                            })
                          }
                        >
                          Abrir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  function renderHistoryKgTable(rows: Record<string, unknown>[]) {
    const totals = rows.length ? historyKgTotals(rows) : null
    const hideTransparentKgCols = historyKgHideTransparentColumns(activeTab)
    const colCount = hideTransparentKgCols
      ? HISTORY_KG_COL_COUNT_COMPACT
      : HISTORY_KG_COL_COUNT_FULL
    const kgHeadClass =
      "min-w-[4.5rem] text-right text-xs font-medium tabular-nums"

    const tableInner = (
      <Table>
        <TableHeader>
          <TableRow className={catalogTableHeaderRowClass}>
            <CatalogTableHead icon={ListOrdered} className="w-12">
              N.º
            </CatalogTableHead>
            <CatalogTableHead icon={Barcode} className="min-w-[7rem]">
              Código OT
            </CatalogTableHead>
            <CatalogTableHead icon={Users} className="min-w-[8rem]">
              Cliente
            </CatalogTableHead>
            <CatalogTableHead icon={Package} className="min-w-[8rem]">
              Producto
            </CatalogTableHead>
            <CatalogTableHead icon={Columns3} className="min-w-[6.5rem]">
              Sustrato (corte)
            </CatalogTableHead>
            {!hideTransparentKgCols ? (
              <>
                {historyKgHeadKg(
                  "Imp. transp.",
                  "Kg de desperdicio transparente registrados en impresión (planilla técnica). En la pestaña Transparente concentra este concepto.",
                  kgHeadClass,
                )}
                {historyKgHeadKg(
                  "Imp. impreso",
                  "Kg de desperdicio impreso en impresión, según destino BOPP o Polietileno en la planilla de impresión.",
                  kgHeadClass,
                )}
                {historyKgHeadKg(
                  "Lam. transp.",
                  "Kg de desperdicio transparente en laminación (planilla técnica).",
                  kgHeadClass,
                )}
              </>
            ) : (
              historyKgHeadKg(
                "Imp. impreso",
                "Kg de desperdicio impreso en impresión. En BOPP y polietileno no se listan aquí las columnas de transparente.",
                kgHeadClass,
              )
            )}
            {historyKgHeadKg(
              "Lam. impreso",
              "Kg de desperdicio impreso en laminación.",
              kgHeadClass,
            )}
            {historyKgHeadKg(
              "Laminado",
              "Kg de desperdicio del laminado (capa laminada).",
              kgHeadClass,
            )}
            {historyKgHeadKg(
              "Refile",
              "Kg de refile / refill registrados en corte.",
              kgHeadClass,
            )}
            {historyKgHeadKg(
              "Impreso (corte)",
              "Kg de desperdicio impreso registrados en corte.",
              kgHeadClass,
            )}
            {historyKgHeadKg(
              "Mal corte",
              "Kg por mal corte u otros scrap de corte clasificados así en planilla.",
              kgHeadClass,
            )}
            {historyKgHeadKg(
              "% Impresión",
              "Porcentaje de desperdicio en impresión (por OT; no se suma en el pie).",
              "min-w-[4rem] text-right text-xs font-medium tabular-nums",
            )}
            {historyKgHeadKg(
              "% Laminación",
              "Porcentaje de desperdicio en laminación (por OT).",
              "min-w-[4rem] text-right text-xs font-medium tabular-nums",
            )}
            {historyKgHeadKg(
              "% Corte",
              "Porcentaje de desperdicio en corte (por OT).",
              "min-w-[4rem] text-right text-xs font-medium tabular-nums",
            )}
            {historyKgHeadKg(
              "% Montaje",
              "Porcentaje de desperdicio en montaje (por OT).",
              "min-w-[4rem] text-right text-xs font-medium tabular-nums",
            )}
            <CatalogTableHeadRight icon={Settings2} className="min-w-[5rem]">
              Acciones
            </CatalogTableHeadRight>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listLoading ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-muted-foreground">
                Cargando…
              </TableCell>
            </TableRow>
          ) : !rows.length ? (
            <TableRow>
              <TableCell colSpan={colCount} className="text-muted-foreground">
                No hay OT en este período, o ninguna está clasificada en esta pestaña. Revise fechas, planilla de
                desperdicio y sustrato en Corte.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r, idx) => {
              const woId = Number(r.work_order_id)
              const st = r.work_order_status as string | null | undefined
              return (
                <TableRow key={woId} className={catalogTableBodyRowClass}>
                  <TableCell
                    className={cn(
                      "tabular-nums text-muted-foreground",
                      catalogTableBodyCellClass,
                    )}
                  >
                    {idx + 1}
                  </TableCell>
                  <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                    {String(r.work_order_code ?? "—")}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {r.client_name != null && r.client_name !== ""
                      ? String(r.client_name)
                      : "—"}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {r.product_name != null && r.product_name !== ""
                      ? String(r.product_name)
                      : "—"}
                  </TableCell>
                  <TableCell className={cn("text-xs", catalogTableBodyCellClass)}>
                    {r.corte_desperdicio_sustrato
                      ? String(r.corte_desperdicio_sustrato).toUpperCase()
                      : "AUTO"}
                  </TableCell>
                  {!hideTransparentKgCols ? (
                    <>
                      <TableCell
                        className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}
                      >
                        {cellStr(r.imp_scrap_transparente_kg)}
                      </TableCell>
                      <TableCell
                        className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}
                      >
                        {cellStr(r.imp_scrap_impreso_kg)}
                      </TableCell>
                      <TableCell
                        className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}
                      >
                        {cellStr(r.lam_scrap_transparente_kg)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell
                      className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}
                    >
                      {cellStr(r.imp_scrap_impreso_kg)}
                    </TableCell>
                  )}
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.lam_scrap_impreso_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.lam_scrap_laminado_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.cor_scrap_refile_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.cor_scrap_impreso_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.cor_scrap_mal_corte_kg)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.printing_scrap_percent)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.laminacion_scrap_percent)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.corte_scrap_percent)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {cellStr(r.montaje_scrap_percent)}
                  </TableCell>
                  <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge variant="outline" className={workOrderStatusBadgeClass(st)}>
                        {workOrderStatusLabel(st)}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-primary/25"
                        onClick={() =>
                          void openDesperdicioPreview({
                            focus_work_order_id: woId,
                          })
                        }
                      >
                        Abrir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
        {totals && rows.length > 0 ? (
          <TableFooter>
            <TableRow className="border-t-2 border-primary/20 bg-muted/40 font-medium">
              <TableCell
                colSpan={5}
                className={cn("text-muted-foreground text-xs", catalogTableBodyCellClass)}
              >
                Acumulado período (suma kg)
              </TableCell>
              {!hideTransparentKgCols ? (
                <>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {totals.imp_scrap_transparente_kg.toFixed(3)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {totals.imp_scrap_impreso_kg.toFixed(3)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                    {totals.lam_scrap_transparente_kg.toFixed(3)}
                  </TableCell>
                </>
              ) : (
                <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                  {totals.imp_scrap_impreso_kg.toFixed(3)}
                </TableCell>
              )}
              <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                {totals.lam_scrap_impreso_kg.toFixed(3)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                {totals.lam_scrap_laminado_kg.toFixed(3)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                {totals.cor_scrap_refile_kg.toFixed(3)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                {totals.cor_scrap_impreso_kg.toFixed(3)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums text-xs", catalogTableBodyCellClass)}>
                {totals.cor_scrap_mal_corte_kg.toFixed(3)}
              </TableCell>
              <TableCell
                colSpan={4}
                className={cn("text-muted-foreground text-center text-xs", catalogTableBodyCellClass)}
              >
                Porcentajes por OT (no acumulables)
              </TableCell>
              <TableCell className={catalogTableBodyCellClass} />
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    )

    return (
      <TooltipProvider delayDuration={150}>
        <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">{tableInner}</div>
      </TooltipProvider>
    )
  }

  function renderAreaAggregateTable(rows: Record<string, unknown>[]) {
    return (
      <div className="bg-card overflow-x-auto rounded-2xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className={catalogTableHeaderRowClass}>
              <CatalogTableHead icon={ListOrdered} className="w-14">
                N.º
              </CatalogTableHead>
              <CatalogTableHead icon={Columns3}>Área</CatalogTableHead>
              <CatalogTableHead icon={CircleDot}>OTs con kg</CatalogTableHead>
              <CatalogTableHead icon={Activity}>Total kg</CatalogTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  Sin registros de desperdicio en este período.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => (
                <TableRow
                  key={String(r.area ?? idx)}
                  className={catalogTableBodyRowClass}
                >
                  <TableCell
                    className={cn(
                      "tabular-nums text-muted-foreground",
                      catalogTableBodyCellClass,
                    )}
                  >
                    {idx + 1}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {scrapAreaLabel(String(r.area ?? "—"))}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {String(r.row_count ?? "—")}
                  </TableCell>
                  <TableCell className={cn("font-medium tabular-nums", catalogTableBodyCellClass)}>
                    {cellStr(r.total_scrap_kg)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  function renderTableForPayload() {
    const expected = scrapTabQuery[activeTab]
    const stale =
      payload != null &&
      (payload.layout !== expected.layout ||
        payload.substrate_group !== expected.substrate_group)

    if (listLoading || stale) {
      return (
        <div className="bg-card text-muted-foreground rounded-2xl border p-6 text-sm shadow-sm">
          Cargando…
        </div>
      )
    }

    if (!payload) {
      return (
        <div className="bg-card text-muted-foreground rounded-2xl border p-6 text-sm shadow-sm">
          Sin datos.
        </div>
      )
    }

    const { layout, rows } = payload
    if (layout === "by_area") return renderAreaAggregateTable(rows)
    if (layout === "by_work_order") return renderPivotTable(rows)
    if (layout === "history_kg") return renderHistoryKgTable(rows)
    return renderDetailTable(rows)
  }

  return (
    <ReportPageShell
      identityKey="desperdicio"
      title="Desperdicio"
      description="Merma en kilogramos por tipo de film (BOPP, Polietileno, Transparente), área u orden de trabajo."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      showRange={false}
    >
      <ScrapReportFilters
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        clientFilter={entity.clientFilter}
        onClientFilterChange={entity.setClientFilter}
        productFilter={entity.productFilter}
        onProductFilterChange={entity.setProductFilter}
        workOrderCode={workOrderCode}
        onWorkOrderCodeChange={setWorkOrderCode}
        clients={entity.clients}
        products={entity.products}
        clientComboOpen={entity.clientComboOpen}
        onClientComboOpenChange={entity.setClientComboOpen}
        productComboOpen={entity.productComboOpen}
        onProductComboOpenChange={entity.setProductComboOpen}
        selectedClientLabel={entity.selectedClientLabel}
        selectedProductLabel={entity.selectedProductLabel}
        listLoading={listLoading}
        theme={getReportIdentity("desperdicio").theme}
      />

      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-500/[0.06] to-transparent p-4 shadow-sm">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Resumen mensual</p>
          <p className="text-muted-foreground text-sm">
            Totales de desperdicio (kg) por mes calendario en el rango seleccionado: impresión, laminación, corte y total.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          disabled={loading}
          onClick={() =>
            void downloadCsv(
              "reports/scrap-monthly-summary",
              "desperdicio-resumen-mensual.csv",
              baseQuery,
            )
          }
        >
          Descargar resumen mensual
        </Button>
      </div>

      <ScrapClassificationHelp groups={substrateGroups} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto min-h-9 w-full flex-wrap justify-start gap-1">
          {substrateGroups.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.label}
            </TabsTrigger>
          ))}
          <TabsTrigger value="por-ot">Por órdenes de trabajo</TabsTrigger>
          <TabsTrigger value="por-areas">Por áreas</TabsTrigger>
        </TabsList>

        {substrateGroups.map((group) => {
          const hideTransparent = group.id !== "transparente"
          return (
            <TabsContent key={group.id} value={group.id} className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Desperdicio en kg de OTs clasificadas como <strong>{group.label}</strong>. Los datos salen de la planilla
                técnica (incluye turnos guardados en Impresión y Laminación); cargue primero los kg en producción y, si hace falta, el sustrato en Corte.
                {hideTransparent ? (
                  <> Los kg de film transparente en impresión/laminación se ven en la pestaña Transparente.</>
                ) : (
                  <> Aquí se listan los kg transparentes registrados en impresión y laminación.</>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="default"
                  disabled={loading}
                  onClick={() =>
                    void downloadCsv(
                      "reports/scrap-by-filters",
                      `desperdicio-historial-kg-${group.id}.csv`,
                      { ...baseQuery, ...buildHistoryKgTabQuery(group.id) },
                    )
                  }
                >
                  Descargar historial kg — {group.label}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() =>
                    void downloadCsv(`reports/scrap-by-filters`, `desperdicio-${group.id}.csv`, {
                      ...baseQuery,
                      substrate_group: group.id,
                      layout: "detail",
                    })
                  }
                >
                  % desperdicio por área
                </Button>
              </div>
              {activeTab === group.id ? renderTableForPayload() : null}
            </TabsContent>
          )
        })}

        <TabsContent value="por-ot" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Total de desperdicio por OT: impreso y transparente en impresión, más laminación y corte desde la planilla.
            El total es la suma de todas las columnas de kg (todos los tipos de film).
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() =>
              void downloadCsv("reports/scrap-by-filters", "desperdicio-por-ot.csv", {
                ...baseQuery,
                substrate_group: "all",
                layout: "by_work_order",
              })
            }
          >
            Descargar desperdicio — por OT
          </Button>
          {activeTab === "por-ot" ? renderTableForPayload() : null}
        </TabsContent>

        <TabsContent value="por-areas" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Suma de kg de desperdicio por área de planta (Impresión, Laminación, Corte) en el período. No separa por tipo
            de film.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() =>
              void downloadCsv(
                "reports/scrap-by-filters",
                "desperdicio-por-area.csv",
                {
                  ...baseQuery,
                  substrate_group: "all",
                  layout: "by_area",
                },
              )
            }
          >
            Descargar desperdicio — por áreas
          </Button>
          {activeTab === "por-areas" ? renderTableForPayload() : null}
        </TabsContent>
      </Tabs>

      <Sheet
        open={docOpen}
        onOpenChange={(open) => {
          setDocOpen(open)
          if (!open) {
            previewAbortRef.current?.abort()
            setDocQuery(null)
            setDocHtml("")
          }
        }}
      >
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-[min(96vw,56rem)]">
          <SheetHeader>
            <SheetTitle>Vista previa — Desperdicio</SheetTitle>
            <SheetDescription>
              Revise el reporte y descargue el PDF con los mismos filtros y registro
              seleccionado.
            </SheetDescription>
          </SheetHeader>
          {docLoading ? (
            <p className="text-muted-foreground text-sm">Generando vista previa…</p>
          ) : docHtml ? (
            <div className="bg-background min-h-0 flex-1 overflow-hidden rounded-xl border p-2">
              <iframe
                title="Vista previa desperdicio"
                srcDoc={docHtml}
                className="h-[70vh] w-full rounded-md border bg-white"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin vista previa.</p>
          )}
          <SheetFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setDocOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={docLoading || !docHtml || !docQuery}
              onClick={() => void downloadFocusedPdf()}
            >
              Descargar PDF
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ReportPageShell>
  )
}
