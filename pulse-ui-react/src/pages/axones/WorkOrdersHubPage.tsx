"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react"
import { createSearchParams, Link, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import {
  Ban,
  Barcode,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Eye,
  Factory,
  FilePenLine,
  GitBranch,
  Layers,
  ListOrdered,
  Package,
  Scale,
  Scissors,
  Settings2,
  UserCircle,
  Users,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import { MES_CONTROL_SAVED_EVENTS } from "@/lib/area-mes-band-helpers"
import { groupWorkOrdersForHub, latestRowInGroup, sumPedidoKgDisplay } from "@/lib/axones-work-order-grouping"
import {
  classifyWorkOrderHubRow,
  hubBucketEtapaHint,
  hubBucketMatchesFilter,
  type HubSupervisorBucket,
  type HubSupervisorFilter,
} from "@/lib/work-order-hub-supervisor"
import { CLIENT_ORDER_MODULE_LIST_FOCUS } from "@/pages/axones/client-order-i18n"
import type {
  ClientOrderDetailRecord,
  ClientOrderRow,
  LaravelPaginated,
  WorkOrderListRow,
} from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import {
  CatalogTableHead,
  CatalogTableHeadRight,
} from "@/components/axones/CatalogTableHead"
import {
  catalogActionButtonClass,
  catalogSelectTriggerClass,
  catalogTableBodyCellClass,
  catalogTableBodyRowClass,
  catalogTableHeaderRowClass,
} from "@/components/axones/catalog-list-classes"
import { InlineSpinner, LoadingTableRow, PageLoadingBlock } from "@/components/axones/LoadingStates"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const WO_SEARCH_DEBOUNCE_MS = 320

type MachineValue =
  | ""
  | "COMEXI 1"
  | "COMEXI 3"
  | "Cortadora China"
  | "Cortadora Permaco"

const MACHINE_OPTIONS: Array<{
  group: string
  options: Array<{ value: Exclude<MachineValue, "">; label: string }>
}> = [
  {
    group: "Impresión",
    options: [
      { value: "COMEXI 1", label: "COMEXI 1" },
      { value: "COMEXI 3", label: "COMEXI 3" },
    ],
  },
  {
    group: "Laminación",
    options: [
      { value: "Cortadora China", label: "Cortadora China" },
      { value: "Cortadora Permaco", label: "Cortadora Permaco" },
    ],
  },
]

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

// Estas funciones extraen y formatean información de la orden respecto a la máquina y los kilogramos pedidos.
// Sirven para mostrar estos valores en la tabla principal de las Órdenes de Trabajo. Si no existe el dato, devuelven "—" para dejar la celda vacía y explícita.

function formMachine(row: WorkOrderListRow): string {
  // Intenta acceder al campo 'maquina' dentro de 'technical_document.form'
  const doc = row.technical_document?.form
  if (!doc) return "—" // Si no existe la estructura, regresa "—"
  const m = readString(doc.maquina) // Normaliza a string por si acaso el formato es extraño
  return m || "—" // Si hay máquina la devuelve, sino "—"
}

function formPedidoKg(row: WorkOrderListRow): string {
  // Accede al campo 'pedidoKg' dentro de 'technical_document.form'
  const doc = row.technical_document?.form
  if (!doc) return "—" // Si no existe, regresa "—"
  const v = doc.pedidoKg
  // Si es número, lo convierte a string. Si es string no vacío, lo deja igual. Sino, regresa "—".
  if (typeof v === "number") return String(v)
  if (typeof v === "string" && v.trim()) return v.trim()
  return "—"
}


function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  } catch {
    return iso
  }
}

type SupervisorFilter = HubSupervisorFilter

function statusLabel(value: string | null | undefined): string {
  const statuses: Record<string, string> = {
    open: "Abierta",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
  }
  const key = (value ?? "").toLowerCase().trim()
  return statuses[key] ?? (value?.trim() || "—")
}

