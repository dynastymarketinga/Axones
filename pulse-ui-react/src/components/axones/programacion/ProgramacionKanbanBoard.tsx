"use client"

import { useEffect, useState } from "react"
import { ChevronRight, LayoutGrid, List } from "lucide-react"

import { ProgramacionKanbanCard } from "@/components/axones/programacion/ProgramacionKanbanCard"
import { ProgramacionPendingClientOrderCard } from "@/components/axones/programacion/ProgramacionPendingClientOrderCard"
import type { KanbanColumnConfig } from "@/components/axones/programacion/programacion-kanban-config"
import type { BoardStageKey } from "@/components/axones/programacion/programacion-kanban-config"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ProgramacionPendingClientOrder, WorkOrderListRow } from "@/types/api"

export type QuickMove = { stage: string; label: string }

type BoardView = "focused" | "panorama"

type ProgramacionKanbanBoardProps = {
  columns: KanbanColumnConfig[]
  filteredByStage: Record<string, WorkOrderListRow[]>
  pendingClientOrders?: ProgramacionPendingClientOrder[]
  loading: boolean
  movingId: number | null
  statusLabel: (value: string | null | undefined) => string
  quickMovesForStage: (stage: string) => QuickMove[]
  canMoveStage: (current: string, target: string) => boolean
  onMove: (woId: number, targetStage: string, fromNueva: boolean) => void
  /** Si el filtro global fija una etapa, sincronizar pestaña activa */
  forcedStage?: BoardStageKey | null
}

function stageItemCount(
  stage: BoardStageKey,
  filteredByStage: Record<string, WorkOrderListRow[]>,
  pendingClientOrders: ProgramacionPendingClientOrder[],
): number {
  const wo = (filteredByStage[stage] ?? []).length
  if (stage === "pendiente") {
    return wo + pendingClientOrders.length
  }
  return wo
}

function pickDefaultStage(
  columns: KanbanColumnConfig[],
  filteredByStage: Record<string, WorkOrderListRow[]>,
  pendingClientOrders: ProgramacionPendingClientOrder[],
): BoardStageKey {
  const withItems = columns.find(
    (c) => stageItemCount(c.stage, filteredByStage, pendingClientOrders) > 0,
  )
  if (withItems) return withItems.stage
  const pendiente = columns.find((c) => c.stage === "pendiente")
  if (pendiente) return pendiente.stage
  return columns[0]?.stage ?? "pendiente"
}

function StagePanelSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div className="bg-muted h-40 animate-pulse rounded-xl" />
      <div className="bg-muted h-40 animate-pulse rounded-xl" />
    </div>
  )
}

