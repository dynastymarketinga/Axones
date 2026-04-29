"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ProgramacionBoardResponse, WorkOrderListRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getStoredUser } from "@/lib/auth-storage"

export default function ProgramacionBoardPage() {
  useLocation()
  const session = getStoredUser()
  const role = (session?.role ?? "").toLowerCase().trim()
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState<Record<string, WorkOrderListRow[]>>({})
  const [movingId, setMovingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<ProgramacionBoardResponse>(
        "work-orders/programacion-board",
      )
      setColumns(data.columns ?? {})
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar el tablero.")
      setColumns({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stageLabels: Record<string, string> = {
    // §3.A: columna antes de programación = pendiente por OT
    nueva: "Pendiente por OT",
    // programación visible (ya entra a tablero)
    pendiente: "Programación",
    montaje: "Montaje",
    impresion: "Impresión",
    laminacion: "Laminación",
    corte: "Corte",
    completada: "Completada",
  }

  const stageOrder = useMemo(
    () => [
    "nueva",
    "pendiente",
    "montaje",
    "impresion",
    "laminacion",
    "corte",
    "completada",
    ],
    [],
  )

  const allowedStages = useMemo(() => {
    if (!role || role === "general") return null
    if (role === "printing" || role === "impresion") {
      return new Set(["nueva", "pendiente", "impresion"])
    }
    if (role === "laminacion") {
      return new Set(["nueva", "pendiente", "laminacion"])
    }
    if (role === "corte") {
      return new Set(["nueva", "pendiente", "corte"])
    }
    return null
  }, [role])

  const columnsToRender = useMemo(() => {
    const entries = stageOrder.map((k) => [k, columns[k] ?? []] as const)
    return allowedStages
      ? entries.filter(([k]) => allowedStages.has(k))
      : entries
  }, [columns, allowedStages, stageOrder])

  const canMoveStage = useCallback(
    (currentStage: string, targetStage: string): boolean => {
      // Respetar el filtrado por rol: si el rol tiene allowedStages,
      // solo permitimos mover dentro de esas columnas visibles.
      if (!allowedStages) return true
      return allowedStages.has(currentStage) && allowedStages.has(targetStage)
    },
    [allowedStages],
  )

  async function moveStage(woId: number, targetStage: string) {
    setMovingId(woId)
    try {
      await apiFetch(`work-orders/${woId}`, {
        method: "PATCH",
        body: JSON.stringify({ board_stage: targetStage }),
      })
      toast.success(`OT movida a ${stageLabels[targetStage] ?? targetStage}.`)
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo mover la OT.")
    } finally {
      setMovingId(null)
    }
  }

  async function moveToProgramming(woId: number) {
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
    }
  }

  function quickMovesForStage(stage: string): { stage: string; label: string }[] {
    // Flujo básico del kanban
    if (stage === "nueva") return [{ stage: "pendiente", label: "Enviar a programación" }]
    if (stage === "pendiente") return [{ stage: "montaje", label: "Pasar a Montaje" }]
    if (stage === "montaje") return [{ stage: "impresion", label: "Pasar a Impresión" }]
    if (stage === "laminacion") return [{ stage: "corte", label: "Pasar a Corte" }]
    if (stage === "corte") return [{ stage: "completada", label: "Marcar completada" }]
    return []
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Programación</h1>
          <p className="text-muted-foreground text-sm max-w-3xl">
            La primera columna es <span className="text-foreground font-medium">Pendiente por OT</span>: órdenes de trabajo recién creadas o aún
            sin pasar a programación operativa. Después sigue <span className="text-foreground font-medium">Programación</span> y el resto de fases.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualizar
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando tablero…</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnsToRender.map(([stage, orders]) => (
            <Card
              key={stage}
              className="min-w-[280px] max-w-[320px] shrink-0"
            >
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium">
                  {stageLabels[stage] ?? stage}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({orders.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {orders.length === 0 ? (
                  <p className="text-muted-foreground text-xs">Vacío</p>
                ) : (
                  orders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-lg border bg-muted/40 p-3 text-sm"
                    >
                      <Link
                        to={`/ordenes-trabajo/${o.id}`}
                        className="block transition hover:opacity-90"
                      >
                        <div className="font-mono font-medium">{o.code}</div>
                        <div className="text-muted-foreground mt-1 line-clamp-2">
                          {o.client?.name ?? "—"} · {o.product?.name ?? "—"}
                        </div>
                      </Link>

                      {(() => {
                        const moves = quickMovesForStage(stage).filter((m) =>
                          canMoveStage(stage, m.stage),
                        )
                        if (!moves.length) return null
                        return (
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
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
                        )
                      })()}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
