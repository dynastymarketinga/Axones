"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  CircleDashed,
  ClipboardList,
  CircleDot,
  Droplets,
  ExternalLink,
  Package,
  FileSearch,
  History,
  Inbox,
  Layers2,
  List,
  ListFilter,
  ListOrdered,
  Minus,
  Printer,
  Puzzle,
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

import { MesBandejaCriteriaDateInput } from "@/components/axones/MesBandejaCriteriaDateInput"
import {
  MesBandejaCriteriaField,
  mesBandejaCriteriaSelectClass,
} from "@/components/axones/MesBandejaCriteriaField"
import { MesBandejaFiltersPanel } from "@/components/axones/MesBandejaFiltersPanel"
import { MesBandejaWorkflowStatusPill } from "@/components/axones/MesBandejaWorkflowStatusPill"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  INSUMOS_BANDEJA_TABLE_COLSPAN,
  InsumosBandejaTableCard,
  BandejaIconColumnHeadLabel,
  BandejaTableHeadLabel,
  insumosBandejaDataRowClassName,
  insumosBandejaIdLinkClassName,
  insumosBandejaTableHeadClassName,
  MesBandejaRowIndexDataCell,
  MesBandejaRowIndexHeadCell,
  mesBandejaRowNumber,
  mesBandejaIconColumnCellClass,
  mesBandejaIconColumnHeadClass,
  mesBandejaRowTopCellClass,
  mesBandejaStickyOtCellClass,
  mesBandejaStickyOtHeadClass,
  MesBandejaTableColgroup,
  mesBandejaTableClassName,
} from "@/components/axones/InsumosBandejaTable"
import {
  BANDEJA_PER_PAGE_OPTIONS,
  BandejaTablePagination,
} from "@/components/axones/BandejaTablePagination"
import { catalogFilterPanelClass } from "@/components/axones/catalog-list-classes"
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
  TableFooter,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  MesBandejaBobinasDataCell,
  MesBandejaBobinasHeadCell,
  MesBandejaKgTableHeadCells,
  MesBandejaKgTableRowCells,
  MesBandejaKgTableTotalsRow,
} from "@/components/axones/MesBandejaKgTableCells"
import { MesBandejaBobinasExpandPanel } from "@/components/axones/MesBandejaBobinasExpandPanel"
import {
  MesBandejaTurnoRegistradoDataCell,
  MesBandejaTurnoRegistradoHeadCell,
} from "@/components/axones/MesBandejaTurnoRegistradoCell"
import {
  MesBandejaProgramacionTableHeadCells,
  MesBandejaProgramacionTableRowCells,
} from "@/components/axones/MesBandejaProgramacionTableCells"
import {
  MesBandejaAreaPendientesTableHeadCells,
  MesBandejaAreaPendientesTableRowCells,
} from "@/components/axones/MesBandejaAreaPendientesTableCells"
import { MesActivasSubTabsBar } from "@/components/axones/MesActivasSubTabsBar"
import { MesBandejaProduccionWorkflowTabs } from "@/components/axones/MesBandejaProduccionWorkflowTabs"
import { bandejaProgramacionRowAccentClass, readBandejaProgramacion } from "@/lib/area-bandeja-programacion"
import {
  bandejaPendientesAreaColumnCount,
  mesBandejaPendientesTableMinWidth,
  type BandejaPendientesAreaKey,
} from "@/lib/area-bandeja-pendientes-columns"
import { MesBandejaTimerCell } from "@/components/axones/MesBandejaTimerCell"
import { MesBandejaTimesModalBody } from "@/components/axones/MesBandejaTimesModalBody"
import { MontajeMesBandejaTimesPanel } from "@/components/axones/montaje-bandeja-modals"
import { PrintingMesBandejaTimesPanel } from "@/components/axones/printing-bandeja-modals"
import {
  areaHasMesTimerColumn,
  mesAreaDisplayName,
  mesBandFromWorkOrderRow,
  mesBandejaDevolucionesFromWorkOrderRow,
  MES_CONTROL_SAVED_EVENTS,
  type MesBandejaAreaKey,
} from "@/lib/area-mes-band-helpers"
import { mesBandejaDevolucionesTotalsFromSnapshots } from "@/lib/printing-mes-band-devoluciones"
import {
  areaShowsMesKgBreakdownColumns,
  MES_BANDEJA_INDEX_COLUMN_COUNT,
  MES_BANDEJA_KG_BREAKDOWN_COLUMN_COUNT,
  MES_BANDEJA_PROGRAMACION_COLUMN_COUNT,
  mesBandejaOtLinkClassName,
  mesBandejaRowAccentClass,
  MES_PRODUCCION_WORKFLOW_TAB_ORDER,
  mesBandejaWorkflowTitle,
  mesBandejaKgTotalsFromBands,
  mesProduccionWorkflowCountsEmpty,
  type MesProduccionWorkflowFilter,
} from "@/lib/mes-timer-band-shared"
import {
  corteActivasBucketFromRow,
  type CorteActivasSubTab,
} from "@/lib/corte-mes-band-status"
import {
  laminacionActivasBucketFromRow,
  type LaminacionActivasSubTab,
} from "@/lib/laminacion-mes-band-status"
import {
  montajeActivasBucketFromRow,
  type MontajeActivasSubTab,
} from "@/lib/montaje-mes-band-status"
import {
  printingActivasBucketFromRow,
  type PrintingActivasSubTab,
} from "@/lib/printing-mes-band-status"
import {
  canOpenCortePlanillaPreview,
  openCortePlanillaPreviewFromSource,
} from "@/lib/corte-planilla-preview"
import {
  canOpenLaminacionPlanillaPreview,
  openLaminacionPlanillaPreviewFromSource,
} from "@/lib/laminacion-planilla-preview"
import {
  canOpenPrintingPlanillaPreview,
  openPrintingPlanillaPreviewFromSource,
} from "@/lib/printing-planilla-preview"
import {
  areaRequestBadgeClass,
  AreaRequestStatusIcon,
} from "@/lib/axones-area-request-display"
import {
  areaBandejaProgressStickerClass,
  processStateForAreaBandeja,
} from "@/lib/area-mes-progress"
import {
  areaRequestCreatedAtFromRow,
  resolveAreaRequestStatusForTab,
} from "@/lib/area-request-for-row"
import { cn } from "@/lib/utils"

export type AreaKey = "printing" | "montaje" | "laminacion" | "corte" | "tintas"

const SEARCH_DEBOUNCE_MS = 320

