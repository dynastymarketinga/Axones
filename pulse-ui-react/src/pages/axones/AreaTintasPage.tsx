"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  ClipboardList,
  Droplets,
  ExternalLink,
  History,
  Package,
  Inbox,
  ListOrdered,
  Rows3,
  Search,
  SlidersHorizontal,
  Warehouse,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { CatalogSearchField } from "@/components/axones/CatalogSearchField"
import { TintasMaterialInventoryTable } from "@/components/axones/TintasMaterialInventoryTable"
import { TintasOtWorkspace } from "@/components/axones/TintasOtWorkspace"
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
import { catalogSelectTriggerClass } from "@/components/axones/catalog-list-classes"
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
import { tintasActivasBucketFromRow, tintasMesBandFromWorkOrderRow } from "@/lib/tintas-mes-band-status"
import { cn } from "@/lib/utils"
import type { LaravelPaginated, MaterialRow, WorkOrderListRow } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
type TintasConsumoVista = "produccion" | "inventario" | "cementerio"

function tintasOtStatusLabel(status?: string | null): string {
  if (status === "open") return "Abierta"
  if (status === "completed") return "Completada"
  if (status === "cancelled") return "Cancelada"
  return status ?? "—"
}

const MI_AREA_TINTAS: MiAreaApi = "tintas"
const TINTAS_BANDEJA_MES_COLSPAN = 5

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

function tintasWorkOrderProduccionUrl(woId: number): string {
  return `/ordenes-trabajo/${woId}/produccion?tab=tintas`
}