function boardStageLabel(value: string | null | undefined): string {
  const stages: Record<string, string> = {
    nueva: "Creada (registrada, no procesada)",
    pendiente: "Programación",
    montaje: "Montaje",
    impresion: "Impresión",
    laminacion: "Laminación",
    corte: "Corte / Embalaje",
    completada: "Completada",
  }
  const key = (value ?? "").toLowerCase().trim()
  return stages[key] ?? (value?.trim() || "—")
}

function canPreviewPlanillaReport(row: WorkOrderListRow): boolean {
  const s = (row.status ?? "").toLowerCase().trim()
  return s !== "completed" && s !== "cancelled"
}

const SUPERVISOR_BUCKET_STYLES: Record<
  HubSupervisorBucket,
  {
    tabActive: string
    tabInactive: string
    iconClass: string
    iconClassActive: string
    rowBorder: string
    rowBg: string
    badgeClass: string
    badgeLabel: string
    BadgeIcon: LucideIcon
  }
> = {
  registered: {
    tabActive:
      "border-2 border-sky-600/50 bg-sky-500/12 text-foreground shadow-sm",
    tabInactive:
      "border border-border/80 bg-background text-muted-foreground border-l-[3px] border-l-sky-500/40",
    iconClass: "text-sky-700 dark:text-sky-300",
    iconClassActive: "text-sky-800 dark:text-sky-200",
    rowBorder: "border-l-sky-600/65",
    rowBg: "bg-sky-500/[0.06]",
    badgeClass:
      "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-sky-950 dark:text-sky-100 border-sky-500/30 bg-sky-500/10",
    badgeLabel: "Registrada",
    BadgeIcon: FilePenLine,
  },
  in_progress: {
    tabActive:
      "border-2 border-amber-600/45 bg-amber-500/12 text-foreground shadow-sm",
    tabInactive:
      "border border-border/80 bg-background text-muted-foreground border-l-[3px] border-l-amber-500/40",
    iconClass: "text-amber-800 dark:text-amber-300",
    iconClassActive: "text-amber-900 dark:text-amber-200",
    rowBorder: "border-l-amber-600/55",
    rowBg: "bg-amber-500/[0.06]",
    badgeClass:
      "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-amber-950 dark:text-amber-100 border-amber-500/30 bg-amber-500/10",
    badgeLabel: "En curso",
    BadgeIcon: Factory,
  },
  closed: {
    tabActive:
      "border-2 border-teal-600/45 bg-teal-500/12 text-foreground shadow-sm",
    tabInactive:
      "border border-border/80 bg-background text-muted-foreground border-l-[3px] border-l-teal-500/38",
    iconClass: "text-teal-700 dark:text-teal-300",
    iconClassActive: "text-teal-800 dark:text-teal-200",
    rowBorder: "border-l-teal-600/58",
    rowBg: "bg-teal-500/[0.055]",
    badgeClass:
      "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-teal-950 dark:text-teal-100 border-teal-500/28 bg-teal-500/10",
    badgeLabel: "Cerrada",
    BadgeIcon: Scissors,
  },
  closed_complete: {
    tabActive:
      "border-2 border-emerald-600/45 bg-emerald-500/12 text-foreground shadow-sm",
    tabInactive:
      "border border-border/80 bg-background text-muted-foreground border-l-[3px] border-l-emerald-500/38",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    iconClassActive: "text-emerald-800 dark:text-emerald-200",
    rowBorder: "border-l-emerald-600/58",
    rowBg: "bg-emerald-500/[0.055]",
    badgeClass:
      "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-emerald-950 dark:text-emerald-100 border-emerald-500/28 bg-emerald-500/10",
    badgeLabel: "Cerrada completada",
    BadgeIcon: CheckCircle2,
  },
  cancelled: {
    tabActive: "",
    tabInactive: "",
    iconClass: "text-muted-foreground",
    iconClassActive: "text-muted-foreground",
    rowBorder: "border-l-muted-foreground/45",
    rowBg: "bg-muted/30",
    badgeClass:
      "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground",
    badgeLabel: "Cancelada",
    BadgeIcon: Ban,
  },
}