const TAB_BY_AREA: Record<AreaKey, string> = {
  printing: "printing",
  montaje: "montaje",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "printing",
}

const AREA_ICON: Record<AreaKey, LucideIcon> = {
  printing: Printer,
  montaje: Puzzle,
  laminacion: Layers2,
  corte: Scissors,
  tintas: Droplets,
}

function areaTitle(area: AreaKey): string {
  if (area === "printing") return "Área: Impresión"
  if (area === "montaje") return "Área: Montaje"
  if (area === "laminacion") return "Área: Laminación"
  if (area === "corte") return "Área: Corte"
  return "Área: Tintas y Mezcla de tinta"
}

function historialTabLabel(area: AreaKey): string {
  return area === "montaje" ? "Finalizados" : "Historial"
}

function areaSubtitle(area: AreaKey): string {
  if (area === "printing") {
    return "Bandeja de OT activas. Las vistas filtran por temporizador de impresión. Historial: solicitudes del área ya cerradas."
  }
  if (area === "laminacion") {
    return "Bandeja de OT activas. Las vistas filtran por temporizador de laminación. Historial: solicitudes del área ya cerradas."
  }
  if (area === "corte") {
    return "Bandeja de OT activas. Las vistas filtran por temporizador de corte. Historial: solicitudes del área ya cerradas."
  }
  if (area === "montaje") {
    return "Bandeja de OT activas. Las vistas filtran por temporizador de montaje. En curso → Finalizadas: montaje MES cerrado. Historial: solicitudes del área ya cerradas."
  }
  if (areaHasMesTimerColumn(area)) {
    return `En curso: solicitudes pendientes y OT en cola o en ${areaTitle(area).replace("Área: ", "")}. El badge de color refleja producción (turno y cronómetro); «Pendiente» naranja es solo la solicitud al área. Historial: solicitudes cerradas.`
  }
  return "En curso: solicitud pendiente y OT en cola o ya en la etapa de este área. Historial: solicitudes cerradas en el área (hechas o canceladas)."
}

function technicalFormRecord(row: WorkOrderListRow): Record<string, unknown> | null {
  const f = row.technical_document?.form
  return f && typeof f === "object" && !Array.isArray(f) ? (f as Record<string, unknown>) : null
}

const PLANILLA_PREVIEW_AREAS = new Set<AreaKey>(["printing", "laminacion", "corte"])

function planillaPreviewAreaLabel(area: AreaKey): string {
  if (area === "printing") return "impresión"
  if (area === "laminacion") return "laminación"
  if (area === "corte") return "corte"
  return area
}

function canOpenPlanillaPreviewForArea(
  area: AreaKey,
  form: Record<string, unknown> | null,
): boolean {
  if (!form) return false
  if (area === "printing") return canOpenPrintingPlanillaPreview(form)
  if (area === "laminacion") return canOpenLaminacionPlanillaPreview(form)
  if (area === "corte") return canOpenCortePlanillaPreview(form)
  return false
}

function MesBandejaTableHeaderCells() {
  return (
    <>
      <MesBandejaRowIndexHeadCell />
      <TableHead className={mesBandejaStickyOtHeadClass}>
        <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
      </TableHead>
      <TableHead className={mesBandejaIconColumnHeadClass}>
        <BandejaIconColumnHeadLabel
          icon={CircleDot}
          line1="Estado"
          line2="prod."
          title="Estado de producción MES (cronómetro / turno)"
        />
      </TableHead>
      <TableHead className={mesBandejaIconColumnHeadClass}>
        <BandejaIconColumnHeadLabel
          icon={Timer}
          line1="Tempor."
          title="Temporizador de la OT"
        />
      </TableHead>
      <MesBandejaTurnoRegistradoHeadCell />
    </>
  )
}

function MesBandejaTableHeadMaterialAcciones() {
  return (
    <>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-3 text-center")}>
        <span
          className="inline-flex w-full flex-col items-center gap-1 text-center"
          title="Producto y cliente de la OT"
        >
          <Package className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
          <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            Material
          </span>
        </span>
      </TableHead>
      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2 text-center sm:px-3")}>
        <span
          className="inline-flex w-full flex-col items-center gap-1 text-center"
          title="Acciones sobre la OT"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary/55" aria-hidden />
          <span className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            Acciones
          </span>
        </span>
      </TableHead>
    </>
  )
}

function MesBandejaEstadoProduccionCell({
  mesBand,
  reqStatus,
  areaProgressLabelText,
}: {
  mesBand: ReturnType<typeof mesBandFromWorkOrderRow>
  reqStatus: string
  areaProgressLabelText: string
}) {
  const reqKey = (reqStatus ?? "").toLowerCase().trim()
  const showSolicitudCerrada = reqKey === "done" || reqKey === "cancelled"

  return (
    <TableCell className={mesBandejaIconColumnCellClass}>
      <div className="flex items-center justify-center gap-1">
        {mesBand ? (
          <MesBandejaWorkflowStatusPill workflow={mesBand.workflow} statusLabel={mesBand.statusLabel} />
        ) : (
          <span
            className={cn(
              areaBandejaProgressStickerClass(areaProgressLabelText),
              "inline-flex h-9 w-9 items-center justify-center rounded-full p-0",
            )}
            title="Estado de producción en esta área (no depende del tablero Kanban)"
          >
            <CircleDashed className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="sr-only">{areaProgressLabelText}</span>
          </span>
        )}
        {showSolicitudCerrada ? <AreaRequestStatusIcon status={reqStatus} /> : null}
      </div>
    </TableCell>
  )
}

function MesBandejaAccionesCell({
  area,
  openUrl,
  workOrderId,
  planillaPreviewEnabled,
  onPlanillaPreview,
}: {
  area: AreaKey
  openUrl: (id: number) => string
  workOrderId: number
  planillaPreviewEnabled: boolean
  onPlanillaPreview: () => void
}) {
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "px-2 text-center sm:px-3")}>
      <TooltipProvider delayDuration={220}>
        <div className="flex items-center justify-center gap-2">
          {PLANILLA_PREVIEW_AREAS.has(area) ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-9 w-9 shrink-0 border-sky-500/45 bg-sky-500/12 text-sky-800 shadow-sm",
                    "hover:border-sky-500 hover:bg-sky-500/22 hover:text-sky-900",
                    "dark:text-sky-100 dark:hover:bg-sky-500/28",
                  )}
                  disabled={!planillaPreviewEnabled}
                  aria-label="Vista previa planilla"
                  onClick={onPlanillaPreview}
                >
                  <FileSearch className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[14rem] text-center">
                {planillaPreviewEnabled
                  ? `Vista previa de la planilla física de ${planillaPreviewAreaLabel(area)}`
                  : `Disponible tras «Finalizar área de ${planillaPreviewAreaLabel(area)}»`}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0 border-violet-500/45 bg-violet-500/12 text-violet-800 shadow-sm",
                  "hover:border-violet-500 hover:bg-violet-500/22 hover:text-violet-900",
                  "dark:text-violet-100 dark:hover:bg-violet-500/28",
                )}
                asChild
              >
                <Link to={openUrl(workOrderId)} aria-label="Abrir OT">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Abrir OT en {mesAreaDisplayName(area as MesBandejaAreaKey)}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </TableCell>
  )
}