export default function AreaTintasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = getStoredUser()
  const [mode, setMode] = useState<"list" | "consumo">(() =>
    searchParams.get("ot") || searchParams.get("vista") ? "consumo" : "list",
  )
  const [consumoVista, setConsumoVista] = useState<TintasConsumoVista>(() => {
    const v = searchParams.get("vista")
    if (v === "inventario" || v === "cementerio") return v
    return "produccion"
  })
  const [activeTab, setActiveTab] = useState<TintasBandejaTab>("activas")
  const [q, setQ] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [onlyPendingArea, setOnlyPendingArea] = useState(false)
  const [historialIncludePending, setHistorialIncludePending] = useState(false)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(null)
  const [totalActivas, setTotalActivas] = useState(0)
  const [unseenActivas, setUnseenActivas] = useState(0)
  const [mesBandNowMs, setMesBandNowMs] = useState(() => Date.now())
  const [mesActivasSubTab, setMesActivasSubTab] = useState<MesActivasSubTabKey>("pendientes")

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

  const [workOrders, setWorkOrders] = useState<WorkOrderListRow[]>([])
  const [woId, setWoId] = useState<string>(() => searchParams.get("ot") ?? "")
  const woNum = Number(woId)

  const [tintaMaterials, setTintaMaterials] = useState<MaterialRow[]>([])
  const [invTintas, setInvTintas] = useState<MaterialRow[]>([])
  const [invCementerio, setInvCementerio] = useState<MaterialRow[]>([])
  const [loading, setLoading] = useState(false)

  const selectedWo = useMemo(
    () => workOrders.find((w) => w.id === woNum) ?? null,
    [workOrders, woNum],
  )

  const syncConsumoUrl = useCallback(
    (nextOt: string, nextVista: TintasConsumoVista) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        if (nextOt) p.set("ot", nextOt)
        else p.delete("ot")
        if (nextVista === "produccion") p.delete("vista")
        else p.set("vista", nextVista)
        return p
      })
    },
    [setSearchParams],
  )

  const openConsumo = useCallback(
    (orderId: number, vista: TintasConsumoVista = "produccion") => {
      const id = String(orderId)
      setWoId(id)
      setMode("consumo")
      setConsumoVista(vista)
      syncConsumoUrl(id, vista)
    },
    [syncConsumoUrl],
  )

  const closeConsumo = useCallback(() => {
    setMode("list")
    setSearchParams({})
  }, [setSearchParams])

  useEffect(() => {
    if (searchParams.get("vista") !== "mezcla") return
    const el = document.getElementById("tintas-mezcla")
    if (!el) return
    const t = window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
    return () => window.clearTimeout(t)
  }, [searchParams, mode, consumoVista])

  const bandejaListFilters = useMemo((): BandejaListFilters => {
    return {
      status: status !== "all" ? status : undefined,
      client_order_reference: search || undefined,
    }
  }, [status, search])

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
        client_order_reference: search || undefined,
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
      setWorkOrders(data.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
      setWorkOrders([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [activeTab, page, search, status, onlyPendingArea, historialIncludePending])

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

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      const [mats, invT, invC, woList] = await Promise.all([
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { per_page: 400, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "tintas", per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<MaterialRow>>("materials", {
          query: { inventory_area: "cementerio_tintas", per_page: 200, page: 1 },
        }),
        apiFetch<LaravelPaginated<WorkOrderListRow>>("work-orders", {
          query: { mi_area: "tintas", area_process_tag: "active", per_page: 100, page: 1 },
        }),
      ])
      setWorkOrders(woList.data ?? [])
      setTintaMaterials(
        (mats.data ?? []).filter(
          (m) =>
            m.inventory_area === "tintas" ||
            m.inventory_area === "cementerio_tintas",
        ),
      )
      setInvTintas(invT.data ?? [])
      setInvCementerio(invC.data ?? [])
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar OTs o materiales.")
      setWorkOrders([])
      setTintaMaterials([])
      setInvTintas([])
      setInvCementerio([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== "list") return
    void loadAreaRows()
  }, [loadAreaRows, mode])

  useEffect(() => {
    if (mode === "list") return
    void loadLists()
  }, [loadLists, mode])

  function stageLabel(boardStage?: string | null): string {
    if (boardStage === "nueva") return "Pendiente por OT"
    if (boardStage === "pendiente") return "Programación"
    if (boardStage === "montaje") return "Montaje"
    if (boardStage === "impresion") return "Impresión"
    if (boardStage === "laminacion") return "Laminación"
    if (boardStage === "corte") return "Corte"
    if (boardStage === "completada") return "Completada"
    return boardStage ?? "—"
  }

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

  const tintasFilterHint = (
    <p className="text-muted-foreground flex items-start gap-2 text-xs md:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        Pulse <strong className="font-medium text-foreground">Buscar</strong> o Enter para filtrar por código de OT,
        referencia de pedido o nombre de cliente. El estado se aplica al cambiar el valor.
      </span>
    </p>
  )

  const tintasHistorialFilterHint = (
    <p className="text-muted-foreground flex items-start gap-2 text-xs md:col-span-12">
      <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        Pulse <strong className="font-medium text-foreground">Buscar</strong> o Enter para aplicar el texto. Use las
        casillas de arriba para acotar el historial.
      </span>
    </p>
  )

  const applyTintasSearch = () => {
    setPage(1)
    setSearch(q.trim())
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
            Consumo, mezcla de color e inventario en un solo panel para la OT seleccionada.
          </>
        )
      }
      icon={Droplets}
      action={
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (mode === "list") {
              void loadAreaRows()
              void refreshBandejaMeta()
              return
            }
            void loadLists()
          }}
          disabled={loading}
        >
          Actualizar
        </Button>
      }
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

            <CatalogFilterGrid>
              <CatalogSearchField
                id="tintas-q-act"
                label="Ref. pedido cliente"
                placeholder="Código OT, referencia, cliente…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyTintasSearch()
                }}
                className="min-w-0 md:col-span-6"
              />
              <CatalogLabeledField label="Estado" icon={SlidersHorizontal} className="md:col-span-3">
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
                      <Rows3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
              <CatalogLabeledField label="Aplicar" className="md:col-span-3">
                <Button type="button" className="h-11 w-full" onClick={applyTintasSearch}>
                  Buscar
                </Button>
              </CatalogLabeledField>
              {tintasFilterHint}
            </CatalogFilterGrid>

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
                                onClick={() => openConsumo(o.id)}
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

            <CatalogFilterGrid>
              <CatalogSearchField
                id="tintas-q-historial"
                label="Ref. pedido cliente"
                placeholder="Código OT, referencia, cliente…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") applyTintasSearch()
                }}
                className="min-w-0 md:col-span-6"
              />
              <CatalogLabeledField label="Estado" icon={SlidersHorizontal} className="md:col-span-3">
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
                      <Rows3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
              <CatalogLabeledField label="Aplicar" className="md:col-span-3">
                <Button type="button" className="h-11 w-full" onClick={applyTintasSearch}>
                  Buscar
                </Button>
              </CatalogLabeledField>
              {tintasHistorialFilterHint}
            </CatalogFilterGrid>

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
                              onClick={() => openConsumo(o.id)}
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
              <p className="text-sm font-semibold tracking-tight">
                {selectedWo ? selectedWo.code : "OT no seleccionada"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {selectedWo
                  ? [selectedWo.client?.name, selectedWo.product?.name].filter(Boolean).join(" · ")
                  : "Elija una orden en impresión para registrar consumos y mezclas."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedWo ? (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link to={tintasWorkOrderProduccionUrl(selectedWo.id)}>Abrir en producción</Link>
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={closeConsumo}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Volver al listado
              </Button>
            </div>
          </div>

          <Tabs
            value={consumoVista}
            onValueChange={(v) => {
              const next = v as TintasConsumoVista
              setConsumoVista(next)
              if (woId) syncConsumoUrl(woId, next)
            }}
            className="w-full"
          >
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-xl border bg-muted/30 p-1">
              <TabsTrigger value="produccion" className="text-xs sm:text-sm">
                Producción y consumo
              </TabsTrigger>
              <TabsTrigger value="inventario" className="text-xs sm:text-sm">
                Inventario
              </TabsTrigger>
              <TabsTrigger value="cementerio" className="text-xs sm:text-sm">
                Cementerio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="produccion" className="mt-4 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-violet-200/60 shadow-sm">
              <Card className="rounded-none border-0 border-b border-violet-100/90 bg-violet-50/40 shadow-none">
                <CardHeader className="border-b border-violet-100/80 bg-violet-50/60 pb-3">
                  <CardTitle className="text-sm font-semibold text-violet-950/90">
                    Orden de trabajo en impresión
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 bg-white/50 pt-4">
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="grid gap-2 md:col-span-6">
                      <Label className="text-xs font-medium">OT</Label>
                      <Select
                        value={woId}
                        onValueChange={(v) => {
                          setWoId(v)
                          syncConsumoUrl(v, consumoVista)
                        }}
                      >
                        <SelectTrigger className={cn(catalogSelectTriggerClass, "h-10 text-sm")}>
                          <SelectValue placeholder="Seleccione una OT…" />
                        </SelectTrigger>
                        <SelectContent>
                          {workOrders.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              {w.code} — {w.client?.name ?? "—"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-3">
                      <Label className="text-xs font-medium">Estado OT</Label>
                      <Input
                        value={selectedWo ? tintasOtStatusLabel(selectedWo.status) : "—"}
                        disabled
                        className="h-10 text-sm"
                      />
                    </div>
                    <div className="grid gap-2 md:col-span-3">
                      <Label className="text-xs font-medium">Etapa en planta</Label>
                      <Input
                        value={selectedWo ? stageLabel(selectedWo.board_stage) : "—"}
                        disabled
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                  {selectedWo ? (
                    <div className="grid gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-sm sm:grid-cols-3">
                      <p>
                        <span className="text-muted-foreground">Cliente:</span>{" "}
                        <span className="font-medium">{selectedWo.client?.name ?? "—"}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Producto:</span>{" "}
                        <span className="font-medium">{selectedWo.product?.name ?? "—"}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Código:</span>{" "}
                        <span className="font-mono font-medium">{selectedWo.code}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Seleccione una OT para registrar consumos y mezcla de tinta.
                    </p>
                  )}
                </CardContent>
              </Card>

              {Number.isFinite(woNum) && woNum > 0 ? (
                <TintasOtWorkspace
                  workOrderId={woNum}
                  workOrderCode={selectedWo?.code}
                  tintaMaterials={tintaMaterials}
                  onMixCreated={() => void loadLists()}
                  onRefresh={() => void loadLists()}
                  refreshing={loading}
                />
              ) : (
                <p className="text-muted-foreground border-t border-violet-100/80 bg-violet-50/30 px-5 py-8 text-center text-sm">
                  Seleccione una OT para abrir el panel de consumo y mezcla.
                </p>
              )}
              </div>
            </TabsContent>

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
          </Tabs>
        </div>
      )}
    </CatalogPageShell>
  )
}