const ALL_TAB_STYLES = {
  tabActive:
    "border-2 border-primary/45 bg-primary/10 text-foreground shadow-sm",
  tabInactive:
    "border border-border/80 bg-background text-muted-foreground border-l-[3px] border-l-primary/35",
  iconIdle: "text-primary",
  iconActive: "text-primary",
}

const SUPERVISOR_TAB_DEFS: Array<{
  filter: SupervisorFilter
  label: string
  Icon: LucideIcon
}> = [
  { filter: "all", label: "Todas", Icon: Layers },
  { filter: "registered", label: "Registradas", Icon: FilePenLine },
  { filter: "in_progress", label: "En curso", Icon: Factory },
  { filter: "closed", label: "Cerrada", Icon: Scissors },
  { filter: "closed_complete", label: "Cerrada completada", Icon: CheckCircle2 },
]

const SUPERVISOR_TAB_BTN_CLASS =
  "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function workOrderRowAccent(row: WorkOrderListRow, nowMs: number): {
  rowClass: string
  badgeClass: string
  badgeLabel: string
  BadgeIcon: LucideIcon
} {
  const bucket = classifyWorkOrderHubRow(row, nowMs)
  const s = SUPERVISOR_BUCKET_STYLES[bucket]
  return {
    rowClass: cn("border-l-4", s.rowBorder, s.rowBg),
    badgeClass: s.badgeClass,
    badgeLabel: s.badgeLabel,
    BadgeIcon: s.BadgeIcon,
  }
}

function formatEtapaCell(row: WorkOrderListRow, nowMs: number): ReactNode {
  const hint = hubBucketEtapaHint(classifyWorkOrderHubRow(row, nowMs))
  const base = boardStageLabel(row.board_stage)
  if (!hint) return base
  return (
    <div className="flex flex-col gap-0.5">
      <span>{base}</span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  )
}

type HubWorkOrderTableRowProps = {
  row: WorkOrderListRow
  mesNow: number
  numCell: ReactNode
  accent: {
    rowClass: string
    badgeClass: string
    badgeLabel: string
    BadgeIcon: LucideIcon
  }
  nested?: boolean
  canDeactivate: boolean
  onDeactivateClick: (row: WorkOrderListRow) => void
}

