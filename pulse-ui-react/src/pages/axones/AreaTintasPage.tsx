"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  ClipboardList,
  Droplets,
  ExternalLink,
  History,
  Inbox,
  List,
  ListFilter,
  ListOrdered,
  Minus,
  Package,
  Rows3,
  Search,
  SlidersHorizontal,
  Warehouse,
  XCircle,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import { MesBandejaCriteriaDateInput } from "@/components/axones/MesBandejaCriteriaDateInput"
import {
  MesBandejaCriteriaField,
  mesBandejaCriteriaSelectClass,
} from "@/components/axones/MesBandejaCriteriaField"
import { MesBandejaFiltersPanel } from "@/components/axones/MesBandejaFiltersPanel"
import { TintasMaterialInventoryTable } from "@/components/axones/TintasMaterialInventoryTable"
import { TintasMixSection } from "@/components/axones/TintasMixSection"
import { useTintasMaterials } from "@/hooks/useTintasMaterials"
import { mesBandejaFilterPanelClass } from "@/components/axones/catalog-list-classes"
import {
  INSUMOS_BANDEJA_TABLE_COLSPAN,
  InsumosBandejaTableCard,
  insumosBandejaDataRowClassName,
  insumosBandejaIdLinkClassName,
  BandejaTableHeadLabel,
  insumosBandejaTableHeadClassName,
  insumosBandejaTableHeadRightClassName,
  MesBandejaRowIndexDataCell,
  MesBandejaRowIndexHeadCell,
  mesBandejaRowNumber,
  MesBandejaTableColgroup,
  mesBandejaTableClassName,
  mesBandejaStickyOtCellClass,
  mesBandejaStickyOtHeadClass,
} from "@/components/axones/InsumosBandejaTable"
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
import {
  areaRequestBadgeClass,
  AreaRequestStatusIcon,
} from "@/lib/axones-area-request-display"
import { getStoredUser } from "@/lib/auth-storage"
import { MesBandejaWorkflowStatusPill } from "@/components/axones/MesBandejaWorkflowStatusPill"
import { mesBandejaOtLinkClassName, mesBandejaRowAccentClass } from "@/lib/mes-timer-band-shared"
import {
  MesBandejaProgramacionTableHeadCells,
  MesBandejaProgramacionTableRowCells,
} from "@/components/axones/MesBandejaProgramacionTableCells"
import {
  MesBandejaAreaPendientesTableHeadCells,
  MesBandejaAreaPendientesTableRowCells,
} from "@/components/axones/MesBandejaAreaPendientesTableCells"
import { MesActivasSubTabsBar, type MesActivasSubTabKey } from "@/components/axones/MesActivasSubTabsBar"
import { bandejaProgramacionRowAccentClass, readBandejaProgramacion } from "@/lib/area-bandeja-programacion"
import {
  bandejaPendientesAreaColumnCount,
  mesBandejaPendientesTableMinWidth,
} from "@/lib/area-bandeja-pendientes-columns"
import {
  MES_BANDEJA_INDEX_COLUMN_COUNT,
  MES_BANDEJA_PROGRAMACION_COLUMN_COUNT,
} from "@/lib/mes-timer-band-shared"
import {
  MES_BANDEJA_QUERY_KEY,
  parseMesBandejaSubTabParam,
} from "@/lib/mes-bandeja-navigation"
import { tintasActivasBucketFromRow, tintasMesBandFromWorkOrderRow } from "@/lib/tintas-mes-band-status"
import { tintasWorkOrderProduccionUrl } from "@/lib/tintas-navigation"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TintasBandejaTab = "activas" | "historial"
type TintasAreaToolsVista = "inventario" | "cementerio" | "mezcla"

function tintasOtStatusLabel(status?: string | null): string {
  if (status === "open") return "Abierta"
  if (status === "completed") return "Completada"
  if (status === "cancelled") return "Cancelada"
  return status ?? "—"
}

const MI_AREA_TINTAS: MiAreaApi = "tintas"
const TINTAS_BANDEJA_MES_COLSPAN = 5
const SEARCH_DEBOUNCE_MS = 320