export function ProgramacionKanbanBoard({
  columns,
  filteredByStage,
  pendingClientOrders = [],
  loading,
  movingId,
  statusLabel,
  quickMovesForStage,
  canMoveStage,
  onMove,
  forcedStage,
}: ProgramacionKanbanBoardProps) {
  const [activeStage, setActiveStage] = useState<BoardStageKey>(() =>
    pickDefaultStage(columns, filteredByStage, pendingClientOrders),
  )
  const [view, setView] = useState<BoardView>("focused")

  useEffect(() => {
    if (forcedStage && columns.some((c) => c.stage === forcedStage)) {
      setActiveStage(forcedStage)
    }
  }, [forcedStage, columns])

  useEffect(() => {
    if (forcedStage) return
    const stillVisible = columns.some((c) => c.stage === activeStage)
    if (!stillVisible) {
      setActiveStage(pickDefaultStage(columns, filteredByStage, pendingClientOrders))
    }
  }, [columns, activeStage, filteredByStage, forcedStage, pendingClientOrders])

  const activeCol = columns.find((c) => c.stage === activeStage) ?? columns[0]
  const activeItems = activeCol ? (filteredByStage[activeCol.stage] ?? []) : []
  const showPendingOc = activeCol?.stage === "pendiente" && pendingClientOrders.length > 0

  const totalWorkOrders = columns.reduce(
    (n, c) => n + (filteredByStage[c.stage] ?? []).length,
    0,
  )
  const totalVisible = totalWorkOrders + pendingClientOrders.length

  const pendientePanelTotal =
    activeCol?.stage === "pendiente"
      ? activeItems.length + pendingClientOrders.length
      : activeItems.length

  const panelIsEmpty =
    activeCol?.stage === "pendiente"
      ? activeItems.length === 0 && pendingClientOrders.length === 0
      : activeItems.length === 0

  if (loading && totalVisible === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-muted/40 h-14 animate-pulse rounded-xl" />
        <StagePanelSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-4" role="region" aria-label="Tablero de programación">
      <div className="bg-card/80 rounded-2xl border border-border/60 p-4 shadow-sm">
        <p className="text-muted-foreground mb-3 text-sm font-medium">
          Recorrido de la orden
        </p>
        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-max items-center gap-1">
            {columns.map((col, idx) => {
              const count = stageItemCount(col.stage, filteredByStage, pendingClientOrders)
              const isActive = col.stage === activeStage
              const Icon = col.icon
              return (
                <li key={col.stage} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveStage(col.stage)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                      "min-h-[44px] text-sm font-medium",
                      isActive
                        ? cn("border-2 shadow-sm", col.tabActiveClass)
                        : "border-border/60 bg-background hover:bg-muted/50",
                      col.isProductionCore && !isActive && "ring-1 ring-primary/15",
                    )}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span
                      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", col.accentClass)}
                      aria-hidden
                    />
                    <Icon className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">{col.title}</span>
                    <span
                      className={cn(
                        "min-w-[1.75rem] rounded-md px-1.5 py-0.5 text-center text-xs font-bold tabular-nums",
                        count > 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                  {idx < columns.length - 1 ? (
                    <ChevronRight
                      className="text-muted-foreground/50 h-4 w-4 shrink-0"
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Las etapas de <strong className="text-foreground font-semibold">Montaje</strong>,{" "}
          <strong className="text-foreground font-semibold">Impresión</strong>,{" "}
          <strong className="text-foreground font-semibold">Laminación</strong> y{" "}
          <strong className="text-foreground font-semibold">Corte</strong> concentran el trabajo en
          planta. En <strong className="text-foreground font-semibold">Pendientes</strong> también
          aparecen pedidos cliente (OC) aprobados que aún no tienen OT.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground text-base font-medium">
          {totalVisible === 0
            ? "No hay órdenes con los filtros actuales"
            : `${totalVisible} elemento${totalVisible === 1 ? "" : "s"} en el tablero`}
        </p>
        <div className="flex rounded-lg border bg-muted/30 p-0.5">
          <Button
            type="button"
            variant={view === "focused" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1.5 text-sm"
            onClick={() => setView("focused")}
          >
            <List className="h-4 w-4" aria-hidden />
            Una etapa
          </Button>
          <Button
            type="button"
            variant={view === "panorama" ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1.5 text-sm"
            onClick={() => setView("panorama")}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Todas
          </Button>
        </div>
      </div>

      {view === "focused" && activeCol ? (
        <section
          className={cn(
            "rounded-2xl border-2 bg-card p-4 shadow-sm md:p-6",
            activeCol.tabActiveClass,
          )}
          aria-labelledby="prog-stage-heading"
        >
          <header className="mb-5 border-b border-border/50 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="prog-stage-heading"
                  className="flex items-center gap-2 text-xl font-semibold tracking-tight md:text-2xl"
                >
                  <span
                    className={cn("h-3 w-3 rounded-full", activeCol.accentClass)}
                    aria-hidden
                  />
                  {activeCol.title}
                </h2>
                <p className="text-muted-foreground mt-1 max-w-xl text-base leading-relaxed">
                  {activeCol.stage === "pendiente"
                    ? "Pedidos cliente sin OT y órdenes de trabajo confirmadas en espera de planta."
                    : activeCol.hint}
                </p>
              </div>
              <p className="text-foreground text-lg font-bold tabular-nums">
                {pendientePanelTotal}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  {pendientePanelTotal === 1 ? "elemento" : "elementos"}
                </span>
              </p>
            </div>
          </header>

          {panelIsEmpty ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16 text-center">
              <activeCol.icon className="h-14 w-14 opacity-25" aria-hidden />
              <p className="text-lg font-medium">No hay órdenes en esta etapa</p>
              <p className="max-w-sm text-base">
                {activeCol.stage === "pendiente"
                  ? "Cuando apruebe un pedido cliente (OC) o llegue una OT a «Pendientes», aparecerá aquí en tarjetas grandes."
                  : `Cuando llegue una OT a «${activeCol.title}», aparecerá aquí en tarjetas grandes y fáciles de leer.`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {showPendingOc
                ? pendingClientOrders.map((co) => (
                    <ProgramacionPendingClientOrderCard key={`co-${co.id}`} order={co} />
                  ))
                : null}
              {activeItems.map((order) => {
                const moves = quickMovesForStage(activeCol.stage).filter((m) =>
                  canMoveStage(activeCol.stage, m.stage),
                )
                return (
                  <ProgramacionKanbanCard
                    key={order.id}
                    order={order}
                    stage={activeCol.stage}
                    statusLabel={statusLabel(order.status)}
                    moves={moves}
                    moving={movingId === order.id}
                    onMove={onMove}
                  />
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {columns.map((col) => {
            const items = filteredByStage[col.stage] ?? []
            const pendingForCol =
              col.stage === "pendiente" ? pendingClientOrders : []
            const colTotal = items.length + pendingForCol.length
            const Icon = col.icon
            return (
              <section
                key={col.stage}
                className="flex flex-col rounded-xl border bg-card shadow-sm"
              >
                <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <span className={cn("h-2.5 w-2.5 rounded-full", col.accentClass)} aria-hidden />
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {col.title}
                  </h3>
                  <span className="bg-muted rounded-md px-2 py-0.5 text-sm font-bold tabular-nums">
                    {colTotal}
                  </span>
                </header>
                <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto p-3">
                  {colTotal === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">
                      Vacío
                    </p>
                  ) : (
                    <>
                      {pendingForCol.map((co) => (
                        <ProgramacionPendingClientOrderCard key={`co-${co.id}`} order={co} />
                      ))}
                      {items.map((order) => {
                        const moves = quickMovesForStage(col.stage).filter((m) =>
                          canMoveStage(col.stage, m.stage),
                        )
                        return (
                          <ProgramacionKanbanCard
                            key={order.id}
                            order={order}
                            stage={col.stage}
                            statusLabel={statusLabel(order.status)}
                            moves={moves}
                            moving={movingId === order.id}
                            onMove={onMove}
                          />
                        )
                      })}
                    </>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