function HubWorkOrderTableRow({
  row: o,
  mesNow,
  numCell,
  accent,
  nested,
  canDeactivate,
  onDeactivateClick,
}: HubWorkOrderTableRowProps) {
  const RowBadgeIcon = accent.BadgeIcon
  return (
    <TableRow
      className={cn(
        "text-sm",
        catalogTableBodyRowClass,
        accent.rowClass,
        nested && "bg-muted/25",
      )}
    >
      <TableCell className={cn("min-w-[9rem] align-top", catalogTableBodyCellClass)}>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          {numCell}
          <Badge
            variant="outline"
            className={cn("w-fit shrink-0 font-normal tabular-nums", accent.badgeClass)}
          >
            <RowBadgeIcon className="h-3 w-3 shrink-0" aria-hidden />
            {accent.badgeLabel}
          </Badge>
        </div>
      </TableCell>
      <TableCell className={cn("font-mono text-sm", catalogTableBodyCellClass)}>{o.code}</TableCell>
      <TableCell className={cn(catalogTableBodyCellClass)}>{formatDate(o.document_date)}</TableCell>
      <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>{o.client?.name ?? "—"}</TableCell>
      <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>{o.product?.name ?? "—"}</TableCell>
      <TableCell className={cn(catalogTableBodyCellClass)}>{formMachine(o)}</TableCell>
      <TableCell className={cn(catalogTableBodyCellClass)}>
        {formatEtapaCell(o, mesNow)}
      </TableCell>
      <TableCell className={cn(catalogTableBodyCellClass)}>{statusLabel(o.status)}</TableCell>
      <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>{o.creator?.name ?? "—"}</TableCell>
      <TableCell className={cn(catalogTableBodyCellClass)}>{formPedidoKg(o)}</TableCell>
      <TableCell className={cn("whitespace-nowrap text-right", catalogTableBodyCellClass)}>
        <div className="inline-flex flex-wrap justify-end gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn("shrink-0", catalogActionButtonClass)}
                aria-label="Editar OT"
                asChild
              >
                <Link to={`/ordenes-trabajo/${o.id}`}>
                  <FilePenLine className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Editar OT (abrir formulario para completar o ajustar datos).
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={cn("shrink-0", catalogActionButtonClass)}
                aria-label="Desactivar OT"
                disabled={
                  !canDeactivate ||
                  (o.status ?? "").toLowerCase().trim() === "cancelled" ||
                  (o.status ?? "").toLowerCase().trim() === "completed"
                }
                onClick={() => {
                  if (!canDeactivate) return
                  onDeactivateClick(o)
                }}
              >
                <Ban className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {(o.status ?? "").toLowerCase().trim() === "cancelled"
                ? "Ya está desactivada (cancelada)."
                : (o.status ?? "").toLowerCase().trim() === "completed"
                  ? "No se puede desactivar una OT completada."
                  : !canDeactivate
                    ? "Solo admin o jefatura (boss) puede desactivar OT."
                    : "Desactivar (admin/boss)"}
            </TooltipContent>
          </Tooltip>
          {canPreviewPlanillaReport(o) ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className={cn("shrink-0", catalogActionButtonClass)}
                  aria-label="Vista previa del reporte"
                  asChild
                >
                  <Link to={`/ordenes-trabajo/${o.id}/vista-previa`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Vista previa del reporte de esta OT.</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function WorkOrdersHubPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const canDeactivate = role === "admin" || role === "boss"

  const [qInput, setQInput] = useState("")
  const [qApi, setQApi] = useState("")
  const qDebounceRef = useRef<number | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [supervisorFilter, setSupervisorFilter] = useState<SupervisorFilter>("all")
  const [mesNow, setMesNow] = useState(() => Date.now())

  const [coLoading, setCoLoading] = useState(false)
  const [clientOrders, setClientOrders] = useState<ClientOrderRow[]>([])
  const [clientOrderId, setClientOrderId] = useState<string>("")
  const [coDetail, setCoDetail] = useState<ClientOrderDetailRecord | null>(null)
  const [coDetailLoading, setCoDetailLoading] = useState(false)

  const [maquina, setMaquina] = useState<MachineValue>("")

  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<WorkOrderListRow | null>(null)
  const [deactivateSaving, setDeactivateSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  const canImportMaterialFromCo = useMemo(() => {
    if (!coDetail?.lines?.length) return false
    return coDetail.lines.some(
      (l) => l.material_id != null && !Number.isNaN(Number(l.material_id)) && Number(l.material_id) > 0,
    )
  }, [coDetail])

  const prefillAppliedRef = useRef(false)
  useEffect(() => {
    if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    qDebounceRef.current = window.setTimeout(() => {
      setQApi(qInput.trim())
    }, WO_SEARCH_DEBOUNCE_MS)
    return () => {
      if (qDebounceRef.current) window.clearTimeout(qDebounceRef.current)
    }
  }, [qInput])

  useEffect(() => {
    if (prefillAppliedRef.current) return
    const fromUrl = (searchParams.get("prefillCo") ?? "").trim()
    if (fromUrl && /^\d+$/.test(fromUrl)) {
      prefillAppliedRef.current = true
      setClientOrderId(fromUrl)
    }
  }, [searchParams])

  useEffect(() => {
    const id = clientOrderId.trim()
    if (!id || !/^\d+$/.test(id)) {
      setCoDetail(null)
      return
    }
    setCoDetailLoading(true)
    let cancelled = false
    void (async () => {
      try {
        const d = await apiFetch<ClientOrderDetailRecord>(`client-orders/${id}`)
        if (!cancelled) setCoDetail(d)
      } catch {
        if (!cancelled) setCoDetail(null)
      } finally {
        if (!cancelled) setCoDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientOrderId])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
        query: {
          page,
          per_page: 20,
          q: qApi || undefined,
          include_area_summaries: "tintas",
        },
      })
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes de trabajo.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [page, qApi])

  const loadClientOrders = useCallback(async () => {
    setCoLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<ClientOrderRow>>("client-orders", {
        query: { per_page: 100, page: 1, sort: "asc" },
      })
      setClientOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error(`No se pudieron cargar las ${CLIENT_ORDER_MODULE_LIST_FOCUS}.`)
      setClientOrders([])
    } finally {
      setCoLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    const tick = window.setInterval(() => setMesNow(Date.now()), 5000)
    const onMesSaved = () => setMesNow(Date.now())
    for (const ev of Object.values(MES_CONTROL_SAVED_EVENTS)) {
      window.addEventListener(ev, onMesSaved)
    }
    return () => {
      window.clearInterval(tick)
      for (const ev of Object.values(MES_CONTROL_SAVED_EVENTS)) {
        window.removeEventListener(ev, onMesSaved)
      }
    }
  }, [])

  const showInitialSkeleton = loading && rows === null

  const visibleRows = useMemo(() => {
    const all = rows?.data ?? []
    if (supervisorFilter === "all") return all
    return all.filter((r) =>
      hubBucketMatchesFilter(classifyWorkOrderHubRow(r, mesNow), supervisorFilter),
    )
  }, [rows?.data, supervisorFilter, mesNow])

  const groupedVisible = useMemo(() => groupWorkOrdersForHub(visibleRows), [visibleRows])

  const supervisorCounts = useMemo(() => {
    const all = rows?.data ?? []
    const countFor = (filter: HubSupervisorFilter) => {
      if (filter === "all") return all.length
      return all.filter((r) =>
        hubBucketMatchesFilter(classifyWorkOrderHubRow(r, mesNow), filter),
      ).length
    }
    return {
      all: all.length,
      registered: countFor("registered"),
      in_progress: countFor("in_progress"),
      closed: countFor("closed"),
      closed_complete: countFor("closed_complete"),
    }
  }, [rows?.data, mesNow])

  function clientOrderLabel(c: ClientOrderRow): string {
    const parts = [c.code, c.client?.name, c.first_line_with_product?.product?.name]
      .map((p) => (typeof p === "string" && p.trim() ? p.trim() : null))
      .filter((p): p is string => Boolean(p))
    return parts.length ? parts.join(" — ") : c.code
  }

  function createOt() {
    const coId = clientOrderId.trim() ? Number(clientOrderId) : null
    if (!coId || !Number.isFinite(coId) || coId < 1) {
      toast.error("Seleccione un pedido cliente (OC) ya registrado.")
      return
    }
    const importMaterial = canImportMaterialFromCo
    const params: Record<string, string> = {
      client_order_id: String(coId),
      import_material: importMaterial ? "1" : "0",
    }
    if (maquina) params.maquina = maquina
    nav({ pathname: "/ordenes-trabajo/nueva", search: `?${createSearchParams(params)}` })
  }

  const rowPageBase = rows ? (rows.current_page - 1) * rows.per_page : 0

  async function submitDeactivate() {
    const target = deactivateTarget
    if (!target) return
    setDeactivateSaving(true)
    try {
      await apiFetch(`work-orders/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      })
      toast.success("OT desactivada (cancelada).")
      setDeactivateOpen(false)
      setDeactivateTarget(null)
      void loadList()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo desactivar la OT.")
    } finally {
      setDeactivateSaving(false)
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <CatalogPageShell
        title="Órdenes de trabajo"
        subtitle="Lista, creación desde pedido cliente (OC) y acceso a planillas."
        icon={ClipboardList}
      >
        <Dialog
          open={deactivateOpen}
          onOpenChange={(open) => {
            setDeactivateOpen(open)
            if (!open) {
              setDeactivateTarget(null)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Desactivar OT {deactivateTarget?.code ?? ""}
              </DialogTitle>
              <DialogDescription>
                Esta acción marca la OT como <strong>Cancelada</strong>. Solo usuarios admin pueden desactivar OT.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeactivateOpen(false)}
                disabled={deactivateSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deactivateSaving}
                onClick={() => void submitDeactivate()}
              >
                Desactivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {showInitialSkeleton ? (
          <div className="space-y-4">
            <PageLoadingBlock />
            <PageLoadingBlock />
            <PageLoadingBlock />
          </div>
        ) : (
          <>
            <Card className="rounded-2xl border bg-card shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-center text-base font-semibold">
                  Crear orden de trabajo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
              <p className="md:col-span-3 text-sm text-muted-foreground">
                Elija el{" "}
                <span className="font-medium text-foreground">pedido cliente (OC)</span> y, si ya lo sabe, la{" "}
                <span className="font-medium text-foreground">máquina</span>. Al pulsar{" "}
                <span className="font-medium text-foreground">Crear orden</span> se abre la planilla en modo borrador: la OT{" "}
                <span className="font-medium text-foreground">no</span> aparece en la lista hasta que pulse{" "}
                <span className="font-medium text-foreground">Guardar orden</span> en esa pantalla.
              </p>
              <div className="grid min-w-0 gap-2 md:col-span-2">
                <Label>Pedido cliente (OC) a vincular *</Label>
                <Select
                  value={clientOrderId || undefined}
                  onValueChange={(v) => setClientOrderId(v)}
                  onOpenChange={(open) => {
                    if (open && clientOrders.length === 0 && !coLoading) void loadClientOrders()
                  }}
                >
                  <SelectTrigger
                    className={cn("h-11 w-full font-normal", catalogSelectTriggerClass)}
                  >
                    <SelectValue placeholder={coLoading ? "Cargando…" : "Seleccione…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientOrders.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {clientOrderLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clientOrderId && coDetailLoading ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <InlineSpinner />
                      Cargando...
                    </span>
                  </p>
                ) : null}
                {clientOrderId && !coDetailLoading && !coDetail ? (
                  <p className="text-sm text-destructive">
                    No se pudo cargar la información del pedido cliente (OC). Intente otra vez en unos segundos.
                  </p>
                ) : null}
              </div>

              <div className="grid min-w-0 gap-2 self-start">
                <Label>Máquina</Label>
                <select
                  className={cn(
                    "h-11 rounded-md border bg-background/95 px-3 text-sm",
                    catalogSelectTriggerClass,
                  )}
                  value={maquina}
                  onChange={(ev) => setMaquina(ev.target.value as MachineValue)}
                >
                  <option value="">Seleccionar…</option>
                  {MACHINE_OPTIONS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-center">
                <Button type="button" onClick={() => createOt()}>
                  Crear orden
                </Button>
              </div>
            </CardContent>
            </Card>

            <div
              role="tablist"
              aria-label="Filtro por etapa de supervisión"
              className="flex flex-wrap items-center gap-2"
            >
              {SUPERVISOR_TAB_DEFS.map(({ filter: f, label, Icon }) => {
                const active = supervisorFilter === f
                const count =
                  f === "all"
                    ? supervisorCounts.all
                    : supervisorCounts[f as Exclude<HubSupervisorFilter, "all">]
                if (f === "all") {
                  return (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={cn(
                        SUPERVISOR_TAB_BTN_CLASS,
                        active ? ALL_TAB_STYLES.tabActive : ALL_TAB_STYLES.tabInactive,
                      )}
                      onClick={() => setSupervisorFilter("all")}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? ALL_TAB_STYLES.iconActive : ALL_TAB_STYLES.iconIdle,
                        )}
                        aria-hidden
                      />
                      {label} ({count})
                    </button>
                  )
                }
                const st = SUPERVISOR_BUCKET_STYLES[f as HubSupervisorBucket]
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={cn(
                      SUPERVISOR_TAB_BTN_CLASS,
                      active ? st.tabActive : st.tabInactive,
                    )}
                    onClick={() => setSupervisorFilter(f)}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? st.iconClassActive : st.iconClass,
                      )}
                      aria-hidden
                    />
                    {label} ({count})
                  </button>
                )
              })}
            </div>

            <CatalogFilterGrid>
              <CatalogSearchField
                id="wo-q"
                label="Buscar orden (número / referencia / cliente)"
                placeholder="Ej: OT-2026-0007, PED-…, Millennium…"
                value={qInput}
                onChange={(ev) => {
                  setPage(1)
                  setQInput(ev.target.value)
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    const next = ev.currentTarget.value.trim()
                    setQApi(next)
                  }
                }}
                className="min-w-0 md:col-span-12"
              />
              <p className="text-muted-foreground text-xs md:col-span-12">
                El listado se actualiza al escribir (filtro con breve demora).
              </p>
            </CatalogFilterGrid>

            <p className="text-muted-foreground text-xs md:col-span-12">
              En la lista, use Acciones para editar una OT o abrir la vista previa del reporte cuando esté disponible.
            </p>

            <div className="bg-card w-full min-w-0 overflow-x-auto rounded-2xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className={catalogTableHeaderRowClass}>
                    <CatalogTableHead icon={ListOrdered} className="min-w-[9rem] whitespace-nowrap">
                      N.º
                    </CatalogTableHead>
                    <CatalogTableHead icon={Barcode} className="whitespace-nowrap">
                      Código
                    </CatalogTableHead>
                    <CatalogTableHead icon={CalendarDays} className="whitespace-nowrap">
                      Fecha
                    </CatalogTableHead>
                    <CatalogTableHead icon={Users}>Cliente</CatalogTableHead>
                    <CatalogTableHead icon={Package}>Producto</CatalogTableHead>
                    <CatalogTableHead icon={Factory}>Máquina</CatalogTableHead>
                    <CatalogTableHead icon={GitBranch}>Etapa</CatalogTableHead>
                    <CatalogTableHead icon={CircleDot}>Estado OT</CatalogTableHead>
                    <CatalogTableHead icon={UserCircle}>Creada por</CatalogTableHead>
                    <CatalogTableHead icon={Scale}>Kg</CatalogTableHead>
                    <CatalogTableHeadRight icon={Settings2} className="whitespace-nowrap">
                      Acciones
                    </CatalogTableHeadRight>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingTableRow colSpan={11} />
                  ) : !groupedVisible.length ? (
                    <TableRow className={catalogTableBodyRowClass}>
                      <TableCell
                        colSpan={11}
                        className={cn("text-muted-foreground", catalogTableBodyCellClass)}
                      >
                        Sin órdenes para este filtro.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedVisible.flatMap((g) => {
                      const idxs = g.rows
                        .map((r) => rows?.data?.findIndex((x) => x.id === r.id) ?? -1)
                        .filter((i) => i >= 0)
                      const minIdx = idxs.length ? Math.min(...idxs) : 0
                      const baseN = rowPageBase + minIdx + 1

                      if (g.rows.length === 1) {
                        const o = g.rows[0]!
                        const accent = workOrderRowAccent(o, mesNow)
                        const idxOnPage = rows?.data?.findIndex((r) => r.id === o.id) ?? -1
                        const n =
                          idxOnPage >= 0 ? rowPageBase + idxOnPage + 1 : rowPageBase + minIdx + 1
                        return (
                          <HubWorkOrderTableRow
                            key={o.id}
                            row={o}
                            mesNow={mesNow}
                            accent={accent}
                            canDeactivate={canDeactivate}
                            onDeactivateClick={(row) => {
                              setDeactivateTarget(row)
                              setDeactivateOpen(true)
                            }}
                            numCell={
                              <span className="tabular-nums text-muted-foreground text-sm">{n}</span>
                            }
                          />
                        )
                      }

                      const latest = latestRowInGroup(g.rows)
                      const accentHeader = workOrderRowAccent(latest, mesNow)
                      const open = expandedGroups[g.key] ?? false
                      const ocCode = latest.client_order?.code ?? "—"
                      const out: ReactElement[] = []

                      out.push(
                        <TableRow
                          key={`${g.key}-header`}
                          className={cn(
                            "text-sm",
                            catalogTableBodyRowClass,
                            accentHeader.rowClass,
                          )}
                        >
                          <TableCell
                            className={cn("min-w-[9rem] align-top", catalogTableBodyCellClass)}
                          >
                            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  aria-expanded={open}
                                  aria-label={open ? "Contraer detalle de OT" : "Expandir detalle de OT"}
                                  onClick={() =>
                                    setExpandedGroups((prev) => ({
                                      ...prev,
                                      [g.key]: !open,
                                    }))
                                  }
                                >
                                  {open ? (
                                    <ChevronDown className="h-4 w-4" aria-hidden />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" aria-hidden />
                                  )}
                                </Button>
                                <span className="tabular-nums text-muted-foreground text-sm">
                                  {baseN}
                                </span>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "w-fit shrink-0 font-normal tabular-nums",
                                  accentHeader.badgeClass,
                                )}
                              >
                                <Layers className="h-3 w-3 shrink-0" aria-hidden />
                                {g.rows.length} OT
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell
                            className={cn("min-w-0 font-mono text-sm", catalogTableBodyCellClass)}
                          >
                            {g.rows.length} OT · {ocCode}
                          </TableCell>
                          <TableCell className={cn(catalogTableBodyCellClass)}>
                            {formatDate(latest.document_date)}
                          </TableCell>
                          <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                            {latest.client?.name ?? "—"}
                          </TableCell>
                          <TableCell className={cn("min-w-0", catalogTableBodyCellClass)}>
                            {latest.product?.name ?? "—"}
                          </TableCell>
                          <TableCell className={cn(catalogTableBodyCellClass)}>Varias</TableCell>
                          <TableCell className={cn(catalogTableBodyCellClass)}>
                            {boardStageLabel(latest.board_stage)}
                          </TableCell>
                          <TableCell className={cn(catalogTableBodyCellClass)}>
                            {statusLabel(latest.status)}
                          </TableCell>
                          <TableCell className={cn("min-w-0 text-muted-foreground", catalogTableBodyCellClass)}>
                            —
                          </TableCell>
                          <TableCell className={cn(catalogTableBodyCellClass)}>
                            {sumPedidoKgDisplay(g.rows)}
                          </TableCell>
                          <TableCell
                            className={cn("whitespace-nowrap text-right", catalogTableBodyCellClass)}
                          >
                            <span className="text-muted-foreground text-xs">Expandir acciones</span>
                          </TableCell>
                        </TableRow>,
                      )

                      if (open) {
                        g.rows.forEach((o, j) => {
                          const accent = workOrderRowAccent(o, mesNow)
                          out.push(
                            <HubWorkOrderTableRow
                              key={o.id}
                              row={o}
                              mesNow={mesNow}
                              nested
                              accent={accent}
                              canDeactivate={canDeactivate}
                              onDeactivateClick={(row) => {
                                setDeactivateTarget(row)
                                setDeactivateOpen(true)
                              }}
                              numCell={
                                <span className="tabular-nums text-muted-foreground text-sm">
                                  {baseN}.{j + 1}
                                </span>
                              }
                            />,
                          )
                        })
                      }

                      return out
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-muted-foreground text-xs">
              Varias OT del mismo pedido cliente y producto aparecen agrupadas; use la flecha para ver cada
              código OT y sus acciones.
            </p>

            {rows && rows.last_page > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
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
            ) : null}
          </>
        )}
      </CatalogPageShell>
    </TooltipProvider>
  )
}