function bandejaPriorityIcon(value: string): LucideIcon {
  if (value === "urgente") return Zap
  if (value === "alta") return ArrowUp
  if (value === "normal") return Minus
  return List
}

function bandejaPriorityIconClass(value: string): string {
  if (value === "urgente") return "text-amber-600 dark:text-amber-400"
  if (value === "alta") return "text-orange-600 dark:text-orange-400"
  if (value === "normal") return "text-sky-600 dark:text-sky-400"
  return "text-violet-600/75 dark:text-violet-300"
}

function bandejaStatusIcon(value: string): LucideIcon {
  if (value === "open") return Circle
  if (value === "completed") return CheckCircle2
  if (value === "cancelled") return XCircle
  return List
}

function bandejaStatusIconClass(value: string): string {
  if (value === "open") return "text-sky-600 dark:text-sky-400"
  if (value === "completed") return "text-emerald-600 dark:text-emerald-400"
  if (value === "cancelled") return "text-rose-600 dark:text-rose-400"
  return "text-muted-foreground"
}

function tintasBandejaColSpan(programacion: boolean): number {
  if (!programacion) return TINTAS_BANDEJA_MES_COLSPAN
  return (
    MES_BANDEJA_INDEX_COLUMN_COUNT +
    1 +
    MES_BANDEJA_PROGRAMACION_COLUMN_COUNT +
    bandejaPendientesAreaColumnCount("tintas") +
    2
  )
}

function parseTintasAreaToolsVista(value: string | null): TintasAreaToolsVista {
  if (value === "inventario" || value === "cementerio" || value === "mezcla") return value
  return "inventario"
}

