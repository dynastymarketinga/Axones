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
  TrendingDown,
  TrendingUp,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

import { ReportPageShell, useReportRange } from "./report-shared"

type ScrapTab = "bopp" | "politerlero" | "transparente" | "por-ot" | "por-areas"

type ScrapReportPayload = {
  rows: Record<string, unknown>[]
  substrate_group: string
  layout: string
}

const SCRAP_TAB_QUERY: Record<
  ScrapTab,
  { substrate_group: string; layout: string }
> = {
  bopp: { substrate_group: "bopp", layout: "history_kg" },
  politerlero: { substrate_group: "politerlero", layout: "history_kg" },
  transparente: { substrate_group: "transparente", layout: "history_kg" },
  "por-ot": { substrate_group: "all", layout: "by_work_order" },
  "por-areas": { substrate_group: "all", layout: "by_area" },
}

const PIVOT_AREA_KEYS = ["printing", "corte", "laminacion", "montaje"] as const

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

function pivotTableroLabel(row: Record<string, unknown>): string {
  const parts = PIVOT_AREA_KEYS.filter(
    (a) => row[`${a}_scrap_percent`] != null && row[`${a}_scrap_percent`] !== "",
  ).map((a) => scrapAreaLabel(a))
  return parts.length ? parts.join(", ") : "—"
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

/** En BOPP y polietileno el backend enmascara a cero el kg transparente en impresión y laminación. */
function historyKgHideTransparentColumns(tab: ScrapTab): boolean {
  return tab === "bopp" || tab === "politerlero"
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
  const [clientId, setClientId] = useState("")
  const [productId, setProductId] = useState("")
  const [workOrderOt, setWorkOrderOt] = useState("")
  const [activeTab, setActiveTab] = useState<ScrapTab>("bopp")
  const [listLoading, setListLoading] = useState(false)
  const [payload, setPayload] = useState<ScrapReportPayload | null>(null)

  const clientIdQ = useMemo(() => {
    const t = clientId.trim()
    if (!t) return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }, [clientId])

  const productIdQ = useMemo(() => {
    const t = productId.trim()
    if (!t) return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  }, [productId])

  const workOrderOtQ = useMemo(() => {
    const t = workOrderOt.trim()
    if (!t) return {}
    if (/^\d+$/.test(t)) return { work_order_id: Number(t) }
    return { work_order_code: t }
  }, [workOrderOt])

  const baseQuery = useMemo(
    () => ({
      from,
      to,
      client_id: clientIdQ,
      product_id: productIdQ,
      ...workOrderOtQ,
    }),
    [from, to, clientIdQ, productIdQ, workOrderOtQ],
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
        ...SCRAP_TAB_QUERY[activeTab],
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
    [activeTab, baseQuery],
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
    const q = SCRAP_TAB_QUERY[activeTab]
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
  }, [activeTab, baseQuery])

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
                    <TableCell className={catalogTableBodyCellClass}>
                      {pivotTableroLabel(r)}
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
                  "Kg de desperdicio impreso en impresión (no transparente), según destino BOPP / transparente en planilla.",
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
                Sin órdenes en este intervalo de fechas, o ninguna coincide con el sustrato de esta pestaña.
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
              <CatalogTableHead icon={CircleDot}>Registros</CatalogTableHead>
              <CatalogTableHead icon={Activity}>Promedio %</CatalogTableHead>
              <CatalogTableHead icon={TrendingUp}>Máx.</CatalogTableHead>
              <CatalogTableHead icon={TrendingDown}>Mín.</CatalogTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
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
                  <TableCell className={catalogTableBodyCellClass}>
                    {String(r.avg_scrap_percent ?? "—")}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {String(r.max_scrap_percent ?? "—")}
                  </TableCell>
                  <TableCell className={catalogTableBodyCellClass}>
                    {String(r.min_scrap_percent ?? "—")}
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
    const expected = SCRAP_TAB_QUERY[activeTab]
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
      title="Desperdicio"
      description="Filtre por fechas, orden de trabajo (ID o código) y, si lo necesita, cliente o producto. Exporte en PDF o descargue datos por tipo de sustrato (BOPP, polietileno, transparente) o por vistas agregadas."
      rangeCardTitle="Período del reporte"
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label>Cliente (n.º interno, opcional)</Label>
          <Input
            inputMode="numeric"
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
            placeholder="opcional"
          />
        </div>
        <div className="grid gap-2">
          <Label>Producto (n.º interno, opcional)</Label>
          <Input
            inputMode="numeric"
            value={productId}
            onChange={(ev) => setProductId(ev.target.value)}
            placeholder="opcional"
          />
        </div>
        <div className="grid min-w-[12rem] gap-2">
          <Label>Orden de trabajo (ID o código, opcional)</Label>
          <Input
            value={workOrderOt}
            onChange={(ev) => setWorkOrderOt(ev.target.value)}
            placeholder="ej. 42 o OT-001"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={listLoading}
          onClick={() => void loadPreview()}
        >
          Actualizar listado
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ScrapTab)}
        className="w-full"
      >
        <TabsList className="flex h-auto min-h-9 w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="bopp">BOPP</TabsTrigger>
          <TabsTrigger value="politerlero">Polietileno</TabsTrigger>
          <TabsTrigger value="transparente">Transparente</TabsTrigger>
          <TabsTrigger value="por-ot">Por órdenes de trabajo</TabsTrigger>
          <TabsTrigger value="por-areas">Por áreas</TabsTrigger>
        </TabsList>

        <TabsContent value="bopp" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Kilogramos por orden según la planilla técnica y porcentajes de desperdicio por área. Por defecto entran OT
            con estructura BOPP; si en corte indicaron el sustrato del desperdicio, ese dato prevalece sobre la
            estructura del producto. Aquí no se muestran las columnas de kilos transparentes en impresión ni en
            laminación: véalas en la pestaña <strong>Transparente</strong>. Los valores salen solo de la planilla por
            OT, no del inventario ni del detalle de bobinas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/scrap-by-filters",
                  "desperdicio-historial-kg-bopp.csv",
                  {
                    ...baseQuery,
                    substrate_group: "bopp",
                    layout: "history_kg",
                  },
                )
              }
            >
              Descargar historial kg — BOPP
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv("reports/scrap-by-filters", "desperdicio-bopp.csv", {
                  ...baseQuery,
                  substrate_group: "bopp",
                  layout: "detail",
                })
              }
            >
              % desperdicio por área
            </Button>
          </div>
          {activeTab === "bopp" ? renderTableForPayload() : null}
        </TabsContent>

        <TabsContent value="politerlero" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Igual que BOPP: historial en kilogramos con filtro por polietileno (PE) según estructura del producto y
            mezclas. Si en corte definieron el sustrato del desperdicio, ese valor sustituye a la estructura. No se
            muestran aquí los kilos transparentes en impresión ni laminación; consulte la pestaña{" "}
            <strong>Transparente</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/scrap-by-filters",
                  "desperdicio-historial-kg-polietileno.csv",
                  {
                    ...baseQuery,
                    substrate_group: "politerlero",
                    layout: "history_kg",
                  },
                )
              }
            >
              Descargar historial kg — polietileno
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/scrap-by-filters",
                  "desperdicio-polietileno.csv",
                  {
                    ...baseQuery,
                    substrate_group: "politerlero",
                    layout: "detail",
                  },
                )
              }
            >
              % desperdicio por área
            </Button>
          </div>
          {activeTab === "politerlero" ? renderTableForPayload() : null}
        </TabsContent>

        <TabsContent value="transparente" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Incluye desperdicio transparente en impresión y en laminación, y el impreso que en planilla se envió a
            inventario transparente. Mal corte suma aquí cuando el sustrato global es transparente o corte lo marcó así.
            Esta pestaña muestra las columnas de kilos transparentes en impresión y laminación tal como figuran en la
            planilla técnica de cada OT.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={loading}
              onClick={() =>
                void downloadCsv(
                  "reports/scrap-by-filters",
                  "desperdicio-historial-kg-transparente.csv",
                  {
                    ...baseQuery,
                    substrate_group: "transparente",
                    layout: "history_kg",
                  },
                )
              }
            >
              Descargar historial kg — transparente
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() =>
                void downloadCsv("reports/scrap-by-filters", "desperdicio-transparente.csv", {
                  ...baseQuery,
                  substrate_group: "transparente",
                  layout: "detail",
                })
              }
            >
              % desperdicio por área
            </Button>
          </div>
          {activeTab === "transparente" ? renderTableForPayload() : null}
        </TabsContent>

        <TabsContent value="por-ot" className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Una fila por orden de trabajo con columnas de % desperdicio por área
            (impresión, corte, laminación, montaje).
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
            Resumen por área: cantidad de registros y promedio / máximo / mínimo de
            % desperdicio.
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
