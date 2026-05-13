"use client"

import { Fragment } from "react"
import type { LucideIcon } from "lucide-react"
import { ClipboardList, Factory, Scissors, Settings2, Truck } from "lucide-react"

import { cn } from "@/lib/utils"

export type WorkOrderLifecycleStage =
  | "especificacion"
  | "orden"
  | "produccion"
  | "corte"
  | "despacho"

const STAGES: Array<{ id: WorkOrderLifecycleStage; label: string; icon: LucideIcon }> = [
  { id: "especificacion", label: "Especificación", icon: Settings2 },
  { id: "orden", label: "Orden de trabajo", icon: ClipboardList },
  { id: "produccion", label: "Producción", icon: Factory },
  { id: "corte", label: "Corte", icon: Scissors },
  { id: "despacho", label: "Despacho", icon: Truck },
]

type WorkOrderStageBadgeProps = {
  current: WorkOrderLifecycleStage
  className?: string
}

/**
 * Indicador visual del ciclo de vida OT → despacho (solo UI, sin llamadas a API).
 */
export function WorkOrderStageBadge({ current, className }: WorkOrderStageBadgeProps) {
  const currentIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.id === current),
  )

  return (
    <nav
      className={cn(
        "flex w-full max-w-full flex-col gap-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm",
        "md:flex-row md:flex-nowrap md:items-center md:gap-1 md:overflow-x-auto md:overscroll-x-contain md:pb-0.5",
        "[-webkit-overflow-scrolling:touch]",
        className,
      )}
      aria-label="Etapas del ciclo de orden de trabajo"
    >
      {STAGES.map((stage, index) => {
        const isCurrent = stage.id === current
        const stepNumber = index + 1
        const StageIcon = stage.icon
        return (
          <Fragment key={stage.id}>
            {index > 0 ? (
              <span
                className="flex w-full shrink-0 justify-center py-0.5 text-xs leading-none text-slate-300 select-none md:hidden"
                aria-hidden
              >
                ↓
              </span>
            ) : null}
            {index > 0 ? (
              <span
                className="hidden shrink-0 self-center px-0.5 text-slate-300 select-none md:inline"
                aria-hidden
              >
                →
              </span>
            ) : null}
            <span className="inline-flex min-h-[44px] w-full min-w-0 shrink-0 items-stretch md:w-auto md:min-w-[8.25rem] md:max-w-[12rem] lg:min-w-0 lg:max-w-none">
              <span
                className={cn(
                  "inline-flex min-h-[40px] w-full min-w-0 flex-col justify-center rounded-md border px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-2 sm:py-1",
                  isCurrent
                    ? "border-slate-900 bg-slate-900 text-white shadow-md"
                    : index < currentIndex
                      ? "border-slate-300 bg-slate-50 text-slate-800"
                      : "border-slate-200 bg-white text-slate-500",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black leading-none",
                    isCurrent
                      ? "bg-white text-slate-900"
                      : index < currentIndex
                        ? "bg-slate-200 text-slate-800"
                        : "bg-slate-100 text-slate-500",
                  )}
                  aria-hidden
                >
                  {stepNumber}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-tight sm:text-xs">
                  <StageIcon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                  <span className="min-w-0 break-words">{stage.label}</span>
                </span>
              </span>
            </span>
          </Fragment>
        )
      })}
      <span className="sr-only">
        Paso actual: {currentIndex + 1} de {STAGES.length}. Etapa:{" "}
        {STAGES[currentIndex]?.label ?? current}.
      </span>
    </nav>
  )
}
