"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  Barcode,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Droplets,
  Factory,
  Layers2,
  ListOrdered,
  Package,
  PauseCircle,
  PlayCircle,
  Scissors,
  Settings2,
  Timer,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogSelectTriggerClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { apiFetch, ApiError } from "@/lib/api"
import {
  BANDEJA_COLLECT_MAX_PAGES,
  collectBandejaWorkOrderIds,
  countUnseenActivasInIds,
  fetchBandejaTotal,
  loadSeenActivasIds,
  mergeIdsIntoSeenActivas,
  type BandejaListFilters,
  type MiAreaApi,
} from "@/lib/axones-area-bandeja"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import {
  PRINTING_CONTROL_SAVED_EVENT,
  printingBandejaCardClass,
  printingBandejaRowAccentClass,
  printingBandejaStatePillClass,
  printingBandejaWorkflowTitle,
  printingMesBandFromWorkOrderRow,
  type PrintingBandejaMes,
  type PrintingBandejaWorkflow,
} from "@/lib/printing-mes-band-status"
import { cn } from "@/lib/utils"

export type AreaKey = "printing" | "laminacion" | "corte" | "tintas"

const SEARCH_DEBOUNCE_MS = 320

const TAB_BY_AREA: Record<AreaKey, string> = {
  printing: "printing",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "printing",
}

const AREA_ICON: Record<AreaKey, LucideIcon> = {
  printing: Factory,
  laminacion: Layers2,
  corte: Scissors,
  tintas: Droplets,
}

function areaRequestStatusLabel(v?: string | null): string {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "pending") return "Pendiente"
  if (key === "done") return "Hecho"
  if (key === "cancelled") return "Cancelado"
  return v?.trim() || "—"
}

function areaRequestBadgeClass(v?: string | null): string {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "done") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-emerald-950 dark:text-emerald-100 border-emerald-500/28 bg-emerald-500/10"
  }
  if (key === "cancelled") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
  }
  return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-amber-950 dark:text-amber-100 border-amber-500/30 bg-amber-500/10"
}

function areaTitle(area: AreaKey): string {
  if (area === "printing") return "Área: Impresión"
  if (area === "laminacion") return "Área: Laminación"
  if (area === "corte") return "Área: Corte"
  return "Área: Tintas"
}

function areaSubtitle(area: AreaKey): string {
  if (area === "printing") {
    return "En curso: use las pestañas inferiores (pendientes, producción, finalizadas). Historial: solicitudes del área cerradas."
  }
  return "En curso: solicitud pendiente y OT en cola o ya en la etapa de este área. Historial: solicitudes cerradas en el área (hechas o canceladas)."
}

function printingBandejaStatusIcon(wf: PrintingBandejaWorkflow) {
  const c = "h-4 w-4 shrink-0"
  if (wf === "iniciado") {
    return (
      <span className="relative inline-flex shrink-0">
        <PlayCircle
          className={cn(c, "text-emerald-600 dark:text-emerald-400")}
          aria-hidden
        />
        <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </span>
    )
  }
  if (wf === "pausado") {
    return <PauseCircle className={cn(c, "text-amber-600 dark:text-amber-400")} aria-hidden />
  }
  if (wf === "finalizado") {
    return <CheckCircle2 className={cn(c, "text-slate-600 dark:text-slate-300")} aria-hidden />
  }
  return <CircleDashed className={cn(c, "text-violet-600 dark:text-violet-400")} aria-hidden />
}

