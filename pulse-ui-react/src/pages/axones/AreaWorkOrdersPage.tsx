"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlarmClock,
  ArrowRight,
  ArrowUp,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDashed,
  ClipboardList,
  Droplets,
  ExternalLink,
  History,
  Inbox,
  Info,
  Layers2,
  List,
  ListFilter,
  ListOrdered,
  Minus,
  PauseCircle,
  PlayCircle,
  Printer,
  Rows3,
  Scissors,
  Search,
  SlidersHorizontal,
  Timer,
  XCircle,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  INSUMOS_BANDEJA_TABLE_COLSPAN,
  InsumosBandejaTableCard,
  insumosBandejaDataRowClassName,
  insumosBandejaIdLinkClassName,
} from "@/components/axones/InsumosBandejaTable"
import { catalogFilterDateInputClass, catalogFilterPanelClass, catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  formatHmsFromSeconds,
  printingBandejaCardClass,
  printingBandejaRowAccentClass,
  printingBandejaStatePillClass,
  printingBandejaWorkflowTitle,
  printingMesBandFromWorkOrderRow,
  type PrintingBandejaMes,
  type PrintingBandejaWorkflow,
} from "@/lib/printing-mes-band-status"
import {
  areaRequestBadgeClass,
  areaRequestStatusGlyph,
  areaRequestStatusLabel,
} from "@/lib/axones-area-request-display"
import { cn } from "@/lib/utils"
import {
  IMP_ACTUAL_KEY,
  IMP_TURNOS_KEY,
  parsePrintingTurnoActual,
  parsePrintingTurnos,
  sumSalidaKg,
  sumScrapKg,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"

export type AreaKey = "printing" | "laminacion" | "corte" | "tintas"

const SEARCH_DEBOUNCE_MS = 320

const TAB_BY_AREA: Record<AreaKey, string> = {
  printing: "printing",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "printing",
}

const AREA_ICON: Record<AreaKey, LucideIcon> = {
  printing: Printer,
  laminacion: Layers2,
  corte: Scissors,
  tintas: Droplets,
}

function printingWorkflowPillGlyph(wf: PrintingBandejaWorkflow) {
  const c = "h-3 w-3 shrink-0"
  if (wf === "iniciado") {
    return <PlayCircle className={cn(c, "text-emerald-600 dark:text-emerald-400")} aria-hidden />
  }
  if (wf === "pausado") {
    return <PauseCircle className={cn(c, "text-amber-600 dark:text-amber-400")} aria-hidden />
  }
  if (wf === "finalizado") {
    return <CheckCircle2 className={cn(c, "text-slate-600 dark:text-slate-300")} aria-hidden />
  }
  return <CircleDashed className={cn(c, "text-violet-600 dark:text-violet-400")} aria-hidden />
}

function areaTitle(area: AreaKey): string {
  if (area === "printing") return "Área: Impresión"
  if (area === "laminacion") return "Área: Laminación"
  if (area === "corte") return "Área: Corte"
  return "Área: Tintas"
}

function areaSubtitle(area: AreaKey): string {
  if (area === "printing") {
    return "Bandeja de OT activas. Las vistas filtran por temporizador de impresión. Historial: solicitudes del área ya cerradas."
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
        <Badge variant="outline" className={cn(areaRequestBadgeClass(reqStatus), "inline-flex h-6 items-center gap-1 px-2 text-xs")}>
          {areaRequestStatusGlyph(reqStatus)}
          {areaRequestStatusLabel(reqStatus)}
        </Badge>
      </div>
    </div>
  )
}

function printingFormRecord(row: WorkOrderListRow): Record<string, unknown> | null {
  const f = row.technical_document?.form
  return f && typeof f === "object" && !Array.isArray(f) ? (f as Record<string, unknown>) : null
}

function printingPersonnelLinesFromTurno(t: PrintingTurnoEntry): string[] {
  const lines: string[] = []
  const op = t.operador.trim()
  if (op) lines.push(`${op} — Operador`)
  t.ayudante
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((n) => lines.push(`${n} — Ayudante`))
  const sup = t.supervisor.trim()
  if (sup) lines.push(`${sup} — Supervisor`)
  return lines
}

function turnoGrupoFromTurno(t: PrintingTurnoEntry): string {
  const p: string[] = []
  if (t.turno === "diurno") p.push("Diurno")
  else if (t.turno === "nocturno") p.push("Nocturno")
  else if (String(t.turno ?? "").trim()) p.push(String(t.turno).trim())
  if (t.grupo === "A" || t.grupo === "B" || t.grupo === "C") p.push(`Grupo ${t.grupo}`)
  else if (String(t.grupo ?? "").trim()) p.push(String(t.grupo).trim())
  return p.join(" · ") || "—"
}

function printingTimerStateEs(st: string): string {
  if (st === "running") return "En marcha"
  if (st === "paused") return "En pausa"
  if (st === "pending") return "Pendiente"
  if (st === "stopped") return "Turno cerrado"
  if (st === "completed") return "Completado"
  return st
}

function PrintingMesModalTurnosSection({ row }: { row: WorkOrderListRow }) {
  const form = printingFormRecord(row)
  const cerrados = form ? parsePrintingTurnos(form[IMP_TURNOS_KEY]) : []
  const actual = form ? parsePrintingTurnoActual(form[IMP_ACTUAL_KEY]) : null

  if (cerrados.length === 0 && !actual) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-muted/15 p-3 text-xs text-muted-foreground">
        Sin turnos de impresión guardados en la OT. Los datos aparecen al iniciar turno y guardar en Producción →
        Impresión.
      </div>
    )
  }

  const totalReg = cerrados.length + (actual ? 1 : 0)

  return (
    <div className="space-y-3 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Turnos acumulativos · {totalReg} registro(s)
        </p>
      </div>
      <ul className="max-h-[min(42vh,18rem)] space-y-2.5 overflow-y-auto pr-1">
        {cerrados.map((t) => {
          const people = printingPersonnelLinesFromTurno(t)
          return (
            <li key={t.id} className="rounded-md border bg-muted/5 p-2.5 text-xs">
              <p className="font-medium text-foreground">
                {t.closed_at
                  ? new Date(t.closed_at).toLocaleString("es-VE")
                  : "Sin fecha de cierre"}{" "}
                · {turnoGrupoFromTurno(t)}
              </p>
              <p className="text-muted-foreground mt-1">
                Salida {sumSalidaKg(t).toFixed(2)} Kg · Scrap {sumScrapKg(t).toFixed(2)} Kg · Efectivo{" "}
                {formatHmsFromSeconds(t.timer.effectiveAccSec)} · Muerto{" "}
                {formatHmsFromSeconds(t.timer.deadAccSec)}
              </p>
              <p className="mt-1.5 font-medium text-foreground/90">Personal</p>
              {people.length === 0 ? (
                <p className="text-muted-foreground">Sin personal registrado.</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {people.map((line, i) => (
                    <li key={`${t.id}-p-${i}`}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
        {actual ? (
          <li className="rounded-md border border-violet-300/40 bg-violet-500/6 p-2.5 text-xs">
            <p className="font-medium text-foreground">Turno en curso · {turnoGrupoFromTurno(actual)}</p>
            <p className="text-muted-foreground mt-1">
              Temporizador: {printingTimerStateEs(String(actual.timer.state))}
            </p>
            <p className="text-muted-foreground mt-1">
              Efectivo {formatHmsFromSeconds(actual.timer.effectiveAccSec)} · Muerto{" "}
              {formatHmsFromSeconds(actual.timer.deadAccSec)} · Total acum. turno{" "}
              {formatHmsFromSeconds(actual.timer.effectiveAccSec + actual.timer.deadAccSec)}
            </p>
            <p className="mt-1.5 font-medium text-foreground/90">Personal</p>
            {printingPersonnelLinesFromTurno(actual).length === 0 ? (
              <p className="text-muted-foreground">Sin personal registrado.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {printingPersonnelLinesFromTurno(actual).map((line, i) => (
                  <li key={`actual-p-${i}`}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

type AreaBandejaTab = "activas" | "historial"

/** Sub-vistas dentro de «En curso» solo para bandeja de impresión. */
type PrintingActivasSubTab = "pendientes" | "produccion" | "finalizadas"

const PRINTING_SUB_TAB_LABEL: Record<PrintingActivasSubTab, string> = {
  pendientes: "Pendientes",
  produccion: "En producción",
  finalizadas: "Finalizadas",
}

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

  function printingTrayMesStickerClass(bs?: string | null): string {
    const t = processStateForArea(bs)
    const base =
      "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-tight"
    if (t === "Hecho en área") {
      return `${base} border-emerald-500/35 bg-emerald-500/12 text-emerald-950 dark:text-emerald-50`
    }
    if (t === "En proceso") {
      return `${base} border-sky-500/35 bg-sky-500/12 text-sky-950 dark:text-sky-50`
    }
    return `${base} border-violet-400/35 bg-violet-500/10 text-violet-950 dark:border-violet-500/30 dark:bg-violet-950/35 dark:text-violet-100`
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

  const filterHint = (
    <p className="text-muted-foreground mt-1 flex items-start gap-2 border-t border-border/60 pt-3 text-xs lg:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>La búsqueda filtra por código de OT, referencia de pedido o nombre de cliente al escribir.</span>
    </p>
  )

  const historialFilterHint = (
    <p className="text-muted-foreground mt-1 flex items-start gap-2 border-t border-border/60 pt-3 text-xs lg:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>Busque por cliente, producto, código de OT o referencia de pedido al escribir.</span>
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
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.current_page >= rows.last_page || loading}
            onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            className="gap-1.5"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden />
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
      return "Temporizador activo o en pausa. Use «Tiempos y detalle» o el icono de reloj para ver el modal con turnos y personal."
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
              {printingMesModalId !== null && !printingMesModalRow ? (
                <p className="text-muted-foreground text-sm">
                  Esta OT no está en la página actual del listado. Cierre el cuadro o navegue en el listado hasta
                  encontrarla.
                </p>
              ) : (
                <>
                  {printingMesModalBand ? (
                    <PrintingMesBandDetailBlock
                      mesBand={printingMesModalBand}
                      reqStatus={printingMesModalReqStatus}
                    />
                  ) : printingMesModalRow ? (
                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                      La OT no está en etapa Impresión en el tablero. Los temporizadores visibles en la bandeja aplican
                      cuando la OT figura en Impresión; puede abrir la OT para avanzar etapas o revisar datos.
                    </p>
                  ) : null}
                  {printingMesModalRow ? <PrintingMesModalTurnosSection row={printingMesModalRow} /> : null}
                </>
              )}
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
          <TabsTrigger
            value="activas"
            className="inline-flex max-w-full flex-wrap items-center gap-2"
          >
            <Rows3 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
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
          <TabsTrigger value="historial" className="inline-flex items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="mt-4 space-y-4">
          {area === "printing" ? (
            <div className="space-y-2">
              <ToggleGroup
                type="single"
                value={printingActivasSubTab}
                onValueChange={(v) => {
                  if (!v) return
                  setPrintingActivasSubTab(v as PrintingActivasSubTab)
                  setPrintingMesModalId(null)
                }}
                variant="outline"
                size="sm"
                className="flex h-auto w-full flex-wrap justify-stretch gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1.5 sm:justify-start"
                aria-label="Vista de bandeja de impresión"
              >
                <ToggleGroupItem
                  value="pendientes"
                  className="inline-flex min-h-9 flex-1 basis-[calc(33.333%-0.25rem)] flex-wrap items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs data-[state=on]:border-primary/35 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-initial sm:basis-auto sm:text-sm"
                >
                  <Inbox className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="font-medium">Pendientes</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.pendientes ?? 0})
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="produccion"
                  className="inline-flex min-h-9 flex-1 basis-[calc(33.333%-0.25rem)] flex-wrap items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs data-[state=on]:border-primary/35 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-initial sm:basis-auto sm:text-sm"
                >
                  <PlayCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="font-medium">En producción</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.produccion ?? 0})
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="finalizadas"
                  className="inline-flex min-h-9 flex-1 basis-[calc(33.333%-0.25rem)] flex-wrap items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-xs data-[state=on]:border-primary/35 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-initial sm:basis-auto sm:text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="font-medium">Finalizadas</span>
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({printingActivasBucketCounts?.finalizadas ?? 0})
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed sm:text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>{printingSubTabHint}</span>
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {area === "printing" ? (
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="tabular-nums text-foreground/90">{displayActivasRows.length}</span> OT en esta
                  página · Bandeja del área:{" "}
                  <span className="tabular-nums text-foreground/90">{totalActivas}</span>
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de este área.</span>
              </p>
            )}
            {area === "printing" ? null : (
              <Badge variant="outline" className={cn(areaRequestBadgeClass("pending"), "inline-flex items-center gap-1.5")}>
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {`En curso: ${totalActivas}`}
              </Badge>
            )}
          </div>
          <div className={catalogFilterPanelClass}>
            <CatalogFilterGrid>
            <CatalogSearchField
              id={`a-q-act-${area}`}
              label="Ref. pedido cliente"
              placeholder="Código OT, referencia, cliente…"
              value={qInput}
              onChange={(ev) => setQInput(ev.target.value)}
              className="min-w-0 lg:col-span-6"
            />
            <CatalogLabeledField label="Prioridad" icon={ListFilter} className="lg:col-span-3">
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
                  <SelectItem value="all" className="gap-2">
                    <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Todas
                  </SelectItem>
                  <SelectItem value="normal" className="gap-2">
                    <Minus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Normal
                  </SelectItem>
                  <SelectItem value="alta" className="gap-2">
                    <ArrowUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Alta
                  </SelectItem>
                  <SelectItem value="urgente" className="gap-2">
                    <Zap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Urgente
                  </SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogLabeledField label="Estado" icon={SlidersHorizontal} className="lg:col-span-3">
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
                  <SelectItem value="all" className="gap-2">
                    <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Todos
                  </SelectItem>
                  <SelectItem value="open" className="gap-2">
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Abierta
                  </SelectItem>
                  <SelectItem value="completed" className="gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Completada
                  </SelectItem>
                  <SelectItem value="cancelled" className="gap-2">
                    <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Cancelada
                  </SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogLabeledField label="Fecha OT (desde)" icon={Calendar} className="lg:col-span-3">
              <Input
                type="date"
                className={catalogFilterDateInputClass}
                value={createdFrom}
                onChange={(ev) => {
                  setCreatedFrom(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Fecha OT (hasta)" icon={Calendar} className="lg:col-span-3">
              <Input
                type="date"
                className={catalogFilterDateInputClass}
                value={createdTo}
                onChange={(ev) => {
                  setCreatedTo(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Solicitud área (desde)" icon={CalendarClock} className="lg:col-span-3">
              <Input
                type="date"
                className={catalogFilterDateInputClass}
                value={areaRequestedFrom}
                onChange={(ev) => {
                  setAreaRequestedFrom(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Solicitud área (hasta)" icon={CalendarClock} className="lg:col-span-3">
              <Input
                type="date"
                className={catalogFilterDateInputClass}
                value={areaRequestedTo}
                onChange={(ev) => {
                  setAreaRequestedTo(ev.target.value)
                  setPage(1)
                }}
              />
            </CatalogLabeledField>
            {filterHint}
          </CatalogFilterGrid>
          </div>

          <InsumosBandejaTableCard>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                  <TableHead className="h-10 w-[88px] px-2 pl-5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </TableHead>
                  <TableHead className="h-10 min-w-[140px] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </TableHead>
                  {area === "printing" ? (
                    <TableHead className="h-10 min-w-[11.5rem] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        Temporizador
                      </span>
                    </TableHead>
                  ) : null}
                  <TableHead className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Material
                  </TableHead>
                  <TableHead className="h-10 w-[120px] px-2 pr-5 text-right align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={area === "printing" ? 5 : INSUMOS_BANDEJA_TABLE_COLSPAN}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={area === "printing" ? 5 : INSUMOS_BANDEJA_TABLE_COLSPAN}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Sin solicitudes.
                    </TableCell>
                  </TableRow>
                ) : area === "printing" && displayActivasRows.length === 0 ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Ninguna OT en «{PRINTING_SUB_TAB_LABEL[printingActivasSubTab]}» en esta página. Pruebe otra
                      vista o otra página del listado.
                    </TableCell>
                  </TableRow>
                ) : (
                  (area === "printing" ? displayActivasRows : rows.data).map((o, idx) => {
                    const reqStatus =
                      (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ??
                      "pending"
                    const mesBand =
                      area === "printing" ? printingMesBandFromWorkOrderRow(o, mesBandNowMs) : null
                    const rowAccent =
                      mesBand && area === "printing" ? printingBandejaRowAccentClass(mesBand.workflow) : ""
                    const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                    return (
                      <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx, rowAccent)}>
                        <TableCell className="pl-5 align-middle">
                          <Link to={openUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                            {o.code}
                          </Link>
                        </TableCell>
                        <TableCell className="align-middle">
                          {area === "printing" ? (
                            <div className="flex min-w-0 max-w-[20rem] flex-col gap-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                {mesBand ? (
                                  <span
                                    className={printingBandejaStatePillClass(mesBand.workflow)}
                                    role="status"
                                  >
                                    {printingWorkflowPillGlyph(mesBand.workflow)}
                                    {printingBandejaWorkflowTitle(mesBand.workflow)}
                                  </span>
                                ) : (
                                  <span
                                    className={printingTrayMesStickerClass(o.board_stage)}
                                    title="La OT aún no está en etapa Impresión en el tablero; no hay bloque MES en esta vista."
                                  >
                                    <CircleDashed className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                                    <span className="min-w-0">{processStateForArea(o.board_stage)}</span>
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    areaRequestBadgeClass(reqStatus),
                                    "inline-flex h-5 w-fit shrink-0 items-center gap-1 px-1.5 py-0 text-[10px] leading-none",
                                  )}
                                  title="Estado de la solicitud al área"
                                >
                                  {areaRequestStatusGlyph(reqStatus)}
                                  {areaRequestStatusLabel(reqStatus)}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={cn(areaRequestBadgeClass(reqStatus), "inline-flex items-center gap-1")}
                            >
                              {areaRequestStatusGlyph(reqStatus)}
                              {areaRequestStatusLabel(reqStatus)}
                            </Badge>
                          )}
                        </TableCell>
                        {area === "printing" ? (
                          <TableCell className="min-w-[11.5rem] align-middle">
                            <TooltipProvider delayDuration={220}>
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setPrintingMesModalId(o.id)}
                                    className="text-primary inline-flex max-w-full items-center gap-2 rounded-md text-left text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:text-sm"
                                  >
                                    <Timer
                                      className="h-7 w-7 shrink-0 opacity-90 sm:h-8 sm:w-8"
                                      strokeWidth={2.25}
                                      aria-hidden
                                    />
                                    <span className="min-w-0 leading-snug">Tiempos y detalle</span>
                                  </button>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 shrink-0 border-primary/30"
                                        aria-label="Turnos acumulativos y personal"
                                        onClick={() => setPrintingMesModalId(o.id)}
                                      >
                                        <AlarmClock className="h-5 w-5 shrink-0" aria-hidden />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Turnos acumulativos y personal</TooltipContent>
                                  </Tooltip>
                                </div>
                                {mesBand?.showTimes ? (
                                  <p className="text-muted-foreground font-mono text-xs tabular-nums">
                                    Tiempo efectivo: {mesBand.effectiveHms}
                                  </p>
                                ) : null}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        ) : null}
                        <TableCell className="max-w-md align-middle">
                          <p
                            className="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                            title={materialTitle}
                          >
                            {o.product?.name?.trim() ? o.product.name : "—"}
                          </p>
                          <p className="text-muted-foreground text-xs leading-snug">
                            {o.client?.name?.trim() ? o.client.name : "—"}
                          </p>
                        </TableCell>
                        <TableCell className="pr-5 text-right align-middle">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-primary/25 gap-1.5" asChild>
                              <Link to={openUrl(o.id)}>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                Abrir
                              </Link>
                            </Button>
                            {canMoveFromHere(o.board_stage) && nextStageByArea[area] ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="gap-1.5"
                                disabled={movingId === o.id}
                                onClick={() => void moveToNextStage(o.id)}
                              >
                                {movingId === o.id ? (
                                  "…"
                                ) : (
                                  <>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                    {`Pasar a ${stageLabel[nextStageByArea[area]!]}`}
                                  </>
                                )}
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
          </InsumosBandejaTableCard>
          {pagination}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                Archivo de solicitudes cerradas en el área (hechas o canceladas). Busque por cliente o producto entre
                el historial.
              </span>
            </p>
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
            >
              <ListOrdered className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              En listado: {rows?.total ?? 0}
            </Badge>
          </div>

          <div className={catalogFilterPanelClass}>
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
          </div>

          <InsumosBandejaTableCard>
            <Table>
              <TableHeader>
                <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                  <TableHead className="h-10 w-[88px] px-2 pl-5 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </TableHead>
                  <TableHead className="h-10 min-w-[140px] px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </TableHead>
                  <TableHead className="h-10 px-2 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Material
                  </TableHead>
                  <TableHead className="h-10 w-[120px] px-2 pr-5 text-right align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={INSUMOS_BANDEJA_TABLE_COLSPAN}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={INSUMOS_BANDEJA_TABLE_COLSPAN}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Sin solicitudes.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o, idx) => {
                    const reqStatus =
                      (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ??
                      null
                    const reqCreatedAt =
                      o.areaRequests && o.areaRequests.length
                        ? (o.areaRequests[0]?.created_at ?? null)
                        : null
                    const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                    return (
                      <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx)}>
                        <TableCell className="pl-5 align-middle">
                          <Link to={openUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                            {o.code}
                          </Link>
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex flex-col gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                areaRequestBadgeClass(reqStatus),
                                "inline-flex w-fit items-center gap-1",
                              )}
                            >
                              {areaRequestStatusGlyph(reqStatus)}
                              {areaRequestStatusLabel(reqStatus)}
                            </Badge>
                            <div className="text-muted-foreground text-xs leading-snug">
                              <span className="text-foreground/90">{processStateForArea(o.board_stage)}</span>
                              {o.created_at ? (
                                <span>
                                  {" "}
                                  · OT {new Date(o.created_at).toLocaleDateString()}
                                </span>
                              ) : null}
                              {reqCreatedAt ? (
                                <span>
                                  {" "}
                                  · Sol. {new Date(reqCreatedAt).toLocaleDateString()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md align-middle">
                          <p
                            className="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                            title={materialTitle}
                          >
                            {o.product?.name?.trim() ? o.product.name : "—"}
                          </p>
                          <p className="text-muted-foreground text-xs leading-snug">
                            {o.client?.name?.trim() ? o.client.name : "—"}
                          </p>
                        </TableCell>
                        <TableCell className="pr-5 text-right align-middle">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button variant="outline" size="sm" className="border-primary/25 gap-1.5" asChild>
                              <Link to={openUrl(o.id)}>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                Abrir
                              </Link>
                            </Button>
                            {canMoveFromHere(o.board_stage) && nextStageByArea[area] ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="gap-1.5"
                                disabled={movingId === o.id}
                                onClick={() => void moveToNextStage(o.id)}
                              >
                                {movingId === o.id ? (
                                  "…"
                                ) : (
                                  <>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                                    {`Pasar a ${stageLabel[nextStageByArea[area]!]}`}
                                  </>
                                )}
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
          </InsumosBandejaTableCard>

          {pagination}
        </TabsContent>
      </Tabs>
      </>
    </CatalogPageShell>
  )
}