function BandejaMaterialCell({
  order,
  materialTitle,
}: {
  order: WorkOrderListRow
  materialTitle: string
}) {
  return (
    <TableCell className={cn(mesBandejaRowTopCellClass, "max-w-[10rem] px-3 text-center")}>
      <div className="flex flex-col items-center gap-1">
        <p
          className="text-sm font-semibold leading-snug text-foreground line-clamp-2"
          title={materialTitle}
        >
          {order.product?.name?.trim() ? order.product.name : "—"}
        </p>
        <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-2">
          {order.client?.name?.trim() ? order.client.name : "—"}
        </p>
      </div>
    </TableCell>
  )
}

type AreaBandejaTab = "activas" | "historial"

type MesActivasSubTab =
  | PrintingActivasSubTab
  | LaminacionActivasSubTab
  | CorteActivasSubTab
  | MontajeActivasSubTab

function mesActivasSubTabAreaLabel(area: AreaKey): string {
  if (area === "laminacion") return "laminación"
  if (area === "corte") return "corte"
  if (area === "montaje") return "montaje"
  return "impresión"
}

/** Sub-vistas dentro de «En curso» (impresión, laminación, corte, montaje). */
const MES_ACTIVAS_SUB_TAB_LABEL: Record<MesActivasSubTab, string> = {
  pendientes: "Pendientes",
  produccion: "En producción",
  finalizadas: "Finalizadas",
}

function areaUsesMesActivasSubTabs(area: AreaKey): boolean {
  return area === "printing" || area === "laminacion" || area === "corte" || area === "montaje"
}

function mesActivasBucketFromRow(area: AreaKey, row: WorkOrderListRow, nowMs: number): MesActivasSubTab {
  if (area === "montaje") return montajeActivasBucketFromRow(row, nowMs)
  if (area === "laminacion") return laminacionActivasBucketFromRow(row, nowMs)
  if (area === "corte") return corteActivasBucketFromRow(row, nowMs)
  return printingActivasBucketFromRow(row, nowMs)
}

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

function areaToPendientesKey(area: AreaKey): BandejaPendientesAreaKey {
  if (area === "printing") return "printing"
  if (area === "montaje") return "montaje"
  if (area === "laminacion") return "laminacion"
  if (area === "corte") return "corte"
  return "tintas"
}

