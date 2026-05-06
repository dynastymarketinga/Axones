"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  Barcode,
  CircleDot,
  Columns3,
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
import { Button } from "@/components/ui/button"
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

function areaTitle(area: AreaKey): string {
  if (area === "printing") return "Área: Impresión"
  if (area === "laminacion") return "Área: Laminación"
  if (area === "corte") return "Área: Corte"
  return "Área: Tintas"
}

function areaSubtitle(): string {
  return "Órdenes con solicitud pendiente para tu área (sin depender del tablero). Historial: todas las OT que tuvieron solicitud hacia esta área."
}

function statusLabel(status: string): string {
  if (status === "open") return "Abierta"
  if (status === "completed") return "Completada"
  if (status === "cancelled") return "Cancelada"
  return status
}

export default function AreaWorkOrdersPage({ area }: { area: AreaKey }) {
  type ProcessFilter = "all" | "in_progress" | "done"
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const [activeTab, setActiveTab] = useState<"mias" | "historial">("mias")
  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(
    null,
  )
  const [movingId, setMovingId] = useState<number | null>(null)

  const [status, setStatus] = useState<string>("all")
  const [boardStage, setBoardStage] = useState<string>("all")
  const [processFilter, setProcessFilter] = useState<ProcessFilter>("all")
  const skipSearchPageReset = useRef(true)

  const queryBoardStage = useMemo(() => {
    if (activeTab !== "historial") return undefined
    return boardStage !== "all" ? boardStage : undefined
  }, [activeTab, boardStage])

  const queryStatus = status !== "all" ? status : undefined

  const miAreaApi = useMemo(() => {
    if (area === "printing") return "impresion"
    if (area === "laminacion") return "laminacion"
    if (area === "corte") return "corte"
    return "tintas"
  }, [area])

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
      const query: Record<string, string | number | undefined> = {
        page,
        per_page: 20,
        status: queryStatus,
        q: search || undefined,
      }
      if (activeTab === "mias") {
        query.mi_area = miAreaApi
      } else {
        query.historial_area = miAreaApi
        if (queryBoardStage) query.board_stage = queryBoardStage
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
  }, [activeTab, miAreaApi, page, queryBoardStage, queryStatus, search])

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
    return "Pendiente en área"
  }
  function processTagForArea(bs?: string | null): ProcessFilter {
    if (!bs) return "all"
    const current = stageOrder[bs] ?? -1
    const areaStage = stageOrder[areaStageForProgress[area]] ?? -1
    if (current > areaStage) return "done"
    if (current === areaStage) return "in_progress"
    return "all"
  }
  const historialRows = useMemo(() => {
    const source = rows?.data ?? []
    if (activeTab !== "historial" || processFilter === "all") return source
    return source.filter((o) => processTagForArea(o.board_stage) === processFilter)
  }, [activeTab, processFilter, rows?.data])
  const historialCounts = useMemo(() => {
    const source = rows?.data ?? []
    let inProgress = 0
    let done = 0
    for (const row of source) {
      const tag = processTagForArea(row.board_stage)
      if (tag === "in_progress") inProgress += 1
      if (tag === "done") done += 1
    }
    return {
      all: source.length,
      in_progress: inProgress,
      done,
    }
  }, [rows?.data])

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
    corte: "completada",
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
        <Button type="button" variant="outline" onClick={() => void load()}>
          Actualizar
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "mias" | "historial")
          if (v === "historial") {
            setStatus("all")
            setBoardStage("all")
            setProcessFilter("all")
          }
          setPage(1)
        }}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="mias">En mi fase</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="mias" className="mt-4 space-y-4">
          <CatalogFilterGrid>
            <CatalogSearchField
              id={`a-q-${area}`}
              label="Ref. pedido cliente"
              placeholder="Código OT, referencia, cliente…"
              value={qInput}
              onChange={(ev) => setQInput(ev.target.value)}
              className="min-w-0 lg:col-span-6"
            />
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
                  <CatalogTableHead icon={Columns3}>Tablero</CatalogTableHead>
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
                      Sin órdenes en esta fase.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o, idx) => {
                    const n = (rows.current_page - 1) * rows.per_page + idx + 1
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
                          {stageLabel[o.board_stage ?? ""] ?? (o.board_stage ?? "—")}
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
          {activeTab === "mias" ? pagination : null}
        </TabsContent>

        <TabsContent value="historial" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={processFilter === "all" ? "default" : "outline"}
              onClick={() => setProcessFilter("all")}
            >
              Todo ({historialCounts.all})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={processFilter === "in_progress" ? "default" : "outline"}
              onClick={() => setProcessFilter("in_progress")}
            >
              En proceso ({historialCounts.in_progress})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={processFilter === "done" ? "default" : "outline"}
              onClick={() => setProcessFilter("done")}
            >
              Hecho en área ({historialCounts.done})
            </Button>
          </div>

          <CatalogFilterGrid>
            <CatalogSearchField
              id={`a-q2-${area}`}
              label="Ref. pedido cliente"
              placeholder="Código OT, referencia, cliente…"
              value={qInput}
              onChange={(ev) => setQInput(ev.target.value)}
              className="min-w-0 lg:col-span-5"
            />
            <CatalogLabeledField label="Tablero" className="lg:col-span-3">
              <Select
                value={boardStage}
                onValueChange={(v) => {
                  setBoardStage(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="nueva">Pendiente por OT</SelectItem>
                  <SelectItem value="pendiente">Programación</SelectItem>
                  <SelectItem value="montaje">Montaje</SelectItem>
                  <SelectItem value="impresion">Impresión</SelectItem>
                  <SelectItem value="laminacion">Laminación</SelectItem>
                  <SelectItem value="corte">Corte</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                </SelectContent>
              </Select>
            </CatalogLabeledField>
            <CatalogLabeledField label="Estado" className="lg:col-span-4">
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
                  <CatalogTableHead icon={Activity}>Proceso en área</CatalogTableHead>
                  <CatalogTableHead icon={CircleDot}>Estado</CatalogTableHead>
                  <CatalogTableHead icon={Columns3}>Tablero</CatalogTableHead>
                  <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !historialRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  historialRows.map((o) => {
                    const pos =
                      rows != null ? rows.data.indexOf(o) : -1
                    const n =
                      rows != null && pos >= 0
                        ? (rows.current_page - 1) * rows.per_page + pos + 1
                        : 0
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
                          {processStateForArea(o.board_stage)}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {statusLabel(o.status)}
                        </TableCell>
                        <TableCell className={catalogTableBodyCellClass}>
                          {stageLabel[o.board_stage ?? ""] ?? (o.board_stage ?? "—")}
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
