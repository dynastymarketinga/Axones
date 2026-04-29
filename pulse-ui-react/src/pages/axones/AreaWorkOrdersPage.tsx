"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { getStoredUser } from "@/lib/auth-storage"

export type AreaKey = "printing" | "laminacion" | "corte" | "tintas"

const BOARD_STAGE_BY_AREA: Record<AreaKey, string> = {
  printing: "impresion",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "impresion",
}

const TAB_BY_AREA: Record<AreaKey, string> = {
  printing: "printing",
  laminacion: "laminacion",
  corte: "corte",
  tintas: "printing",
}

function areaTitle(area: AreaKey): string {
  if (area === "printing") return "Área: Impresión"
  if (area === "laminacion") return "Área: Laminación"
  if (area === "corte") return "Área: Corte"
  return "Área: Tintas"
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
  const [q, setQ] = useState("")
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

  const defaultBoardStage = BOARD_STAGE_BY_AREA[area]

  const queryBoardStage = useMemo(() => {
    if (activeTab === "mias") return defaultBoardStage
    return boardStage !== "all" ? boardStage : undefined
  }, [activeTab, boardStage, defaultBoardStage])

  const queryStatus = status !== "all" ? status : undefined
  const areaHistoryKeyByArea: Record<AreaKey, string | undefined> = {
    printing: "impresion",
    laminacion: "laminacion",
    corte: "corte",
    tintas: undefined,
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>(
        "work-orders",
        {
          query: {
            page,
            per_page: 20,
            board_stage: queryBoardStage,
            status: queryStatus,
            area_history:
              activeTab === "historial"
                ? areaHistoryKeyByArea[area]
                : undefined,
            client_order_reference: search || undefined,
          },
        },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudieron cargar las órdenes.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [activeTab, area, page, queryBoardStage, queryStatus, search])

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

  function processStateForArea(boardStage?: string | null): string {
    if (!boardStage) return "Sin etapa"
    const current = stageOrder[boardStage] ?? -1
    const areaStage = stageOrder[areaStageForProgress[area]] ?? -1
    if (current > areaStage) return "Hecho en área"
    if (current === areaStage) return "En proceso"
    return "Pendiente en área"
  }
  function processTagForArea(boardStage?: string | null): ProcessFilter {
    if (!boardStage) return "all"
    const current = stageOrder[boardStage] ?? -1
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
    // Ruta absoluta: evita que React Router la resuelva relativo al área (ej. /axones/impresion/axones/ordenes-trabajo/...)
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

  function canMoveFromHere(boardStage?: string | null): boolean {
    if (!boardStage) return false
    const here = stageByArea[area]
    if (boardStage !== here) return false

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {areaTitle(area)}
          </h1>
          <p className="text-muted-foreground text-sm">
            Listado enfocado a tu fase + historial filtrable.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Actualizar
          </Button>
          {area !== "printing" ? (
            <Button type="button" asChild>
              <Link to="/ordenes-trabajo?tab=lista">Órdenes de trabajo</Link>
            </Button>
          ) : null}
        </div>
      </div>

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor={`a-q-${area}`}>Ref. pedido cliente</Label>
              <Input
                id={`a-q-${area}`}
                placeholder="Buscar por referencia…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    setSearch(q.trim())
                  }
                }}
              />
            </div>
            <div className="grid w-48 gap-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => {
                setPage(1)
                setSearch(q.trim())
              }}
            >
              Buscar
            </Button>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tablero</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !rows?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Sin órdenes en esta fase.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">
                        {o.code}
                      </TableCell>
                      <TableCell>{o.client?.name ?? "—"}</TableCell>
                      <TableCell>{o.product?.name ?? "—"}</TableCell>
                      <TableCell>
                        {stageLabel[o.board_stage ?? ""] ??
                          (o.board_stage ?? "—")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="link" className="h-auto p-0" asChild>
                            <Link to={openUrl(o.id)}>Abrir</Link>
                          </Button>
                          {canMoveFromHere(o.board_stage) &&
                          nextStageByArea[area] ? (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor={`a-q2-${area}`}>Ref. pedido cliente</Label>
              <Input
                id={`a-q2-${area}`}
                placeholder="Buscar por referencia…"
                value={q}
                onChange={(ev) => setQ(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    setPage(1)
                    setSearch(q.trim())
                  }
                }}
              />
            </div>
            <div className="grid w-48 gap-2">
              <Label>Tablero</Label>
              <Select
                value={boardStage}
                onValueChange={(v) => {
                  setBoardStage(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
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
            </div>
            <div className="grid w-48 gap-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="completed">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => {
                setPage(1)
                setSearch(q.trim())
              }}
            >
              Buscar
            </Button>
          </div>

          <div className="bg-card border rounded-2xl shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Proceso en área</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tablero</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : !historialRows.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Sin resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  historialRows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-sm">
                        {o.code}
                      </TableCell>
                      <TableCell>{o.client?.name ?? "—"}</TableCell>
                      <TableCell>{o.product?.name ?? "—"}</TableCell>
                      <TableCell>{processStateForArea(o.board_stage)}</TableCell>
                      <TableCell>{statusLabel(o.status)}</TableCell>
                      <TableCell>
                        {stageLabel[o.board_stage ?? ""] ??
                          (o.board_stage ?? "—")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="link" className="h-auto p-0" asChild>
                            <Link to={openUrl(o.id)}>Abrir</Link>
                          </Button>
                          {canMoveFromHere(o.board_stage) &&
                          nextStageByArea[area] ? (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {rows && rows.last_page > 1 ? (
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
                  onClick={() =>
                    setPage((p) => Math.min(rows.last_page, p + 1))
                  }
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {rows && rows.last_page > 1 && activeTab === "mias" ? (
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
      ) : null}
    </div>
  )
}

