"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  Barcode,
  CircleDot,
  Droplets,
  Factory,
  Layers2,
  ListOrdered,
  Package,
  Scissors,
  Settings2,
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

function areaSubtitle(): string {
  return "En curso: solicitud pendiente y OT en cola o ya en la etapa de este área. Historial: solicitudes cerradas en el área (hechas o canceladas)."
}

type AreaBandejaTab = "activas" | "historial"

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

  const load = useCallback(async () => {
    setLoading(true)
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
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [
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
  ])

  useEffect(() => {
    void load()
  }, [load])

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

  return (
    <CatalogPageShell
      title={areaTitle(area)}
      subtitle={areaSubtitle()}
      icon={AreaIcon}
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void load()
            void refreshBandejaMeta()
          }}
        >
          Actualizar
        </Button>
      }
    >
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Solicitud pendiente: OT en cola (antes de esta etapa) o ya en la etapa de este área.
            </p>
            <Badge variant="outline" className={areaRequestBadgeClass("pending")}>
              En curso: {totalActivas}
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
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Sin órdenes en curso para esta área.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o, idx) => {
                    const n = (rows.current_page - 1) * rows.per_page + idx + 1
                    const reqStatus =
                      (o.areaRequests && o.areaRequests.length ? o.areaRequests[0]?.status : null) ??
                      "pending"
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
    </CatalogPageShell>
  )
}