export default function AreaTintasPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const otRedirectParam = searchParams.get("ot")
  const otRedirectNum = otRedirectParam ? Number(otRedirectParam) : NaN
  const initialBandejaSubTab = parseMesBandejaSubTabParam(searchParams.get(MES_BANDEJA_QUERY_KEY))
  const session = getStoredUser()
  const [mode, setMode] = useState<"list" | "tools">(() => {
    const v = searchParams.get("vista")
    if (v === "inventario" || v === "cementerio" || v === "mezcla") return "tools"
    return "list"
  })
  const [toolsVista, setToolsVista] = useState<TintasAreaToolsVista>(() =>
    parseTintasAreaToolsVista(searchParams.get("vista")),
  )
  const [activeTab, setActiveTab] = useState<TintasBandejaTab>("activas")
  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [priority, setPriority] = useState<string>("all")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const skipSearchPageReset = useRef(true)
  const [page, setPage] = useState(1)
  const [onlyPendingArea, setOnlyPendingArea] = useState(false)
  const [historialIncludePending, setHistorialIncludePending] = useState(false)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [totalActivas, setTotalActivas] = useState(0)
  const [unseenActivas, setUnseenActivas] = useState(0)
  const [mesBandNowMs, setMesBandNowMs] = useState(() => Date.now())
  const [mesActivasSubTab, setMesActivasSubTab] = useState<MesActivasSubTabKey>(
    initialBandejaSubTab ?? "pendientes",
  )

  const showProgramacionColumns = activeTab === "activas" && mesActivasSubTab === "pendientes"
  const tintasBandejaColCount = tintasBandejaColSpan(showProgramacionColumns)

  const mesActivasBucketCounts = useMemo(() => {
    if (activeTab !== "activas" || !rows?.data.length) return null
    let pendientes = 0
    let produccion = 0
    let finalizadas = 0
    for (const o of rows.data) {
      const b = tintasActivasBucketFromRow(o, mesBandNowMs)
      if (b === "pendientes") pendientes++
      else if (b === "produccion") produccion++
      else finalizadas++
    }
    return { pendientes, produccion, finalizadas }
  }, [activeTab, rows, mesBandNowMs])

  const displayActivasRows = useMemo(() => {
    if (!rows?.data.length || activeTab !== "activas") return []
    return rows.data.filter((o) => tintasActivasBucketFromRow(o, mesBandNowMs) === mesActivasSubTab)
  }, [rows, activeTab, mesBandNowMs, mesActivasSubTab])

  const displayTotalActivas = useMemo(() => {
    if (!mesActivasBucketCounts) return totalActivas
    return mesActivasBucketCounts.pendientes + mesActivasBucketCounts.produccion
  }, [mesActivasBucketCounts, totalActivas])

  const [loading, setLoading] = useState(false)

  const {
    tintaMaterials,
    invTintas,
    invCementerio,
    loading: materialsLoading,
    reload: reloadMaterials,
  } = useTintasMaterials({ enabled: mode === "tools" })

  const syncToolsUrl = useCallback(
    (nextVista: TintasAreaToolsVista) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.delete("ot")
        p.set("vista", nextVista)
        return p
      })
    },
    [setSearchParams],
  )

  const openTintasProduction = useCallback(
    (orderId: number) => {
      navigate(tintasWorkOrderProduccionUrl(orderId))
    },
    [navigate],
  )

  const closeAreaTools = useCallback(() => {
    setMode("list")
    setSearchParams({})
  }, [setSearchParams])

  useEffect(() => {
    const parsed = parseMesBandejaSubTabParam(searchParams.get(MES_BANDEJA_QUERY_KEY))
    if (!parsed || mode !== "list") return
    setActiveTab("activas")
    setMesActivasSubTab(parsed)
  }, [searchParams, mode])

  useEffect(() => {
    if (searchParams.get("vista") !== "mezcla" || mode !== "tools") return
    const el = document.getElementById("tintas-mezcla")
    if (!el) return
    const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
    return () => window.clearTimeout(t)
  }, [searchParams, mode, toolsVista])

  const bandejaListFilters = useMemo((): BandejaListFilters => {
    return {
      status: status !== "all" ? status : undefined,
      priority: priority !== "all" ? priority : undefined,
      q: search || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
    }
  }, [status, priority, search, createdFrom, createdTo])

  const refreshBandejaMeta = useCallback(async () => {
    if (mode !== "list") return
    const base = bandejaListFilters
    const uid = session?.id
    try {
      const [activas, ids] = await Promise.all([
        fetchBandejaTotal(MI_AREA_TINTAS, "active", base),
        collectBandejaWorkOrderIds(
          MI_AREA_TINTAS,
          "active",
          base,
          BANDEJA_COLLECT_MAX_PAGES,
        ),
      ])
      setTotalActivas(activas)
      const seen = loadSeenActivasIds(uid, MI_AREA_TINTAS)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* silencioso */
    }
  }, [bandejaListFilters, mode, session?.id])

  const markActivasBandejaSeen = useCallback(async () => {
    const uid = session?.id
    try {
      const ids = await collectBandejaWorkOrderIds(
        MI_AREA_TINTAS,
        "active",
        bandejaListFilters,
        BANDEJA_COLLECT_MAX_PAGES,
      )
      mergeIdsIntoSeenActivas(uid, MI_AREA_TINTAS, ids)
      const seen = loadSeenActivasIds(uid, MI_AREA_TINTAS)
      setUnseenActivas(countUnseenActivasInIds(ids, seen))
    } catch {
      /* ignore */
    }
  }, [bandejaListFilters, session?.id])

  useEffect(() => {
    if (mode !== "list") return
    void refreshBandejaMeta()
  }, [mode, refreshBandejaMeta])

  useEffect(() => {
    if (mode !== "list") return
    const fn = () => {
      if (document.visibilityState === "visible") void refreshBandejaMeta()
    }
    document.addEventListener("visibilitychange", fn)
    return () => document.removeEventListener("visibilitychange", fn)
  }, [mode, refreshBandejaMeta])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas" || loading || rows === null) return
    void markActivasBandejaSeen()
  }, [mode, activeTab, loading, rows, markActivasBandejaSeen])

  const loadAreaRows = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const query: Record<string, string | number | undefined> = {
        page,
        per_page: 20,
        status: status !== "all" ? status : undefined,
        priority: priority !== "all" ? priority : undefined,
        q: search || undefined,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
      }
      if (activeTab === "activas") {
        query.mi_area = "tintas"
        query.area_process_tag = "active"
      } else {
        query.historial_area = "tintas"
        if (onlyPendingArea) {
          query.only_pending_area = 1
        } else if (!historialIncludePending) {
          query.historial_exclude_pending = 1
        }
      }

      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", { query })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [
    activeTab,
    page,
    search,
    status,
    priority,
    createdFrom,
    createdTo,
    onlyPendingArea,
    historialIncludePending,
  ])

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

  useEffect(() => {
    setPage(1)
  }, [activeTab, status, priority, createdFrom, createdTo, onlyPendingArea, historialIncludePending])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas") return
    const id = window.setInterval(() => setMesBandNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [mode, activeTab])

  useEffect(() => {
    if (mode !== "list" || activeTab !== "activas") return
    const id = window.setInterval(() => {
      void loadAreaRows({ silent: true })
    }, 8000)
    return () => window.clearInterval(id)
  }, [mode, activeTab, loadAreaRows])

  useEffect(() => {
    if (mode !== "list") return
    void loadAreaRows()
  }, [loadAreaRows, mode])

  const tintasPagination =
    rows && rows.last_page > 1 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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

  const activeServerFilterCount = useMemo(() => {
    let n = 0
    if (search.trim()) n++
    if (status !== "all") n++
    if (priority !== "all") n++
    if (createdFrom) n++
    if (createdTo) n++
    return n
  }, [search, status, priority, createdFrom, createdTo])

  const clearBandejaFilters = useCallback(() => {
    setQInput("")
    setSearch("")
    setStatus("all")
    setPriority("all")
    setCreatedFrom("")
    setCreatedTo("")
    setPage(1)
  }, [])

  const filterHint = (
    <p className="text-muted-foreground max-sm:hidden flex items-start gap-2 text-xs leading-relaxed sm:text-sm">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        La búsqueda filtra por código OT, referencia, cliente o producto al escribir.{" "}
        <span className="font-medium text-foreground/85">Estado OT</span> es abierta / completada / cancelada de la
        orden (no el icono de solicitud al área en la tabla). Los botones Pendientes, En producción y Finalizadas
        filtran solo las filas de la página actual en «En curso».
      </span>
    </p>
  )

  const bandejaCriteriaRow = (
    <CatalogFilterGrid className="gap-3 md:gap-2.5">
      <MesBandejaCriteriaField
        label="Prioridad"
        icon={ListFilter}
        accent="violet"
        active={priority !== "all"}
        className="min-w-0 sm:col-span-6 md:col-span-3"
      >
        <Select
          value={priority}
          onValueChange={(v) => {
            setPriority(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={mesBandejaCriteriaSelectClass("violet", priority !== "all")}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              {(() => {
                const Icon = bandejaPriorityIcon(priority)
                return <Icon className={cn("h-4 w-4 shrink-0", bandejaPriorityIconClass(priority))} aria-hidden />
              })()}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent className="border-violet-500/20">
            <SelectItem value="all" className="gap-2.5 font-medium">
              <List className="h-4 w-4 shrink-0 text-violet-600/70" aria-hidden />
              Todas
            </SelectItem>
            <SelectItem value="normal" className="gap-2.5 font-medium">
              <Minus className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              Normal
            </SelectItem>
            <SelectItem value="alta" className="gap-2.5 font-medium">
              <ArrowUp className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
              Alta
            </SelectItem>
            <SelectItem value="urgente" className="gap-2.5 font-medium">
              <Zap className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              Urgente
            </SelectItem>
          </SelectContent>
        </Select>
      </MesBandejaCriteriaField>

      <MesBandejaCriteriaField
        label="Estado OT"
        icon={SlidersHorizontal}
        accent="sky"
        active={status !== "all"}
        className="min-w-0 sm:col-span-6 md:col-span-3"
      >
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v)
            setPage(1)
          }}
        >
          <SelectTrigger className={mesBandejaCriteriaSelectClass("sky", status !== "all")}>
            <span className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              {(() => {
                const Icon = bandejaStatusIcon(status)
                return <Icon className={cn("h-4 w-4 shrink-0", bandejaStatusIconClass(status))} aria-hidden />
              })()}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent className="border-sky-500/20">
            <SelectItem value="all" className="gap-2.5 font-medium">
              <List className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              Todos
            </SelectItem>
            <SelectItem value="open" className="gap-2.5 font-medium">
              <Circle className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />
              Abierta
            </SelectItem>
            <SelectItem value="completed" className="gap-2.5 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              Completada
            </SelectItem>
            <SelectItem value="cancelled" className="gap-2.5 font-medium">
              <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />
              Cancelada
            </SelectItem>
          </SelectContent>
        </Select>
      </MesBandejaCriteriaField>

      <MesBandejaCriteriaField
        label="Fecha OT (desde)"
        icon={Calendar}
        accent="amber"
        active={Boolean(createdFrom)}
        className="min-w-0 sm:col-span-6 md:col-span-3"
      >
        <MesBandejaCriteriaDateInput
          accent="amber"
          value={createdFrom}
          onChange={(v) => {
            setCreatedFrom(v)
            setPage(1)
          }}
        />
      </MesBandejaCriteriaField>

      <MesBandejaCriteriaField
        label="Fecha OT (hasta)"
        icon={Calendar}
        accent="orange"
        active={Boolean(createdTo)}
        className="min-w-0 sm:col-span-6 md:col-span-3"
      >
        <MesBandejaCriteriaDateInput
          accent="orange"
          value={createdTo}
          onChange={(v) => {
            setCreatedTo(v)
            setPage(1)
          }}
        />
      </MesBandejaCriteriaField>
    </CatalogFilterGrid>
  )

  const bandejaSearchFields = (
    <CatalogSearchField
      id="tintas-q"
      label="Ref. pedido cliente"
      placeholder="Código OT, referencia, cliente…"
      value={qInput}
      onChange={(ev) => setQInput(ev.target.value)}
      className="min-w-0"
    />
  )

  if (Number.isFinite(otRedirectNum) && otRedirectNum > 0) {
    return <Navigate to={tintasWorkOrderProduccionUrl(otRedirectNum)} replace />
  }

  return (
    <CatalogPageShell
      title="Área: Tintas y Mezcla de tinta"
      subtitle={
        mode === "list" ? (
          <>
            En curso: solicitudes pendientes de tintas con la OT en etapa de impresión. Historial: solicitudes cerradas;
            opcional incluir pendientes o solo pendientes.
          </>
        ) : (
          <>
            Inventario, cementerio y recetario de mezclas del área. Para operar una OT use{" "}
            <strong className="font-medium text-foreground">Registrar consumo</strong> en la bandeja.
          </>
        )
      }
      icon={Droplets}
      className={mode === "list" ? "!p-0 md:!p-0 space-y-5" : undefined}
    >
      {mode === "list" ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as TintasBandejaTab)
            if (v !== "historial") {
              setOnlyPendingArea(false)
              setHistorialIncludePending(false)
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

          <MesBandejaFiltersPanel
            className="mt-4"
            activeFilterCount={activeServerFilterCount}
            onClear={clearBandejaFilters}
            criteriaRow={bandejaCriteriaRow}
            searchFields={bandejaSearchFields}
            hint={filterHint}
          />

          <TabsContent value="activas" className="mt-4 space-y-4">
            <MesActivasSubTabsBar
              value={mesActivasSubTab}
              counts={mesActivasBucketCounts}
              areaLabel="tintas"
              onChange={setMesActivasSubTab}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de tintas con impresión en
                  curso.
                </span>
              </p>
              <Badge
                variant="outline"
                className={cn(
                  areaRequestBadgeClass("pending"),
                  "inline-flex items-center gap-1.5",
                )}
              >
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {`En curso: ${displayTotalActivas}`}
              </Badge>
            </div>

            <InsumosBandejaTableCard wideTable>
              <Table
                className={mesBandejaTableClassName(
                  showProgramacionColumns
                    ? { pendientesMinWidth: mesBandejaPendientesTableMinWidth("tintas") }
                    : undefined,
                )}
              >
                <MesBandejaTableColgroup
                  variant={showProgramacionColumns ? undefined : "produccion"}
                  pendientesArea={showProgramacionColumns ? "tintas" : undefined}
                  pendientesAreaColumnCount={
                    showProgramacionColumns ? bandejaPendientesAreaColumnCount("tintas") : 0
                  }
                />
                <TableHeader>
                  <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                    {showProgramacionColumns ? (
                      <>
                        <MesBandejaRowIndexHeadCell />
                        <TableHead className={mesBandejaStickyOtHeadClass}>
                          <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                        </TableHead>
                        <MesBandejaProgramacionTableHeadCells />
                        <MesBandejaAreaPendientesTableHeadCells area="tintas" />
                      </>
                    ) : (
                      <>
                        <MesBandejaRowIndexHeadCell />
                        <TableHead className={cn(insumosBandejaTableHeadClassName, "pl-2")}>
                          <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                        </TableHead>
                        <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                          <BandejaTableHeadLabel icon={CircleDot}>Estado</BandejaTableHeadLabel>
                        </TableHead>
                      </>
                    )}
                    <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                      <BandejaTableHeadLabel icon={Package}>Material</BandejaTableHeadLabel>
                    </TableHead>
                    <TableHead className={insumosBandejaTableHeadRightClassName}>
                      <BandejaTableHeadLabel icon={ExternalLink} className="ml-auto">
                        Acciones
                      </BandejaTableHeadLabel>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={tintasBandejaColCount}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Cargando…
                      </TableCell>
                    </TableRow>
                  ) : !rows?.data.length ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={tintasBandejaColCount}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Sin solicitudes.
                      </TableCell>
                    </TableRow>
                  ) : displayActivasRows.length === 0 ? (
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableCell
                        colSpan={tintasBandejaColCount}
                        className="text-muted-foreground py-10 text-center"
                      >
                        Ninguna OT en esta vista en la página actual.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayActivasRows.map((o, idx) => {
                      const reqStatus =
                        (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ?? "pending"
                      const mesBand = tintasMesBandFromWorkOrderRow(o, mesBandNowMs)
                      const rowAccent = showProgramacionColumns
                        ? bandejaProgramacionRowAccentClass(readBandejaProgramacion(o).priority)
                        : mesBand
                          ? mesBandejaRowAccentClass(mesBand.workflow)
                          : ""
                      const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                      const rowNumber = mesBandejaRowNumber(page, rows?.per_page ?? 20, idx)
                      return (
                        <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx, rowAccent)}>
                          {showProgramacionColumns ? (
                            <>
                              <MesBandejaRowIndexDataCell rowNumber={rowNumber} />
                              <TableCell className={mesBandejaStickyOtCellClass}>
                                <div className="flex">
                                  <Link to={tintasWorkOrderProduccionUrl(o.id)} className={mesBandejaOtLinkClassName}>
                                    {o.code}
                                  </Link>
                                </div>
                              </TableCell>
                              <MesBandejaProgramacionTableRowCells row={o} />
                              <MesBandejaAreaPendientesTableRowCells row={o} area="tintas" />
                            </>
                          ) : (
                            <>
                              <MesBandejaRowIndexDataCell rowNumber={rowNumber} />
                              <TableCell className="py-4 pl-2 pr-2 align-middle">
                                <div className="flex min-h-[3.25rem] items-center">
                                  <Link to={tintasWorkOrderProduccionUrl(o.id)} className={mesBandejaOtLinkClassName}>
                                    {o.code}
                                  </Link>
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap px-2 py-4 align-middle">
                                <div className="flex min-h-[3.25rem] items-center gap-2">
                                  {mesBand ? (
                                    <MesBandejaWorkflowStatusPill workflow={mesBand.workflow} />
                                  ) : null}
                                  <AreaRequestStatusIcon status={reqStatus} />
                                </div>
                              </TableCell>
                            </>
                          )}
                          <TableCell className="max-w-md px-3 py-4 align-middle">
                            <div className="flex min-h-[3.25rem] flex-col justify-center">
                              <p
                                className="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                                title={materialTitle}
                              >
                                {o.product?.name?.trim() ? o.product.name : "—"}
                              </p>
                              <p className="text-muted-foreground text-xs leading-snug">
                                {o.client?.name?.trim() ? o.client.name : "—"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-5 py-4 text-right align-middle">
                            <div className="flex min-h-[3.25rem] items-center justify-end">
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-sm text-primary"
                                onClick={() => openTintasProduction(o.id)}
                              >
                                Registrar consumo
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </InsumosBandejaTableCard>
            {tintasPagination}
          </TabsContent>

          <TabsContent value="historial" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  Archivo de solicitudes cerradas en tintas (hechas o canceladas). Use las casillas para acotar qué
                  solicitudes incluye el listado.
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

            <div className="flex flex-wrap gap-4 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={onlyPendingArea}
                  onChange={(ev) => {
                    const on = ev.target.checked
                    setOnlyPendingArea(on)
                    if (on) setHistorialIncludePending(false)
                    setPage(1)
                  }}
                />
                Solo pendientes
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-input"
                  checked={historialIncludePending}
                  disabled={onlyPendingArea}
                  onChange={(ev) => {
                    setHistorialIncludePending(ev.target.checked)
                    setPage(1)
                  }}
                />
                Ver también solicitudes abiertas
              </label>
            </div>

            <InsumosBandejaTableCard>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                    <TableHead className={cn(insumosBandejaTableHeadClassName, "pl-5")}>
                      <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                    </TableHead>
                    <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                      <BandejaTableHeadLabel icon={CircleDot}>Estado</BandejaTableHeadLabel>
                    </TableHead>
                    <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                      <BandejaTableHeadLabel icon={Package}>Material</BandejaTableHeadLabel>
                    </TableHead>
                    <TableHead className={insumosBandejaTableHeadRightClassName}>
                      <BandejaTableHeadLabel icon={ExternalLink} className="ml-auto">
                        Acciones
                      </BandejaTableHeadLabel>
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
                        (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ?? null
                      const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                      return (
                        <TableRow key={o.id} className={insumosBandejaDataRowClassName(idx)}>
                          <TableCell className="pl-5 align-middle">
                            <Link to={tintasWorkOrderProduccionUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                              {o.code}
                            </Link>
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex flex-col gap-2">
                              <AreaRequestStatusIcon status={reqStatus} />
                              {o.status ? (
                                <span className="text-muted-foreground text-xs">
                                  OT: {tintasOtStatusLabel(o.status)}
                                </span>
                              ) : null}
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
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-sm text-primary"
                              onClick={() => openTintasProduction(o.id)}
                            >
                              Registrar consumo
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </InsumosBandejaTableCard>
            {tintasPagination}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm",
              mesBandejaFilterPanelClass,
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">Consultas del área tintas</p>
              <p className="text-muted-foreground text-xs">
                Inventario, cementerio y recetario. Para registrar consumo de una OT use la bandeja →{" "}
                <strong className="font-medium text-foreground">Registrar consumo</strong>.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={closeAreaTools}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Volver al listado
            </Button>
          </div>

          <Tabs
            value={toolsVista}
            onValueChange={(v) => {
              const next = v as TintasAreaToolsVista
              setToolsVista(next)
              syncToolsUrl(next)
            }}
            className="w-full"
          >
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-xl border bg-muted/30 p-1">
              <TabsTrigger value="inventario" className="text-xs sm:text-sm">
                Inventario
              </TabsTrigger>
              <TabsTrigger value="cementerio" className="text-xs sm:text-sm">
                Cementerio
              </TabsTrigger>
              <TabsTrigger value="mezcla" className="text-xs sm:text-sm">
                Mezcla / recetario
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inventario" className="mt-4 space-y-3">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Warehouse className="h-5 w-5 text-primary" aria-hidden />
                    Inventario de tintas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TintasMaterialInventoryTable materials={invTintas} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cementerio" className="mt-4 space-y-3">
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Cementerio de tintas</CardTitle>
                </CardHeader>
                <CardContent>
                  <TintasMaterialInventoryTable
                    materials={invCementerio}
                    notesColumnLabel="Motivo / notas"
                    emptyMessage="Sin ítems en cementerio."
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mezcla" className="mt-4 space-y-3">
              <TintasMixSection
                tintaMaterials={tintaMaterials}
                layout="all"
                onMixCreated={() => void reloadMaterials()}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </CatalogPageShell>
  )
}