function PrintingMesBandDetailBlock({
  mesBand,
  reqStatus,
}: {
  mesBand: PrintingBandejaMes
  reqStatus: string
}) {
  return (
    <div className="space-y-4">
      <div className={cn(printingBandejaCardClass(mesBand.workflow), "shadow-md")}>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-background/80 to-transparent" />
        <div className="relative flex gap-2.5">
          <div className="pt-0.5">{printingBandejaStatusIcon(mesBand.workflow)}</div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={printingBandejaStatePillClass(mesBand.workflow)}>
                {printingBandejaWorkflowTitle(mesBand.workflow)}
              </span>
            </div>
            <p className="text-foreground/90 text-sm font-semibold leading-snug">{mesBand.contextLine}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{mesBand.hint}</p>
            {mesBand.showTimes ? (
              <div className="space-y-1.5 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
                <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Efectivo acumulado
                  </span>
                  <span className="font-mono text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
                    {mesBand.effectiveHms}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {mesBand.showDeadBreakdown ? (
                    <>
                      Paradas (acum.):{" "}
                      <span className="font-mono text-foreground/90">{mesBand.deadHms}</span>
                      <span className="text-muted-foreground/70"> · </span>
                    </>
                  ) : null}
                  Total (efectivo + paradas):{" "}
                  <span className="font-mono text-foreground/90">{mesBand.totalHms}</span>
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Solicitud de área</span>
        <Badge variant="outline" className={cn(areaRequestBadgeClass(reqStatus), "h-6 px-2 text-xs")}>
          {areaRequestStatusLabel(reqStatus)}
        </Badge>
      </div>
    </div>
  )
}

/** Icono de actividad del temporizador (columna separada de estatus). */
function PrintingBandejaTimerGlyph({ workflow }: { workflow: PrintingBandejaWorkflow }) {
  if (workflow === "iniciado") {
    return (
      <span
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-400/35 ring-offset-2 ring-offset-background dark:shadow-emerald-500/25 dark:ring-emerald-300/30"
        title="Temporizador activo"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" aria-hidden />
        <Timer className="relative z-[1] h-4 w-4" aria-hidden />
      </span>
    )
  }
  if (workflow === "pausado") {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm"
        title="En pausa"
      >
        <PauseCircle className="h-4 w-4" aria-hidden />
      </span>
    )
  }
  if (workflow === "finalizado") {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-500 text-white shadow-sm dark:bg-slate-600"
        title="Área finalizada"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      </span>
    )
  }
  return (
    <span
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-300/70 bg-violet-100/70 text-violet-900 shadow-sm dark:border-violet-500/40 dark:bg-violet-950/45 dark:text-violet-100"
      title="Sin temporizador en marcha"
    >
      <Timer className="h-4 w-4 opacity-85" aria-hidden />
    </span>
  )
}

type AreaBandejaTab = "activas" | "historial"

/** Sub-vistas dentro de «En curso» solo para bandeja de impresión. */
type PrintingActivasSubTab = "pendientes" | "produccion" | "finalizadas"

function printingActivasBucket(
  row: WorkOrderListRow,
  nowMs: number,
): PrintingActivasSubTab {
  const mes = printingMesBandFromWorkOrderRow(row, nowMs)
  if (!mes) return "pendientes"
  if (mes.workflow === "finalizado") return "finalizadas"
  if (mes.workflow === "iniciado" || mes.workflow === "pausado") return "produccion"
  return "pendientes"
}

