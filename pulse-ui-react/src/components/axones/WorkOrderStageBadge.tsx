"use client"

import { cn } from "@/lib/utils"

export type WorkOrderLifecycleStage =
  | "especificacion"
  | "orden"
  | "produccion"
  | "corte"
  | "despacho"

const STAGES: Array<{ id: WorkOrderLifecycleStage; label: string }> = [
  { id: "especificacion", label: "Especificación" },
  { id: "orden", label: "Orden de trabajo" },
  { id: "produccion", label: "Producción" },
  { id: "corte", label: "Corte" },
  { id: "despacho", label: "Despacho" },
]

type WorkOrderStageBadgeProps = {
  current: WorkOrderLifecycleStage
  className?: string
}

/**
 * Indicador visual del ciclo de vida OT → despacho (solo UI, sin llamadas a API).
 */
export function WorkOrderStageBadge({ current, className }: WorkOrderStageBadgeProps) {
  return (
    <nav
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs",
        className,
      )}
      aria-label="Etapas del ciclo de orden de trabajo"
    >
      {STAGES.map((stage, index) => {
        const isCurrent = stage.id === current
        return (
          <span key={stage.id} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-muted-foreground/80" aria-hidden>
                →
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 font-medium transition-colors",
                isCurrent
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {stage.label}
            </span>
          </span>
        )
      })}
    </nav>
  )
}
