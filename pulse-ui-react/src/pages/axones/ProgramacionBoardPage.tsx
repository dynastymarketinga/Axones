"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Barcode,
  CalendarClock,
  CircleDot,
  ClipboardList,
  ListOrdered,
  Package,
  Settings2,
  Users,
} from "lucide-react"
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
import { LoadingTableRow } from "@/components/axones/LoadingStates"
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
import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, WorkOrderListRow } from "@/types/api"
import { getStoredUser } from "@/lib/auth-storage"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 320

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "nueva", label: "Pendiente por OT" },
  { value: "pendiente", label: "Programación" },
  { value: "montaje", label: "Montaje" },
  { value: "impresion", label: "Impresión" },
  { value: "laminacion", label: "Laminación" },
  { value: "corte", label: "Corte" },
  { value: "completada", label: "Completada" },
]

function allowedStagesForRole(roleNorm: string): string[] | null {
  if (!roleNorm || roleNorm === "general") return null
  if (roleNorm === "printing" || roleNorm === "impresion") {
    return ["nueva", "pendiente", "impresion"]
  }
  if (roleNorm === "laminacion") {
    return ["nueva", "pendiente", "laminacion"]
  }
  if (roleNorm === "corte") {
    return ["nueva", "pendiente", "corte"]
  }
  return null
}

function stageLabels(): Record<string, string> {
  return Object.fromEntries(STAGE_OPTIONS.map((o) => [o.value, o.label]))
}

function otStatusLabel(value: string | null | undefined): string {
  const m: Record<string, string> = {
    open: "Abierta",
    in_progress: "En proceso",
    completed: "Completada",
    cancelled: "Cancelada",
  }
  const k = (value ?? "").toLowerCase().trim()
  return m[k] ?? (value?.trim() || "—")
}

