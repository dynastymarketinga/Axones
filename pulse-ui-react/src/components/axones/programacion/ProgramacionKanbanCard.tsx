"use client"

import { ArrowRight, ExternalLink } from "lucide-react"
import { Link } from "react-router-dom"

import { priorityCardClass } from "@/components/axones/programacion/programacion-kanban-config"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkOrderListRow } from "@/types/api"

export type QuickMove = { stage: string; label: string }

type ProgramacionKanbanCardProps = {
  order: WorkOrderListRow
  stage: string
  statusLabel: string
  moves: QuickMove[]
  moving: boolean
  onMove: (woId: number, targetStage: string, fromNueva: boolean) => void
}

export function ProgramacionKanbanCard({
  order,
  stage,
  statusLabel,
  moves,
  moving,
  onMove,
}: ProgramacionKanbanCardProps) {
  const priority = (order.priority ?? "").toLowerCase().trim()
  const primaryMove = moves[0]

  return (
    <article
      className={cn(
        "rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        "border-l-[5px]",
        priorityCardClass(order.priority),
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <Link
          to={`/ordenes-trabajo/${order.id}`}
          className="font-mono text-lg font-bold leading-tight text-primary hover:underline"
        >
          {order.code}
        </Link>
        {priority === "urgente" || priority === "alta" ? (
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide",
              priority === "urgente"
                ? "bg-red-600 text-white"
                : "bg-orange-500 text-white",
            )}
          >
            {priority === "urgente" ? "Urgente" : "Prioridad alta"}
          </span>
        ) : null}
      </div>

      <dl className="space-y-2 text-base">
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Cliente</dt>
          <dd className="font-semibold leading-snug">{order.client?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Producto</dt>
          <dd className="text-foreground/90 leading-snug">{order.product?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm font-medium">Estado</dt>
          <dd className="font-medium">{statusLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-2">
        {primaryMove ? (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full text-base font-semibold"
            variant={primaryMove.stage === "completada" ? "default" : "secondary"}
            disabled={moving}
            onClick={() => onMove(order.id, primaryMove.stage, stage === "nueva")}
          >
            {moving ? "Guardando…" : primaryMove.label}
            {!moving ? <ArrowRight className="ml-1 h-4 w-4" aria-hidden /> : null}
          </Button>
        ) : null}
        <Button variant="outline" size="lg" className="h-11 w-full text-base" asChild>
          <Link to={`/ordenes-trabajo/${order.id}`}>
            Ver detalle
            <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  )
}
