"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, ClipboardList } from "lucide-react"
import { toast } from "sonner"

 
 
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
 
import { ProgramacionKanbanBoard } from "@/components/axones/programacion/ProgramacionKanbanBoard"
import {
  KANBAN_COLUMNS,
  STAGE_OPTIONS,
  stageTitle,
  type BoardStageKey,
} from "@/components/axones/programacion/programacion-kanban-config"
import { Button } from "@/components/ui/button"
 
import { apiFetch, ApiError } from "@/lib/api"
import { getStoredUser } from "@/lib/auth-storage"

import type {
  ProgramacionBoardResponse,
  ProgramacionPendingClientOrder,
  WorkOrderListRow,
} from "@/types/api"

const SEARCH_DEBOUNCE_MS = 320

function allowedStagesForRole(roleNorm: string): BoardStageKey[] | null {
  if (!roleNorm || roleNorm === "general") return null
  if (roleNorm === "printing" || roleNorm === "impresion") {
    return ["nueva", "pendiente", "montaje", "impresion"]
  }
  if (roleNorm === "laminacion") {
    return ["nueva", "pendiente", "laminacion"]
  }
  if (roleNorm === "corte") {
    return ["nueva", "pendiente", "corte"]
  }
  if (roleNorm === "montaje") {
    return ["nueva", "pendiente", "montaje"]
  }
  return null
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

function matchesSearch(row: WorkOrderListRow, q: string): boolean {
  if (!q) return true
  const hay = q.toLowerCase()
  const parts = [
    row.code,
    row.client?.name,
    row.product?.name,
    row.client_order?.code,
  ]
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => p.toLowerCase())
  return parts.some((p) => p.includes(hay))
}

function matchesStatus(row: WorkOrderListRow, statusFilter: string): boolean {
  if (statusFilter === "all") return true
  return (row.status ?? "").toLowerCase().trim() === statusFilter
}

function matchesClientOrderSearch(
  row: ProgramacionPendingClientOrder,
  q: string,
): boolean {
  if (!q) return true
  const hay = q.toLowerCase()
  const parts = [
    row.code,
    row.client?.name,
    row.first_line_with_product?.product?.name,
    ...(row.lines ?? []).map((l) => l.product?.name),
  ]
    .filter((p): p is string => typeof p === "string" && p.trim() !== "")
    .map((p) => p.toLowerCase())
  return parts.some((p) => p.includes(hay))
}

function allOrdersFromBoard(
  board: ProgramacionBoardResponse | null,
): WorkOrderListRow[] {
  if (!board?.columns) return []
  return Object.values(board.columns).flat()
}

export default function ProgramacionBoardPage() {
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()

  const [qInput, setQInput] = useState("")
  const [search, setSearch] = useState("")
  const [boardStageFilter, setBoardStageFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [board, setBoard] = useState<ProgramacionBoardResponse | null>(null)
  const [movingId, setMovingId] = useState<number | null>(null)

  const restrictedStages = useMemo(() => allowedStagesForRole(role), [role])

  const stageSelectOptions = useMemo(() => {
    if (!restrictedStages) return STAGE_OPTIONS
    return STAGE_OPTIONS.filter((o) => restrictedStages.includes(o.value))
  }, [restrictedStages])

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(qInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [qInput])

  const allowedStagesSet = useMemo(() => {
    if (!restrictedStages) return null
    return new Set(restrictedStages)
  }, [restrictedStages])

  const canMoveStage = useCallback(
    (currentStage: string, targetStage: string): boolean => {
      if (!allowedStagesSet) return true
      return allowedStagesSet.has(currentStage as BoardStageKey) &&
        allowedStagesSet.has(targetStage as BoardStageKey)
    },
    [allowedStagesSet],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ProgramacionBoardResponse>(
        "work-orders/programacion-board",
      )
      setBoard(data)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el tablero de programación.")
      setBoard(null)
    } finally {
      setLoading(false)
    }
  }, [])

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
      toast.success(`Orden movida a «${stageTitle(targetStage)}».`)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la orden.")
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
      toast.success("Orden enviada a programación.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la orden.")
    } finally {
      setMovingId(null)
    }
  }

  function handleMove(woId: number, targetStage: string, fromNueva: boolean) {
    if (fromNueva) void moveToProgramming(woId)
    else void moveStage(woId, targetStage)
  }

  function quickMovesForStage(stage: string): { stage: string; label: string }[] {
    if (stage === "nueva") return [{ stage: "pendiente", label: "Enviar a programación" }]
    if (stage === "pendiente") return [{ stage: "montaje", label: "Pasar a montaje" }]
    if (stage === "impresion") return [{ stage: "laminacion", label: "Pasar a laminación" }]
    if (stage === "corte") return [{ stage: "completada", label: "Marcar como completada" }]
    return []
  }

  const visibleColumns = useMemo(() => {
    let cols = KANBAN_COLUMNS
    if (restrictedStages) {
      cols = cols.filter((c) => restrictedStages.includes(c.stage))
    }
    if (boardStageFilter !== "all") {
      cols = cols.filter((c) => c.stage === boardStageFilter)
    }
    return cols
  }, [restrictedStages, boardStageFilter])

  const filteredByStage = useMemo(() => {
    const result: Record<string, WorkOrderListRow[]> = {}
    for (const col of visibleColumns) {
      const items = board?.columns?.[col.stage] ?? []
      result[col.stage] = items.filter(
        (row) => matchesSearch(row, search) && matchesStatus(row, statusFilter),
      )
    }
    return result
  }, [board, visibleColumns, search, statusFilter])

  const filteredPendingClientOrders = useMemo(() => {
    const list = board?.pending_client_orders ?? []
    return list.filter((row) => matchesClientOrderSearch(row, search))
  }, [board, search])

  const urgentCount = useMemo(() => {
    return allOrdersFromBoard(board)
      .filter((row) => matchesSearch(row, search) && matchesStatus(row, statusFilter))
      .filter((row) => (row.priority ?? "").toLowerCase().trim() === "urgente").length
  }, [board, search, statusFilter])

  const forcedStage =
    boardStageFilter !== "all" ? (boardStageFilter as BoardStageKey) : null

  const subtitle =
    "Vea pedidos cliente pendientes de OT, en qué etapa está cada orden de trabajo y aváncela con el botón grande de la tarjeta."

  return (
    <CatalogPageShell
      title="Programación de producción"
      subtitle={subtitle}
      icon={ClipboardList}
      headerExtras={
        urgentCount > 0 ? (
          <div
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            role="status"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Hay <strong>{urgentCount}</strong>{" "}
              {urgentCount === 1 ? "orden urgente" : "órdenes urgentes"} — revíselas primero.
            </span>
          </div>
        ) : null
      }
       
    >
       

      {board === null && !loading ? (
        <div className="bg-card text-muted-foreground rounded-2xl border p-10 text-center text-base">
          <p className="mb-3">No se pudo cargar el tablero.</p>
          <Button type="button" variant="outline" className="h-11 text-base" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <ProgramacionKanbanBoard
          columns={visibleColumns}
          filteredByStage={filteredByStage}
          pendingClientOrders={filteredPendingClientOrders}
          loading={loading}
          movingId={movingId}
          statusLabel={otStatusLabel}
          quickMovesForStage={quickMovesForStage}
          canMoveStage={canMoveStage}
          onMove={handleMove}
          forcedStage={forcedStage}
        />
      )}
    </CatalogPageShell>
  )
}