export default function ProgramacionBoardPage() {
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()

  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [boardStageFilter, setBoardStageFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<LaravelPaginated<WorkOrderListRow> | null>(
    null,
  )
  const [movingId, setMovingId] = useState<number | null>(null)

  const skipSearchPageReset = useRef(true)
  const labels = useMemo(() => stageLabels(), [])
  const restrictedStages = useMemo(() => allowedStagesForRole(role), [role])

  const stageSelectOptions = useMemo(() => {
    if (!restrictedStages) return STAGE_OPTIONS
    return STAGE_OPTIONS.filter((o) => restrictedStages.includes(o.value))
  }, [restrictedStages])

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(qInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [qInput])

  useEffect(() => {
    if (skipSearchPageReset.current) {
      skipSearchPageReset.current = false
      return
    }
    setPage(1)
  }, [search])

  const allowedStagesSet = useMemo(() => {
    if (!restrictedStages) return null
    return new Set(restrictedStages)
  }, [restrictedStages])

  const canMoveStage = useCallback(
    (currentStage: string, targetStage: string): boolean => {
      if (!allowedStagesSet) return true
      return allowedStagesSet.has(currentStage) && allowedStagesSet.has(targetStage)
    },
    [allowedStagesSet],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query: Record<string, string | number | undefined> = {
        page,
        per_page: 20,
        exclude_cancelled: 1,
        q: search || undefined,
      }
      if (statusFilter !== "all") {
        query.status = statusFilter
      }
      if (boardStageFilter !== "all") {
        query.board_stage = boardStageFilter
      } else if (restrictedStages?.length) {
        query.board_stage_in = restrictedStages.join(",")
      }

      const data = await apiFetch<LaravelPaginated<WorkOrderListRow>>(
        "work-orders",
        { query },
      )
      setRows(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el listado de programación.")
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [boardStageFilter, page, restrictedStages, search, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  async function moveStage(woId: number, targetStage: string) {
    setMovingId(woId)
    try {
      await apiFetch(`work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: targetStage }),
      })
      toast.success(`OT movida a ${labels[targetStage] ?? targetStage}.`)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la OT.")
    } finally {
      setMovingId(null)
    }
  }

  async function moveToProgramming(woId: number) {
    setMovingId(woId)
    try {
      await apiFetch(`work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: "pendiente" }),
      })
      toast.success("OT enviada a programación.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la OT.")
    } finally {
      setMovingId(null)
    }
  }

  function quickMovesForStage(stage: string): { stage: string; label: string }[] {
    if (stage === "nueva") return [{ stage: "pendiente", label: "Enviar a programación" }]
    if (stage === "pendiente") return [{ stage: "montaje", label: "Pasar a Montaje" }]
    if (stage === "montaje") return [{ stage: "impresion", label: "Pasar a Impresión" }]
    if (stage === "impresion") return [{ stage: "laminacion", label: "Pasar a Laminación" }]
    if (stage === "laminacion") return [{ stage: "corte", label: "Pasar a Corte" }]
    if (stage === "corte") return [{ stage: "completada", label: "Marcar completada" }]
    return []
  }

  const subtitle =
    "Listado paginado de órdenes de trabajo en el tablero de producción. Use los filtros y las acciones para avanzar etapas."

  return (
    <CatalogPageShell
      title="Programación"
      subtitle={subtitle}
      icon={ClipboardList}
      action={
        <Button type="button" variant="outline" onClick={() => void load()}>
          Actualizar
        </Button>
      }
    >
      <CatalogFilterGrid>
        <CatalogSearchField
          id="prog-q"
          placeholder="Código OT, referencia, cliente…"
          value={qInput}
          onChange={(ev) => setQInput(ev.target.value)}
          className="min-w-0 lg:col-span-5"
        />
        <CatalogLabeledField label="Etapa en tablero" className="lg:col-span-3">
          <Select
            value={boardStageFilter}
            onValueChange={(v) => {
              setBoardStageFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas (según permiso)</SelectItem>
              {stageSelectOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CatalogLabeledField>
        <CatalogLabeledField label="Estado OT" className="lg:col-span-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
          >
            <SelectTrigger className={cn("w-full font-normal", catalogSelectTriggerClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Abierta</SelectItem>
              <SelectItem value="in_progress">En proceso</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </CatalogLabeledField>
        <p className="text-muted-foreground text-xs lg:col-span-12">
          Las órdenes canceladas no aparecen. La búsqueda filtra al escribir (código, referencia o cliente).
        </p>
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
              <CatalogTableHead icon={CalendarClock}>Etapa</CatalogTableHead>
              <CatalogTableHead icon={CircleDot}>Estado OT</CatalogTableHead>
              <CatalogTableHeadRight icon={Settings2}>Acciones</CatalogTableHeadRight>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingTableRow colSpan={7} />
            ) : !rows?.data.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Sin órdenes para estos filtros.
                </TableCell>
              </TableRow>
            ) : (
              rows.data.map((o, idx) => {
                const stage = (o.board_stage ?? "").toLowerCase().trim()
                const n = (rows.current_page - 1) * rows.per_page + idx + 1
                const moves = quickMovesForStage(stage).filter((m) =>
                  canMoveStage(stage, m.stage),
                )
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
                      <Link
                        className="text-primary hover:underline"
                        to={`/ordenes-trabajo/${o.id}`}
                      >
                        {o.code}
                      </Link>
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {o.client?.name ?? "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {o.product?.name ?? "—"}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {labels[stage] ?? (o.board_stage ?? "—")}
                    </TableCell>
                    <TableCell className={catalogTableBodyCellClass}>
                      {otStatusLabel(o.status)}
                    </TableCell>
                    <TableCell className={cn("text-right", catalogTableBodyCellClass)}>
                      <div className="flex flex-col items-end gap-2">
                        <Button variant="outline" size="sm" className="border-primary/25" asChild>
                          <Link to={`/ordenes-trabajo/${o.id}`}>Abrir</Link>
                        </Button>
                        <div className="flex flex-wrap justify-end gap-1">
                          {moves.map((m) => (
                            <Button
                              key={m.stage}
                              type="button"
                              size="sm"
                              variant={m.stage === "completada" ? "default" : "secondary"}
                              disabled={movingId === o.id}
                              onClick={() =>
                                stage === "nueva"
                                  ? void moveToProgramming(o.id)
                                  : void moveStage(o.id, m.stage)
                              }
                            >
                              {movingId === o.id ? "…" : m.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
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
              onClick={() => setPage((p) => Math.min(rows.last_page, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </CatalogPageShell>
  )
}