export default function AreaWorkOrdersPage({ area }: { area: AreaKey }) {
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const [activeTab, setActiveTab] = useState<AreaBandejaTab>("activas")
  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(
    null,
  )
  const [movingId, setMovingId] = useState<number | null>(null)
  const [totalActivas, setTotalActivas] = useState(0)
  const [unseenActivas, setUnseenActivas] = useState(0)

  const [status, setStatus] = useState<string>("all")
  const [priority, setPriority] = useState<string>("all")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const [areaRequestedFrom, setAreaRequestedFrom] = useState("")
  const [areaRequestedTo, setAreaRequestedTo] = useState("")
  const skipSearchPageReset = useRef(true)
  /** Reloj en vivo para tiempo efectivo acumulado (bandeja impresión). */
  const [mesBandNowMs, setMesBandNowMs] = useState(() => Date.now())
  /** Modal de detalle MES (impresión): id de OT abierta o null. */
  const [printingMesModalId, setPrintingMesModalId] = useState<number | null>(null)
  /** Filtro de bandeja impresión dentro de «En curso». */
  const [printingActivasSubTab, setPrintingActivasSubTab] =
    useState<PrintingActivasSubTab>("pendientes")

  const queryStatus = status !== "all" ? status : undefined
  const queryPriority = priority !== "all" ? priority : undefined

  const miAreaApi = useMemo((): MiAreaApi => {
    if (area === "printing") return "impresion"
    if (area === "laminacion") return "laminacion"
    if (area === "corte") return "corte"
    return "tintas"
  }, [area])

  const bandejaListFilters = useMemo((): BandejaListFilters => {
    return {
      status: queryStatus,
      priority: queryPriority,
      q: search || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
      area_requested_from: areaRequestedFrom || undefined,
      area_requested_to: areaRequestedTo || undefined,
    }
  }, [
    queryStatus,
    queryPriority,
    search,
    createdFrom,
    createdTo,
    areaRequestedFrom,
    areaRequestedTo,
  ])

  const refreshBandejaMeta = useCallback(async () => {
    const base = bandejaListFilters
    const uid = session?.id
    try {
      const [activas, ids] = await Promise.all([
        fetchBandejaTotal(miAreaApi, "active", base),
        collectBandejaWorkOrderIds(
          miAreaApi,
          "active",
          base,
          BANDEJA_COLLECT_MAX_PAGES,
        ),
      ])
      setTotalActivas(activas)
      const seen = loadSeenActivasIds(uid, miAreaApi)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* silencioso: el listado principal ya muestra toast en error */
    }
  }, [bandejaListFilters, miAreaApi, session?.id])

  const markActivasBandejaSeen = useCallback(async () => {
    const uid = session?.id
    try {
      const ids = await collectBandejaWorkOrderIds(
        miAreaApi,
        "active",
        bandejaListFilters,
        BANDEJA_COLLECT_MAX_PAGES,
      )
      mergeIdsIntoSeenActivas(uid, miAreaApi, ids)
      const seen = loadSeenActivasIds(uid, miAreaApi)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* ignore */
    }
  }, [bandejaListFilters, miAreaApi, session?.id])

  useEffect(() => {
    void refreshBandejaMeta()
  }, [refreshBandejaMeta])

  useEffect(() => {
    const fn = () => {
      if (document.visibilityState === "visible") void refreshBandejaMeta()
    }
    document.addEventListener("visibilitychange", fn)
    return () => document.removeEventListener("visibilitychange", fn)
  }, [refreshBandejaMeta])

  useEffect(() => {
    if (activeTab !== "activas" || loading || rows === null) return
    void markActivasBandejaSeen()
  }, [activeTab, loading, rows, markActivasBandejaSeen])

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(qInput.trim())
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [qInput])

  useEffect(() => {
    if (skipSearchPageReset.current) {
      skipSearchPageReset.current = false
      return
    }
    setPage(1)
  }, [search])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      try {
        let query: Record<string, string | number | undefined>
        if (activeTab === "historial") {
          query = {
            page,
            per_page: 20,
            historial_area: miAreaApi,
            historial_exclude_pending: 1,
            q: search || undefined,
          }
        } else {
          query = {
            page,
            per_page: 20,
            status: queryStatus,
            priority: queryPriority,
            q: search || undefined,
            created_from: createdFrom || undefined,
            created_to: createdTo || undefined,
            area_requested_from: areaRequestedFrom || undefined,
            area_requested_to: areaRequestedTo || undefined,
            mi_area: miAreaApi,
            area_process_tag: "active",
          }
        }

        const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>(
          "work-orders",
          { query },
        )
        setRows(data)
      } catch (e) {
        if (!silent) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudieron cargar las órdenes.")
          setRows(null)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [
      activeTab,
      miAreaApi,
      page,
      queryPriority,
      queryStatus,
      search,
      createdFrom,
      createdTo,
      areaRequestedFrom,
      areaRequestedTo,
    ],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (area !== "printing" || activeTab !== "activas") return
    const id = window.setInterval(() => setMesBandNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [area, activeTab])

  useEffect(() => {
    if (area !== "printing" || activeTab !== "activas") return
    const id = window.setInterval(() => {
      void load({ silent: true })
    }, 8000)
    return () => window.clearInterval(id)
  }, [area, activeTab, load])

  useEffect(() => {
    if (area !== "printing") return
    const fn = () => {
      void load({ silent: true })
      void refreshBandejaMeta()
    }
    window.addEventListener(PRINTING_CONTROL_SAVED_EVENT, fn)
    return () => window.removeEventListener(PRINTING_CONTROL_SAVED_EVENT, fn)
  }, [area, load, refreshBandejaMeta])

  const printingMesModalRow = useMemo((): WorkOrderListRow | null => {
    if (printingMesModalId === null || !rows?.data.length) return null
    return rows.data.find((r) => r.id === printingMesModalId) ?? null
  }, [printingMesModalId, rows])

  const printingMesModalBand = useMemo(() => {
    if (!printingMesModalRow || area !== "printing") return null
    return printingMesBandFromWorkOrderRow(printingMesModalRow, mesBandNowMs)
  }, [printingMesModalRow, area, mesBandNowMs])

  const printingMesModalReqStatus = useMemo(() => {
    if (!printingMesModalRow) return "pending"
    return (
      (printingMesModalRow.areaRequests && printingMesModalRow.areaRequests.length
        ? printingMesModalRow.areaRequests[0]?.status
        : null) ?? "pending"
    )
  }, [printingMesModalRow])

  const displayActivasRows = useMemo((): WorkOrderListRow[] => {
    if (!rows?.data.length) return []
    if (area !== "printing") return rows.data
    return rows.data.filter((o) => printingActivasBucket(o, mesBandNowMs) === printingActivasSubTab)
  }, [rows, area, mesBandNowMs, printingActivasSubTab])

  const printingActivasBucketCounts = useMemo(() => {
    if (area !== "printing" || !rows?.data.length) return null
    let pendientes = 0
    let produccion = 0
    let finalizadas = 0
    for (const o of rows.data) {
      const b = printingActivasBucket(o, mesBandNowMs)
      if (b === "pendientes") pendientes++
      else if (b === "produccion") produccion++
      else finalizadas++
    }
    return { pendientes, produccion, finalizadas }
  }, [area, rows, mesBandNowMs])

  /** Si la sub-pestaña actual no tiene filas en esta página, usar la primera que sí tenga. */
  useEffect(() => {
    if (area !== "printing" || activeTab !== "activas" || !rows?.data.length) return
    const buckets = rows.data.map((o) => printingActivasBucket(o, mesBandNowMs))
    const count = (b: PrintingActivasSubTab) => buckets.filter((x) => x === b).length
    setPrintingActivasSubTab((prev) => {
      if (count(prev) > 0) return prev
      if (count("pendientes") > 0) return "pendientes"
      if (count("produccion") > 0) return "produccion"
      if (count("finalizadas") > 0) return "finalizadas"
      return prev
    })
  }, [area, activeTab, rows, mesBandNowMs])

  useEffect(() => {
    if (activeTab !== "activas") {
      setPrintingActivasSubTab("pendientes")
    }
  }, [activeTab])

  useEffect(() => {
    if (area !== "printing") {
      setPrintingActivasSubTab("pendientes")
    }
  }, [area])

  useEffect(() => {
    if (printingMesModalId === null) return
    if (area !== "printing" || activeTab !== "activas") return
    void load({ silent: true })
  }, [printingMesModalId, area, activeTab, load])

  useEffect(() => {
    if (area !== "printing") setPrintingMesModalId(null)
  }, [area])

  useEffect(() => {
    if (activeTab !== "activas") setPrintingMesModalId(null)
  }, [activeTab])

  useEffect(() => {
    if (printingMesModalId === null || !rows?.data) return
    if (!rows.data.some((r) => r.id === printingMesModalId)) {
      setPrintingMesModalId(null)
    }
  }, [rows, printingMesModalId])

  const stageLabel: Record<string, string> = {
    nueva: "Pendiente por OT",
    pendiente: "Programación",
    montaje: "Montaje",
    impresion: "Impresión",
    laminacion: "Laminación",
    corte: "Corte",
    completada: "Completada",
  }
  const stageOrder: Record<string, number> = {
    nueva: 0,
    pendiente: 1,
    montaje: 2,
    impresion: 3,
    laminacion: 4,
    corte: 5,
    completada: 6,
  }
  const areaStageForProgress: Record<AreaKey, string> = {
    printing: "impresion",
    laminacion: "laminacion",
    corte: "corte",
    tintas: "impresion",
  }

  function processStateForArea(bs?: string | null): string {
    if (!bs) return "Sin etapa"
    const current = stageOrder[bs] ?? -1
    const areaStage = stageOrder[areaStageForProgress[area]] ?? -1
    if (current > areaStage) return "Hecho en área"
    if (current === areaStage) return "En proceso"
    return "Antes de esta etapa"
  }

  function openUrl(woId: number): string {
    if (area === "printing") {
      return `/ordenes-trabajo/${woId}/produccion?tab=printing`
    }
    if (area === "laminacion") {
      return `/ordenes-trabajo/${woId}/produccion?tab=laminacion`
    }
    const tab = TAB_BY_AREA[area]
    return `/ordenes-trabajo/${woId}?tab=${encodeURIComponent(tab)}`
  }

  const nextStageByArea: Record<AreaKey, string | null> = {
    printing: null,
    laminacion: "corte",
    // En Corte no exponemos botón "Pasar a Completada" desde la bandeja del área.
    // El cierre/completado se maneja por despacho/nota de entrega u otro flujo.
    corte: null,
    tintas: null,
  }

  const stageByArea: Record<AreaKey, string> = {
    printing: "impresion",
    laminacion: "laminacion",
    corte: "corte",
    tintas: "impresion",
  }

  const isBoss =
    role === "boss" ||
    role === "admin" ||
    role === "jefe_supremo" ||
    role === "superadmin"

  function canMoveFromHere(bs?: string | null): boolean {
    if (!bs) return false
    const here = stageByArea[area]
    if (bs !== here) return false

    if (area === "printing") return isBoss || role === "printing" || role === "impresion"
    if (area === "laminacion") return isBoss || role === "laminacion"
    if (area === "corte") return isBoss || role === "corte"
    return false
  }

  async function moveToNextStage(woId: number) {
    const target = nextStageByArea[area]
    if (!target) return
    setMovingId(woId)
    try {
      await apiFetch(`work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: target }),
      })
      toast.success(`OT movida a ${stageLabel[target] ?? target}.`)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la OT.")
    } finally {
      setMovingId(null)
    }
  }

  const AreaIcon = AREA_ICON[area]
  const activasTableColSpan = area === "printing" ? 7 : 6

  const filterHint = (
    <p className="text-muted-foreground text-xs lg:col-span-12">
      La búsqueda filtra por código de OT, referencia de pedido o nombre de cliente al escribir.
    </p>
  )

  const historialFilterHint = (
    <p className="text-muted-foreground text-xs lg:col-span-12">
      Busque por cliente, producto, código de OT o referencia de pedido al escribir.
    </p>
  )

  const pagination =
    rows && rows.last_page > 1 ? (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Página {rows.current_page} de {rows.last_page} · {rows.total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.current_page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.current_page >= rows.last_page || loading}
            onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      </div>
    ) : null

  const printingSubTabHint = useMemo(() => {
    if (area !== "printing") return ""
    if (printingActivasSubTab === "pendientes") {
      return "Cola u obra en impresión sin temporizador en marcha. Abra la OT para iniciar turno."
    }
    if (printingActivasSubTab === "produccion") {
      return "Temporizador activo o en pausa. El desglose completo está en el modal (clic en la fila)."
    }
    return "Área de impresión finalizada para estas OT. Use Historial para solicitudes cerradas del área."
  }, [area, printingActivasSubTab])

  return (
    <CatalogPageShell
      title={areaTitle(area)}
      subtitle={areaSubtitle(area)}
      icon={AreaIcon}
    >
      <>
        <Dialog
          open={printingMesModalId !== null}
          onOpenChange={(open) => {
            if (!open) setPrintingMesModalId(null)
          }}
        >
          <DialogContent className="max-h-[min(88vh,680px)] gap-0 overflow-y-auto sm:max-w-lg">
            <DialogHeader className="space-y-2 pb-2 pr-8">
              <DialogTitle>
                Impresión — {printingMesModalRow?.code ?? (printingMesModalId ? `OT #${printingMesModalId}` : "—")}
              </DialogTitle>
              <DialogDescription>
                Tiempos según el último guardado en el servidor. La bandeja se sincroniza al guardar en la OT o cada
                pocos segundos con esta vista abierta.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {printingMesModalBand ? (
                <PrintingMesBandDetailBlock
                  mesBand={printingMesModalBand}
                  reqStatus={printingMesModalReqStatus}
                />
              ) : printingMesModalId !== null ? (
                <p className="text-muted-foreground text-sm">
                  Esta OT no está en la página actual del listado. Cierre el cuadro o navegue en el listado hasta
                  encontrarla.
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              {printingMesModalId !== null ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link to={openUrl(printingMesModalId)} onClick={() => setPrintingMesModalId(null)}>
                    Abrir OT
                  </Link>
                </Button>
              ) : null}
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="w-full sm:w-auto">
                  Cerrar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as AreaBandejaTab)
          if (v === "historial") {
            setStatus("all")
          }
          setPage(1)
        }}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="activas" className="inline-flex max-w-full flex-wrap items-center gap-1.5">
            <span>En curso</span>
            <span className="text-muted-foreground font-normal tabular-nums">({totalActivas})</span>
            {unseenActivas > 0 ? (
              <Badge
                variant="destructive"
                className="h-5 min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold leading-none"
              >
                {unseenActivas}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="mt-4 space-y-4">
          {area === "printing" ? (
            <Tabs
              value={printingActivasSubTab}
              onValueChange={(v) => {
                setPrintingActivasSubTab(v as PrintingActivasSubTab)
                setPrintingMesModalId(null)
              }}
              className="space-y-3"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg bg-muted/70 p-1">
                <TabsTrigger value="pendientes" className="gap-1.5 text-xs sm:text-sm">
                  <span>Pendientes</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.pendientes ?? 0})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="produccion" className="gap-1.5 text-xs sm:text-sm">
                  <span>En producción</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.produccion ?? 0})
                  </span>
                </TabsTrigger>
                <TabsTrigger value="finalizadas" className="gap-1.5 text-xs sm:text-sm">
                  <span>Finalizadas</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.finalizadas ?? 0})
                  </span>
                </TabsTrigger>
              </TabsList>
              <p className="text-muted-foreground text-xs sm:text-sm">{printingSubTabHint}</p>
            </Tabs>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {area === "printing" ? (
              <p className="text-muted-foreground text-xs sm:text-sm">
                Página actual: {displayActivasRows.length} en «
                {printingActivasSubTab === "pendientes"
                  ? "Pendientes"
                  : printingActivasSubTab === "produccion"
                    ? "En producción"
                    : "Finalizadas"}
                » · Total bandeja: {totalActivas}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de este área.
              </p>
            )}
            <Badge variant="outline" className={areaRequestBadgeClass("pending")}>
              {area === "printing"
                ? `Vista: ${displayActivasRows.length} · Bandeja: ${totalActivas}`
                : `En curso: ${totalActivas}`}
            </Badge>
          </div>
          <CatalogFilterGrid>
            <CatalogSearchField
              id={`a-q-act-${area}`}
              label="Ref. pedido cliente"
              placeholder="Código OT, referencia, cliente…"
              value={qInput}
              onChange={(ev) => setQInput(ev.target.value)}
              className="min-w-0 lg:col-span-6"
            />
            <CatalogLabeledField label="Prioridad" className="lg:col-span-3">
              <Select
                value={priority}
                onValueChange={(v) => {
                  setPriority(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogLabeledField label="Estado" className="lg:col-span-3">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogLabeledField label="Fecha OT (desde)" className="lg:col-span-3">
              <Input
                type="date"
                value={createdFrom}
                onChange={(ev) => {
                  setCreatedFrom(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Fecha OT (hasta)" className="lg:col-span-3">
              <Input
                type="date"
                value={createdTo}
                onChange={(ev) => {
                  setCreatedTo(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Solicitud área (desde)" className="lg:col-span-3">
              <Input
                type="date"
                value={areaRequestedFrom}
                onChange={(ev) => {
                  setAreaRequestedFrom(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Solicitud área (hasta)" className="lg:col-span-3">
              <Input
                type="date"
                value={areaRequestedTo}
                onChange={(ev) => {
                  setAreaRequestedTo(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            {filterHint}
          </CatalogFilterGrid>

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
                  {area === "printing" ? (
                    <CatalogTableHead icon={Timer} className="w-[9.5rem] whitespace-nowrap">
                      Tiempo efectivo
                    </CatalogTableHead>
                  ) : null}
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={activasTableColSpan} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={activasTableColSpan} className="text-muted-foreground">
                      Sin órdenes en curso para esta área.
                    </TableCell>
                  </TableRow>
                ) : area === "printing" && displayActivasRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activasTableColSpan} className="text-muted-foreground">
                      Sin OT en esta vista en esta página. Pruebe otra pestaña o otra página.
                    </TableCell>
                  </TableRow>
                ) : (
                  (area === "printing" ? displayActivasRows : rows.data).map((o, idx) => {
                    const pageIdx = area === "printing" ? rows.data.indexOf(o) : idx
                    const n = (rows.current_page - 1) * rows.per_page + pageIdx + 1
                    const reqStatus =
                      (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ??
                      "pending"
                    const mesBand =
                      area === "printing" ? printingMesBandFromWorkOrderRow(o, mesBandNowMs) : null
                    const rowAccent =
                      mesBand && area === "printing" ? printingBandejaRowAccentClass(mesBand.workflow) : ""
                    return (
                      <TableRow key={o.id} className={cn(catalogTableBodyRowClass, rowAccent)}>
                        <TableCell
                          className={cn(
                            "tabular-nums text-muted-foreground",
                            catalogTableBodyCellClass,
                          )}
                        >
                          {n}
                        </TableCell>
                        <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                          {o.code}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {o.client?.name ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {o.product?.name ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {area === "printing" && mesBand ? (
                            <div className="flex max-w-[12rem] flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPrintingMesModalId(o.id)}
                                className={cn(
                                  "group/mes rounded-lg border border-transparent bg-transparent p-1.5 text-left transition-colors",
                                  "hover:border-primary/35 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                )}
                              >
                                <span className={printingBandejaStatePillClass(mesBand.workflow)}>
                                  {printingBandejaWorkflowTitle(mesBand.workflow)}
                                </span>
                                <p className="text-primary/85 pt-1 text-[10px] font-medium leading-tight group-hover/mes:underline">
                                  Ver tiempos y detalle
                                </p>
                              </button>
                              <div className="flex flex-wrap items-center gap-1.5 px-0.5 text-[10px] text-muted-foreground">
                                <span>Solicitud</span>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    areaRequestBadgeClass(reqStatus),
                                    "h-5 px-1.5 py-0 text-[10px] leading-none",
                                  )}
                                >
                                  {areaRequestStatusLabel(reqStatus)}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className={areaRequestBadgeClass(reqStatus)}>
                              {areaRequestStatusLabel(reqStatus)}
                            </Badge>
                          )}
                        </TableCell>
                        {area === "printing" ? (
                          <TableCell className={cn(catalogTableBodyCellClass, "w-[9.5rem]")}>
                            {mesBand ? (
                              <button
                                type="button"
                                onClick={() => setPrintingMesModalId(o.id)}
                                className={cn(
                                  "flex w-full min-w-0 items-center gap-2 rounded-lg border border-transparent py-1 text-left transition-colors",
                                  "hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                )}
                                title="Ver detalle de tiempos"
                              >
                                <PrintingBandejaTimerGlyph workflow={mesBand.workflow} />
                                <span
                                  className={cn(
                                    "min-w-0 truncate font-mono text-sm font-semibold tabular-nums tracking-tight",
                                    mesBand.workflow === "iniciado" && "text-emerald-800 dark:text-emerald-100",
                                    mesBand.workflow === "pausado" && "text-amber-900 dark:text-amber-100",
                                    mesBand.workflow === "finalizado" && "text-muted-foreground",
                                    mesBand.workflow === "sin_iniciar" && "text-foreground/80",
                                  )}
                                >
                                  {mesBand.showTimes ? mesBand.effectiveHms : "—"}
                                </span>
                              </button>
                            ) : (
                              <span className="text-muted-foreground tabular-nums">—</span>
                            )}
                          </TableCell>
                        ) : null}
                        <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-primary/25" asChild>
                              <Link to={openUrl(o.id)}>Abrir</Link>
                            </Button>
                            {canMoveFromHere(o.board_stage) && nextStageByArea[area] ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={movingId === o.id}
                                onClick={() => void moveToNextStage(o.id)}
                              >
                                {movingId === o.id
                                  ? "…"
                                  : `Pasar a ${stageLabel[nextStageByArea[area]!]}`}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {pagination}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Archivo de solicitudes cerradas en el área (hechas o canceladas). Busque por cliente o producto entre
              el historial.
            </p>
            <Badge
              variant="outline"
              className="gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
            >
              En listado: {rows?.total ?? 0}
            </Badge>
          </div>

          <CatalogFilterGrid>
            <CatalogSearchField
              id={`a-q2-${area}`}
              label="Cliente, producto u OT"
              placeholder="Cliente, producto, código OT o referencia…"
              value={qInput}
              onChange={(ev) => setQInput(ev.target.value)}
              className="min-w-0 lg:col-span-12"
            />
            {historialFilterHint}
          </CatalogFilterGrid>

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
                  <CatalogTableHead icon={Activity}>Fecha OT</CatalogTableHead>
                  <CatalogTableHead icon={Activity}>Fecha solicitud</CatalogTableHead>
                  <CatalogTableHead icon={Activity}>Proceso en área</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Estatus</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-muted-foreground">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o, idx) => {
                    const n = (rows.current_page - 1) * rows.per_page + idx + 1
                    const reqStatus =
                      (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ??
                      null
                    const reqCreatedAt =
                      o.areaRequests && o.areaRequests.length
                        ? (o.areaRequests[0]?.created_at ?? null)
                        : null
                    return (
                      <TableRow key={o.id} className={catalogTableBodyRowClass}>
                        <TableCell
                          className={cn(
                            "tabular-nums text-muted-foreground",
                            catalogTableBodyCellClass,
                          )}
                        >
                          {n}
                        </TableCell>
                        <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>
                          {o.code}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {o.client?.name ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {o.product?.name ?? "—"}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <span className="text-sm text-muted-foreground">
                            {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                          </span>
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <span className="text-sm text-muted-foreground">
                            {reqCreatedAt ? new Date(reqCreatedAt).toLocaleDateString() : "—"}
                          </span>
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {processStateForArea(o.board_stage)}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          <Badge variant="outline" className={areaRequestBadgeClass(reqStatus)}>
                            {areaRequestStatusLabel(reqStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-primary/25" asChild>
                              <Link to={openUrl(o.id)}>Abrir</Link>
                            </Button>
                            {canMoveFromHere(o.board_stage) && nextStageByArea[area] ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={movingId === o.id}
                                onClick={() => void moveToNextStage(o.id)}
                              >
                                {movingId === o.id
                                  ? "…"
                                  : `Pasar a ${stageLabel[nextStageByArea[area]!]}`}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {pagination}
        </TabsContent>
      </Tabs>
      </>
    </CatalogPageShell>
  )
}