export default function AreaWorkOrdersPage({ area }: { area: AreaKey }) {
  const session = getStoredUser()
  const [activeTab, setActiveTab] = useState<AreaBandejaTab>("activas")
  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(10)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(
    null,
  )
  const [totalActivas, setTotalActivas] = useState(0)
  const [unseenActivas, setUnseenActivas] = useState(0)

  const [status, setStatus] = useState<string>("all")
  const [priority, setPriority] = useState<string>("all")
  const [createdFrom, setCreatedFrom] = useState("")
  const [createdTo, setCreatedTo] = useState("")
  const skipSearchPageReset = useRef(true)
  /** Evita forzar «En producción» tras elegir manualmente otra sub-vista MES. */
  const mesActivasSubTabAutoPickedRef = useRef(false)
  const mesProduccionFilterTouchedRef = useRef(false)
  /** Reloj en vivo para tiempo efectivo acumulado (bandeja impresión). */
  const [mesBandNowMs, setMesBandNowMs] = useState(() => Date.now())
  /** Modal de detalle MES (impresión): id de OT abierta o null. */
  const [mesModalId, setMesModalId] = useState<number | null>(null)
  /** Fila expandida con devoluciones de bobina (solo impresión). */
  const [expandedBobinasOtId, setExpandedBobinasOtId] = useState<number | null>(null)
  /** Filtro de bandeja MES dentro de «En curso». */
  const [mesActivasSubTab, setMesActivasSubTab] = useState<MesActivasSubTab>("pendientes")
  const [mesProduccionWorkflow, setMesProduccionWorkflow] =
    useState<MesProduccionWorkflowFilter>("turno_abierto")
  const hasTimerColumn = areaHasMesTimerColumn(area)
  const showKgBreakdown = hasTimerColumn && areaShowsMesKgBreakdownColumns(area)
  const pendientesAreaKey = areaToPendientesKey(area)
  const pendientesAreaCols = bandejaPendientesAreaColumnCount(pendientesAreaKey)
  const showProgramacionColumns =
    activeTab === "activas" &&
    areaUsesMesActivasSubTabs(area) &&
    mesActivasSubTab === "pendientes"
  const mesBandejaColCount = hasTimerColumn
    ? showProgramacionColumns
      ? MES_BANDEJA_INDEX_COLUMN_COUNT +
        1 +
        MES_BANDEJA_PROGRAMACION_COLUMN_COUNT +
        pendientesAreaCols +
        2
      : MES_BANDEJA_INDEX_COLUMN_COUNT +
        6 +
        (showKgBreakdown ? MES_BANDEJA_KG_BREAKDOWN_COLUMN_COUNT : 0)
    : INSUMOS_BANDEJA_TABLE_COLSPAN
  const bandejaActivasColSpan = mesBandejaColCount
  const bandejaHistorialColSpan = mesBandejaColCount

  const queryStatus = status !== "all" ? status : undefined
  const queryPriority = priority !== "all" ? priority : undefined

  const miAreaApi = useMemo((): MiAreaApi => {
    if (area === "printing") return "impresion"
    if (area === "montaje") return "montaje"
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
    }
  }, [queryStatus, queryPriority, search, createdFrom, createdTo])

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

  useEffect(() => {
    setPage(1)
  }, [perPage, activeTab, status, priority, createdFrom, createdTo])

  useEffect(() => {
    setExpandedBobinasOtId(null)
  }, [page, activeTab, mesActivasSubTab, mesProduccionWorkflow])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true
      if (!silent) setLoading(true)
      try {
        let query: Record<string, string | number | undefined>
        if (activeTab === "historial") {
          query = {
            page,
            per_page: perPage,
            historial_area: miAreaApi,
            historial_exclude_pending: 1,
            status: queryStatus,
            priority: queryPriority,
            q: search || undefined,
            created_from: createdFrom || undefined,
            created_to: createdTo || undefined,
          }
        } else {
          query = {
            page,
            per_page: perPage,
            status: queryStatus,
            priority: queryPriority,
            q: search || undefined,
            created_from: createdFrom || undefined,
            created_to: createdTo || undefined,
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
      perPage,
      queryPriority,
      queryStatus,
      search,
      createdFrom,
      createdTo,
    ],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!hasTimerColumn) return
    const id = window.setInterval(() => setMesBandNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasTimerColumn])

  useEffect(() => {
    if (!hasTimerColumn || activeTab !== "activas") return
    const id = window.setInterval(() => {
      void load({ silent: true })
    }, 8000)
    return () => window.clearInterval(id)
  }, [hasTimerColumn, activeTab, load])

  useEffect(() => {
    if (!hasTimerColumn) return
    const eventName = MES_CONTROL_SAVED_EVENTS[area as MesBandejaAreaKey]
    const fn = () => {
      void load({ silent: true })
      void refreshBandejaMeta()
    }
    window.addEventListener(eventName, fn)
    return () => window.removeEventListener(eventName, fn)
  }, [area, hasTimerColumn, load, refreshBandejaMeta])

  const mesModalRow = useMemo((): WorkOrderListRow | null => {
    if (mesModalId === null || !rows?.data.length) return null
    return rows.data.find((r) => r.id === mesModalId) ?? null
  }, [mesModalId, rows])

  const mesModalBand = useMemo(() => {
    if (!mesModalRow || !hasTimerColumn) return null
    return mesBandFromWorkOrderRow(area as MesBandejaAreaKey, mesModalRow, mesBandNowMs)
  }, [mesModalRow, hasTimerColumn, area, mesBandNowMs])

  const mesProduccionWorkflowCounts = useMemo(() => {
    const counts = mesProduccionWorkflowCountsEmpty()
    if (!areaUsesMesActivasSubTabs(area) || !rows?.data.length) return counts
    for (const o of rows.data) {
      if (mesActivasBucketFromRow(area, o, mesBandNowMs) !== "produccion") continue
      const wf = mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)?.workflow
      if (wf === "sin_iniciar") counts.sin_iniciar++
      else if (wf === "turno_abierto") counts.turno_abierto++
      else if (wf === "entre_turnos") counts.entre_turnos++
      else if (wf === "iniciado") counts.iniciado++
      else if (wf === "pausado") counts.pausado++
    }
    return counts
  }, [area, rows, mesBandNowMs])

  const produccionRowsOnPage = useMemo(() => {
    if (!rows?.data.length) return []
    return rows.data.filter(
      (o) => mesActivasBucketFromRow(area, o, mesBandNowMs) === "produccion",
    )
  }, [rows, area, mesBandNowMs])

  const displayActivasRows = useMemo((): WorkOrderListRow[] => {
    if (!rows?.data.length) return []
    if (!areaUsesMesActivasSubTabs(area)) return rows.data

    let list = rows.data.filter(
      (o) => mesActivasBucketFromRow(area, o, mesBandNowMs) === mesActivasSubTab,
    )

    if (mesActivasSubTab === "produccion") {
      list = list.filter(
        (o) =>
          mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)?.workflow ===
          mesProduccionWorkflow,
      )
    }

    return list
  }, [rows, area, mesBandNowMs, mesActivasSubTab, mesProduccionWorkflow])

  const activasTableRows = useMemo((): WorkOrderListRow[] => {
    if (!rows?.data.length) return []
    if (areaUsesMesActivasSubTabs(area)) {
      return displayActivasRows
    }
    return rows.data
  }, [rows, area, displayActivasRows])

  const activasKgTotals = useMemo(() => {
    if (!showKgBreakdown || activasTableRows.length === 0) return null
    const totals = mesBandejaKgTotalsFromBands(
      activasTableRows.map((o) => mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)),
    )
    return totals.rowsWithKg > 0 ? totals : null
  }, [showKgBreakdown, activasTableRows, area, mesBandNowMs])

  const historialKgTotals = useMemo(() => {
    if (!showKgBreakdown || !rows?.data.length) return null
    const totals = mesBandejaKgTotalsFromBands(
      rows.data.map((o) => mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)),
    )
    return totals.rowsWithKg > 0 ? totals : null
  }, [showKgBreakdown, rows, area, mesBandNowMs])

  const activasDevolucionesTotals = useMemo(() => {
    if (!showKgBreakdown || activasTableRows.length === 0) return null
    return mesBandejaDevolucionesTotalsFromSnapshots(
      activasTableRows.map((o) =>
        mesBandejaDevolucionesFromWorkOrderRow(area as MesBandejaAreaKey, o),
      ),
    )
  }, [showKgBreakdown, activasTableRows])

  const historialDevolucionesTotals = useMemo(() => {
    if (!showKgBreakdown || !rows?.data.length) return null
    return mesBandejaDevolucionesTotalsFromSnapshots(
      rows.data.map((o) => mesBandejaDevolucionesFromWorkOrderRow(area as MesBandejaAreaKey, o)),
    )
  }, [showKgBreakdown, rows])

  const mesActivasBucketCounts = useMemo(() => {
    if (!areaUsesMesActivasSubTabs(area) || !rows?.data.length) return null
    let pendientes = 0
    let produccion = 0
    let finalizadas = 0
    for (const o of rows.data) {
      const b = mesActivasBucketFromRow(area, o, mesBandNowMs)
      if (b === "pendientes") pendientes++
      else if (b === "produccion") produccion++
      else finalizadas++
    }
    return { pendientes, produccion, finalizadas }
  }, [area, rows, mesBandNowMs])

  /** En curso (N): impresión/laminación cuentan solo pendientes + producción; finalizadas van aparte. */
  const displayTotalActivas = useMemo(() => {
    if (areaUsesMesActivasSubTabs(area) && mesActivasBucketCounts) {
      return mesActivasBucketCounts.pendientes + mesActivasBucketCounts.produccion
    }
    return totalActivas
  }, [area, mesActivasBucketCounts, totalActivas])

  useEffect(() => {
    if (activeTab !== "activas") {
      setMesActivasSubTab("pendientes")
      mesActivasSubTabAutoPickedRef.current = false
      mesProduccionFilterTouchedRef.current = false
    }
  }, [activeTab])

  useEffect(() => {
    setMesActivasSubTab("pendientes")
    mesActivasSubTabAutoPickedRef.current = false
    mesProduccionFilterTouchedRef.current = false
  }, [area])

  useEffect(() => {
    if (mesActivasSubTab !== "produccion" || mesProduccionFilterTouchedRef.current) return
    if (!rows?.data.length) return
    for (const wf of MES_PRODUCCION_WORKFLOW_TAB_ORDER) {
      if (mesProduccionWorkflowCounts[wf] > 0) {
        setMesProduccionWorkflow(wf)
        return
      }
    }
  }, [mesActivasSubTab, mesProduccionWorkflowCounts, rows])

  useEffect(() => {
    if (mesModalId === null) return
    if (!hasTimerColumn || activeTab !== "activas") return
    void load({ silent: true })
  }, [mesModalId, hasTimerColumn, activeTab, load])

  useEffect(() => {
    if (!hasTimerColumn) setMesModalId(null)
  }, [hasTimerColumn])

  useEffect(() => {
    if (activeTab !== "activas") setMesModalId(null)
  }, [activeTab])

  useEffect(() => {
    if (mesModalId === null || !rows?.data) return
    if (!rows.data.some((r) => r.id === mesModalId)) {
      setMesModalId(null)
    }
  }, [rows, mesModalId])

  useEffect(() => {
    if (!areaUsesMesActivasSubTabs(area) || activeTab !== "activas" || !rows?.data.length) return
    if (mesActivasSubTabAutoPickedRef.current) return
    mesActivasSubTabAutoPickedRef.current = true
    const hasProduccion = rows.data.some(
      (o) => mesActivasBucketFromRow(area, o, mesBandNowMs) === "produccion",
    )
    if (hasProduccion) {
      setMesActivasSubTab("produccion")
    }
  }, [area, activeTab, rows, mesBandNowMs])

  function areaProgressLabel(
    row: WorkOrderListRow,
    mesBand: ReturnType<typeof mesBandFromWorkOrderRow> | null,
  ): string {
    return processStateForAreaBandeja(area, row, mesBand?.workflow ?? null)
  }

  function openUrl(woId: number): string {
    if (area === "printing") {
      return `/ordenes-trabajo/${woId}/produccion?tab=printing`
    }
    if (area === "laminacion") {
      return `/ordenes-trabajo/${woId}/produccion?tab=laminacion`
    }
    if (area === "montaje") {
      return `/ordenes-trabajo/${woId}/produccion?tab=montaje`
    }
    if (area === "corte") {
      return `/ordenes-trabajo/${woId}/produccion?tab=corte`
    }
    const tab = TAB_BY_AREA[area]
    return `/ordenes-trabajo/${woId}?tab=${encodeURIComponent(tab)}`
  }

  function openPlanillaPreview(row: WorkOrderListRow) {
    const form = technicalFormRecord(row)
    if (!form) {
      toast.error(`Esta OT no tiene datos de ${planillaPreviewAreaLabel(area)} para la vista previa.`)
      return
    }
    if (!canOpenPlanillaPreviewForArea(area, form)) {
      toast.error(
        `La vista previa de planilla está disponible tras «Finalizar área de ${planillaPreviewAreaLabel(area)}».`,
      )
      return
    }
    const source = {
      work_order_id: row.id,
      work_order_code: row.code,
      client: row.client?.name ?? null,
      product: row.product?.name ?? null,
      form,
      technical_document: row.technical_document ?? undefined,
      board_stage: row.board_stage ?? area,
    }
    const ok =
      area === "printing"
        ? openPrintingPlanillaPreviewFromSource(source)
        : area === "laminacion"
          ? openLaminacionPlanillaPreviewFromSource(source)
          : area === "corte"
            ? openCortePlanillaPreviewFromSource(source)
            : false
    if (!ok) {
      toast.error("No se pudo abrir la vista previa de planilla.")
    }
  }

  const AreaIcon = AREA_ICON[area]

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

  const filterHintBody = (
    <>
      La búsqueda filtra por código OT, referencia, cliente o producto al escribir.{" "}
      <span className="font-medium text-foreground/85">Estado OT</span> es abierta / completada / cancelada de la orden
      (no el icono de reloj de solicitud al área en la tabla).
      {hasTimerColumn ? (
        <>
          {" "}
          Los botones de cronómetro (Sin iniciar, Turno abierto, etc.) filtran solo las filas de la página actual.
        </>
      ) : null}
    </>
  )

  const filterHint = hasTimerColumn ? (
    <p className="text-muted-foreground max-sm:hidden flex items-start gap-2 text-xs leading-relaxed sm:text-sm">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>{filterHintBody}</span>
    </p>
  ) : (
    <p className="text-muted-foreground mt-1 flex items-start gap-2 border-t border-border/60 pt-3 text-xs md:col-span-12 lg:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>{filterHintBody}</span>
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
      id={`a-q-${area}`}
      label="Ref. pedido cliente"
      placeholder="Código OT, referencia, cliente…"
      value={qInput}
      onChange={(ev) => setQInput(ev.target.value)}
      className="min-w-0"
    />
  )

  const pagination = rows ? (
    <BandejaTablePagination
      rows={rows}
      page={page}
      perPage={perPage}
      loading={loading}
      onPageChange={setPage}
      onPerPageChange={(n) => {
        if (BANDEJA_PER_PAGE_OPTIONS.includes(n as (typeof BANDEJA_PER_PAGE_OPTIONS)[number])) {
          setPerPage(n)
        }
      }}
    />
  ) : null

  return (
    <CatalogPageShell
      title={areaTitle(area)}
      subtitle={areaSubtitle(area)}
      icon={AreaIcon}
      className={hasTimerColumn ? "!p-0 md:!p-0 space-y-5" : undefined}
    >
      <>
        <Dialog
          open={hasTimerColumn && mesModalId !== null}
          onOpenChange={(open) => {
            if (!open) setMesModalId(null)
          }}
        >
          <DialogContent
            className={cn(
              "max-h-[min(88vh,680px)] gap-0 overflow-y-auto",
              area === "printing" || area === "montaje" ? "sm:max-w-xl" : "sm:max-w-lg",
            )}
          >
            <DialogHeader className="space-y-2 pb-2 pr-8">
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                Tiempos — {mesModalRow?.code ?? (mesModalId ? `OT #${mesModalId}` : "—")}
              </DialogTitle>
              <DialogDescription>
                {area === "printing"
                  ? "Cronómetro, arranque, desmontaje y paradas (misma lógica que Producción → Impresión)."
                  : area === "montaje"
                    ? "Cronómetro, arranque, operación, desmontaje, kg y paradas (misma lógica que Producción → Montaje)."
                    : "Tiempos acumulados de la OT según el último guardado en el servidor."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {mesModalId !== null && !mesModalRow ? (
                <p className="text-muted-foreground text-sm">
                  Esta OT no está en la página actual del listado. Cierre el cuadro o navegue en el listado hasta
                  encontrarla.
                </p>
              ) : area === "printing" && mesModalRow ? (
                <PrintingMesBandejaTimesPanel
                  row={mesModalRow}
                  mesBand={mesModalBand}
                  nowMs={mesBandNowMs}
                />
              ) : area === "montaje" && mesModalRow ? (
                <MontajeMesBandejaTimesPanel
                  row={mesModalRow}
                  mesBand={mesModalBand}
                  nowMs={mesBandNowMs}
                />
              ) : mesModalBand ? (
                <MesBandejaTimesModalBody mesBand={mesModalBand} />
              ) : mesModalRow ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  La OT no está en etapa {mesAreaDisplayName(area as MesBandejaAreaKey)} en el tablero. Abra la OT en
                  Producción para iniciar o continuar el temporizador.
                </p>
              ) : null}
            </div>
            <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              {mesModalId !== null ? (
                <Button asChild className="w-full sm:w-auto">
                  <Link to={openUrl(mesModalId)} onClick={() => setMesModalId(null)}>
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
            <span className="text-muted-foreground font-normal tabular-nums">({displayTotalActivas})</span>
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
            {historialTabLabel(area)}
          </TabsTrigger>
        </TabsList>

        {hasTimerColumn ? (
          <MesBandejaFiltersPanel
            className="mt-4"
            activeFilterCount={activeServerFilterCount}
            onClear={clearBandejaFilters}
            criteriaRow={bandejaCriteriaRow}
            searchFields={bandejaSearchFields}
            hint={filterHint}
          />
        ) : (
          <div className={cn(catalogFilterPanelClass, "mt-4 space-y-3")}>
            {bandejaCriteriaRow}
            {bandejaSearchFields}
            {filterHint}
          </div>
        )}

        <TabsContent value="activas" className="mt-4 space-y-4">
          {areaUsesMesActivasSubTabs(area) ? (
            <div className="space-y-2">
              <MesActivasSubTabsBar
                value={mesActivasSubTab}
                counts={mesActivasBucketCounts}
                areaLabel={mesActivasSubTabAreaLabel(area)}
                onChange={(v) => {
                  setMesActivasSubTab(v)
                  setMesModalId(null)
                  if (v === "produccion") {
                    mesProduccionFilterTouchedRef.current = false
                  }
                }}
              />
              {mesActivasSubTab === "produccion" ? (
                <MesBandejaProduccionWorkflowTabs
                  value={mesProduccionWorkflow}
                  counts={mesProduccionWorkflowCounts}
                  onChange={(wf) => {
                    mesProduccionFilterTouchedRef.current = true
                    setMesProduccionWorkflow(wf)
                    setMesModalId(null)
                  }}
                />
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {areaUsesMesActivasSubTabs(area) ? (
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="sm:hidden">
                  <span className="tabular-nums text-muted-foreground">{displayActivasRows.length}</span> OT
                  {mesActivasSubTab === "produccion" ? (
                    <>
                      {" · "}
                      <span className="tabular-nums text-muted-foreground">{produccionRowsOnPage.length}</span> prod.
                    </>
                  ) : null}{" "}
                  · bandeja{" "}
                  <span className="tabular-nums text-muted-foreground">{displayTotalActivas}</span>
                </span>
                <span className="hidden sm:inline">
                  <span className="tabular-nums text-muted-foreground">{displayActivasRows.length}</span> OT en esta
                  vista
                  {mesActivasSubTab === "produccion" ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className="tabular-nums text-muted-foreground">
                        {produccionRowsOnPage.length}
                      </span>{" "}
                      en «En producción» en esta página
                    </>
                  ) : null}{" "}
                  · Bandeja del área:{" "}
                  <span className="tabular-nums text-muted-foreground">{displayTotalActivas}</span>
                </span>
              </p>
            ) : hasTimerColumn ? null : (
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de este área.</span>
              </p>
            )}
            {area === "printing" ? null : (
              <Badge variant="outline" className={cn(areaRequestBadgeClass("pending"), "inline-flex items-center gap-1.5")}>
                <ClipboardList className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {`En curso: ${displayTotalActivas}`}
              </Badge>
            )}
          </div>

          <InsumosBandejaTableCard wideTable={hasTimerColumn}>
            <Table
              className={
                hasTimerColumn
                  ? mesBandejaTableClassName(
                      showProgramacionColumns
                        ? { pendientesMinWidth: mesBandejaPendientesTableMinWidth(pendientesAreaKey) }
                        : showKgBreakdown,
                    )
                  : undefined
              }
            >
              {hasTimerColumn ? (
                <MesBandejaTableColgroup
                  showKgBreakdown={showKgBreakdown}
                  variant={
                    showProgramacionColumns
                      ? undefined
                      : showKgBreakdown
                        ? "produccion-kg"
                        : "produccion"
                  }
                  pendientesArea={showProgramacionColumns ? pendientesAreaKey : undefined}
                  pendientesAreaColumnCount={showProgramacionColumns ? pendientesAreaCols : 0}
                />
              ) : null}
              <TableHeader>
                <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                  {hasTimerColumn ? (
                    showProgramacionColumns ? (
                      <>
                        <MesBandejaRowIndexHeadCell />
                        <TableHead className={mesBandejaStickyOtHeadClass}>
                          <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                        </TableHead>
                        <MesBandejaProgramacionTableHeadCells />
                        <MesBandejaAreaPendientesTableHeadCells area={pendientesAreaKey} />
                      </>
                    ) : (
                      <>
                        <MesBandejaTableHeaderCells />
                        {showKgBreakdown ? (
                          <>
                            <MesBandejaBobinasHeadCell />
                            <MesBandejaKgTableHeadCells />
                          </>
                        ) : null}
                      </>
                    )
                  ) : (
                    <>
                      <TableHead className={cn(insumosBandejaTableHeadClassName, "pl-5")}>
                        <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                      </TableHead>
                      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                        <BandejaTableHeadLabel icon={CircleDot}>Estado</BandejaTableHeadLabel>
                      </TableHead>
                    </>
                  )}
                  <MesBandejaTableHeadMaterialAcciones />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={bandejaActivasColSpan}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={bandejaActivasColSpan}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Sin solicitudes.
                    </TableCell>
                  </TableRow>
                ) : areaUsesMesActivasSubTabs(area) && displayActivasRows.length === 0 ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={bandejaActivasColSpan}
                      className="text-muted-foreground py-10 text-center"
                    >
                      {mesActivasSubTab === "produccion"
                        ? `Ninguna OT en «${mesBandejaWorkflowTitle(mesProduccionWorkflow)}» en esta página. Elija otro estado o cambie de página.`
                        : `Ninguna OT en «${MES_ACTIVAS_SUB_TAB_LABEL[mesActivasSubTab]}» en esta página. Pruebe otra vista o otra página del listado.`}
                    </TableCell>
                  </TableRow>
                ) : (
                  (areaUsesMesActivasSubTabs(area) ? displayActivasRows : rows.data).map((o, idx) => {
                    const reqStatus = resolveAreaRequestStatusForTab(o, "activas") ?? "pending"
                    const mesBand = hasTimerColumn
                      ? mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)
                      : null
                    const rowAccent = showProgramacionColumns
                      ? bandejaProgramacionRowAccentClass(readBandejaProgramacion(o).priority)
                      : mesBand
                        ? mesBandejaRowAccentClass(mesBand.workflow)
                        : ""
                    const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                    const planillaPreviewForm = PLANILLA_PREVIEW_AREAS.has(area) ? technicalFormRecord(o) : null
                    const planillaPreviewEnabled = canOpenPlanillaPreviewForArea(area, planillaPreviewForm)
                    const rowNumber = mesBandejaRowNumber(page, rows?.per_page ?? perPage, idx)
                    const bobinasDevoluciones = showKgBreakdown
                      ? mesBandejaDevolucionesFromWorkOrderRow(area as MesBandejaAreaKey, o)
                      : null
                    const bobinasExpanded = expandedBobinasOtId === o.id
                    return (
                      <Fragment key={o.id}>
                      <TableRow className={insumosBandejaDataRowClassName(idx, rowAccent)}>
                        {hasTimerColumn ? (
                          showProgramacionColumns ? (
                            <>
                              <MesBandejaRowIndexDataCell rowNumber={rowNumber} />
                              <TableCell className={mesBandejaStickyOtCellClass}>
                                <div className="flex">
                                  <Link to={openUrl(o.id)} className={mesBandejaOtLinkClassName}>
                                    {o.code}
                                  </Link>
                                </div>
                              </TableCell>
                              <MesBandejaProgramacionTableRowCells row={o} />
                              <MesBandejaAreaPendientesTableRowCells row={o} area={pendientesAreaKey} />
                            </>
                          ) : (
                            <>
                              <MesBandejaRowIndexDataCell rowNumber={rowNumber} />
                              <TableCell className={mesBandejaStickyOtCellClass}>
                                <div className="flex">
                                  <Link to={openUrl(o.id)} className={mesBandejaOtLinkClassName}>
                                    {o.code}
                                  </Link>
                                </div>
                              </TableCell>
                              <MesBandejaEstadoProduccionCell
                                mesBand={mesBand}
                                reqStatus={reqStatus}
                                areaProgressLabelText={areaProgressLabel(o, mesBand)}
                              />
                              <TableCell className={mesBandejaIconColumnCellClass}>
                                <MesBandejaTimerCell mesBand={mesBand} onOpenDetail={() => setMesModalId(o.id)} />
                              </TableCell>
                              <MesBandejaTurnoRegistradoDataCell
                                area={area}
                                mesBand={mesBand}
                                workOrder={o}
                              />
                              {showKgBreakdown ? (
                                <>
                                  <MesBandejaBobinasDataCell
                                    devoluciones={bobinasDevoluciones}
                                    expanded={bobinasExpanded}
                                    onToggle={() =>
                                      setExpandedBobinasOtId((cur) => (cur === o.id ? null : o.id))
                                    }
                                  />
                                  <MesBandejaKgTableRowCells mesBand={mesBand} />
                                </>
                              ) : null}
                            </>
                          )
                        ) : (
                          <>
                            <TableCell className="pl-5 align-middle">
                              <Link to={openUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                                {o.code}
                              </Link>
                            </TableCell>
                            <TableCell className="align-middle">
                              <AreaRequestStatusIcon status={reqStatus} />
                            </TableCell>
                          </>
                        )}
                        <BandejaMaterialCell order={o} materialTitle={materialTitle} />
                        <MesBandejaAccionesCell
                          area={area}
                          openUrl={openUrl}
                          workOrderId={o.id}
                          planillaPreviewEnabled={planillaPreviewEnabled}
                          onPlanillaPreview={() => openPlanillaPreview(o)}
                        />
                      </TableRow>
                      {showKgBreakdown && bobinasExpanded && bobinasDevoluciones ? (
                        <TableRow className="bg-muted/15 hover:bg-muted/20">
                          <TableCell colSpan={mesBandejaColCount} className="py-3 pl-3 pr-3">
                            <MesBandejaBobinasExpandPanel
                              devoluciones={bobinasDevoluciones}
                              workOrderCode={o.code}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
              {showKgBreakdown && !showProgramacionColumns && activasKgTotals && activasTableRows.length > 0 && !loading ? (
                <TableFooter className="border-t-0 bg-transparent [&>tr]:border-0 [&>tr]:hover:bg-transparent">
                  <MesBandejaKgTableTotalsRow
                    totals={activasKgTotals}
                    devolucionesTotals={activasDevolucionesTotals}
                  />
                </TableFooter>
              ) : null}
            </Table>
          </InsumosBandejaTableCard>
          {pagination}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                {area === "montaje"
                  ? "Archivo de OT con solicitud cerrada al área o montaje MES finalizado. Las finalizadas en producción también aparecen en En curso → Finalizadas."
                  : "Archivo de OT con solicitud cerrada al área o área MES finalizada. Misma etiqueta de producción que en En curso (p. ej. Finalizado)."}
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

          <InsumosBandejaTableCard wideTable={hasTimerColumn}>
            <Table className={hasTimerColumn ? mesBandejaTableClassName(showKgBreakdown) : undefined}>
              {hasTimerColumn ? <MesBandejaTableColgroup showKgBreakdown={showKgBreakdown} /> : null}
              <TableHeader>
                <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                  {hasTimerColumn ? (
                    <>
                      <MesBandejaTableHeaderCells />
                      {showKgBreakdown ? (
                        <>
                          <MesBandejaBobinasHeadCell />
                          <MesBandejaKgTableHeadCells />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <TableHead className={cn(insumosBandejaTableHeadClassName, "pl-5")}>
                        <BandejaTableHeadLabel icon={ClipboardList}>Orden de trabajo</BandejaTableHeadLabel>
                      </TableHead>
                      <TableHead className={cn(insumosBandejaTableHeadClassName, "px-2")}>
                        <BandejaTableHeadLabel icon={CircleDot}>Estado</BandejaTableHeadLabel>
                      </TableHead>
                    </>
                  )}
                  <MesBandejaTableHeadMaterialAcciones />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={bandejaHistorialColSpan}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableCell
                      colSpan={bandejaHistorialColSpan}
                      className="text-muted-foreground py-10 text-center"
                    >
                      Sin solicitudes.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o, idx) => {
                    const reqStatus = resolveAreaRequestStatusForTab(o, "historial")
                    const reqCreatedAt = areaRequestCreatedAtFromRow(o)
                    const mesBand = hasTimerColumn
                      ? mesBandFromWorkOrderRow(area as MesBandejaAreaKey, o, mesBandNowMs)
                      : null
                    const rowAccent = mesBand ? mesBandejaRowAccentClass(mesBand.workflow) : ""
                    const materialTitle = [o.product?.name, o.client?.name].filter(Boolean).join(" · ") || "—"
                    const planillaPreviewForm = PLANILLA_PREVIEW_AREAS.has(area) ? technicalFormRecord(o) : null
                    const planillaPreviewEnabled = canOpenPlanillaPreviewForArea(area, planillaPreviewForm)
                    const rowNumber = mesBandejaRowNumber(page, rows?.per_page ?? perPage, idx)
                    const bobinasDevoluciones = showKgBreakdown
                      ? mesBandejaDevolucionesFromWorkOrderRow(area as MesBandejaAreaKey, o)
                      : null
                    const bobinasExpanded = expandedBobinasOtId === o.id
                    return (
                      <Fragment key={o.id}>
                      <TableRow className={insumosBandejaDataRowClassName(idx, rowAccent)}>
                        {hasTimerColumn ? (
                          <>
                            <MesBandejaRowIndexDataCell rowNumber={rowNumber} />
                            <TableCell className={mesBandejaStickyOtCellClass}>
                              <div className="flex">
                                <Link to={openUrl(o.id)} className={mesBandejaOtLinkClassName}>
                                  {o.code}
                                </Link>
                              </div>
                            </TableCell>
                            <MesBandejaEstadoProduccionCell
                              mesBand={mesBand}
                              reqStatus={reqStatus ?? "pending"}
                              areaProgressLabelText={areaProgressLabel(o, mesBand)}
                            />
                            <TableCell className={mesBandejaIconColumnCellClass}>
                              <MesBandejaTimerCell
                                mesBand={mesBand}
                                onOpenDetail={() => setMesModalId(o.id)}
                              />
                              {mesBand?.workflow === "finalizado" || reqCreatedAt ? (
                                <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
                                  {mesBand?.workflow === "finalizado" ? "Área MES finalizada en esta OT." : null}
                                  {reqCreatedAt ? (
                                    <span>
                                      {mesBand?.workflow === "finalizado" ? " " : null}
                                      Sol. {new Date(reqCreatedAt).toLocaleDateString()}
                                    </span>
                                  ) : null}
                                </p>
                              ) : null}
                            </TableCell>
                            <MesBandejaTurnoRegistradoDataCell
                              area={area}
                              mesBand={mesBand}
                              workOrder={o}
                            />
                            {showKgBreakdown ? (
                              <>
                                <MesBandejaBobinasDataCell
                                  devoluciones={bobinasDevoluciones}
                                  expanded={bobinasExpanded}
                                  onToggle={() =>
                                    setExpandedBobinasOtId((cur) => (cur === o.id ? null : o.id))
                                  }
                                />
                                <MesBandejaKgTableRowCells mesBand={mesBand} />
                              </>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <TableCell className="pl-5 align-middle">
                              <Link to={openUrl(o.id)} className={insumosBandejaIdLinkClassName}>
                                {o.code}
                              </Link>
                            </TableCell>
                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-2">
                                <AreaRequestStatusIcon status={reqStatus} />
                                <div className="text-muted-foreground text-xs leading-snug">
                                  <span className="text-foreground/90">{areaProgressLabel(o, mesBand)}</span>
                                  {reqCreatedAt ? (
                                    <span>
                                      {" "}
                                      · Sol. {new Date(reqCreatedAt).toLocaleDateString()}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </TableCell>
                          </>
                        )}
                        <BandejaMaterialCell order={o} materialTitle={materialTitle} />
                        <MesBandejaAccionesCell
                          area={area}
                          openUrl={openUrl}
                          workOrderId={o.id}
                          planillaPreviewEnabled={planillaPreviewEnabled}
                          onPlanillaPreview={() => openPlanillaPreview(o)}
                        />
                      </TableRow>
                      {showKgBreakdown && bobinasExpanded && bobinasDevoluciones ? (
                        <TableRow className="bg-muted/15 hover:bg-muted/20">
                          <TableCell colSpan={mesBandejaColCount} className="py-3 pl-3 pr-3">
                            <MesBandejaBobinasExpandPanel
                              devoluciones={bobinasDevoluciones}
                              workOrderCode={o.code}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                      </Fragment>
                    )
                  })
                )}
              </TableBody>
              {showKgBreakdown && historialKgTotals && (rows?.data.length ?? 0) > 0 && !loading ? (
                <TableFooter className="border-t-0 bg-transparent [&>tr]:border-0 [&>tr]:hover:bg-transparent">
                  <MesBandejaKgTableTotalsRow
                    totals={historialKgTotals}
                    devolucionesTotals={historialDevolucionesTotals}
                  />
                </TableFooter>
              ) : null}
            </Table>
          </InsumosBandejaTableCard>

          {pagination}
        </TabsContent>
      </Tabs>
      </>
    </CatalogPageShell>
  )
}
