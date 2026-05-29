"use client"

import { AlarmClock, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MesBandejaMes } from "@/lib/mes-timer-band-shared"
import { mesBandejaWorkflowTitle } from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

type Props = {
  mesBand: MesBandejaMes | null
  onOpenDetail: () => void
}

export function MesBandejaTimerCell({ mesBand, onOpenDetail }: Props) {
  return (
    <TooltipProvider delayDuration={220}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDetail}
            className="text-primary inline-flex max-w-full items-center gap-2 rounded-md text-left text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:text-sm"
          >
            <Timer className="h-7 w-7 shrink-0 opacity-90 sm:h-8 sm:w-8" strokeWidth={2.25} aria-hidden />
            <span className="min-w-0 leading-snug">Tiempos y detalle</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-primary/30"
                aria-label="Turnos acumulativos y personal"
                onClick={onOpenDetail}
              >
                <AlarmClock className="h-5 w-5 shrink-0" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Turnos acumulativos y personal</TooltipContent>
          </Tooltip>
        </div>
        {mesBand ? (
          <p
            className={cn(
              "text-xs font-semibold leading-snug",
              mesBand.workflow === "pausado" && "text-amber-800 dark:text-amber-200",
              mesBand.workflow === "iniciado" && "text-emerald-800 dark:text-emerald-200",
              mesBand.workflow === "entre_turnos" && "text-sky-800 dark:text-sky-200",
              mesBand.workflow === "turno_abierto" && "text-cyan-800 dark:text-cyan-200",
              mesBand.workflow === "finalizado" && "text-slate-600 dark:text-slate-300",
              mesBand.workflow === "sin_iniciar" && "text-muted-foreground",
            )}
          >
            {mesBandejaWorkflowTitle(mesBand.workflow)}
            {mesBand.workflow === "pausado" ? " · parada registrada" : null}
          </p>
        ) : null}
        {mesBand?.showTimes ? (
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            Tiempo efectivo: {mesBand.effectiveHms}
            {mesBand.showDeadBreakdown ? ` · Muerto ${mesBand.deadHms}` : null}
          </p>
        ) : null}
        {mesBand?.producidoKg != null ? (
          <p className="text-muted-foreground text-xs tabular-nums">
            Producido acum.:{" "}
            <span className="font-mono font-semibold text-foreground">{mesBand.producidoKg.toFixed(2)} Kg</span>
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
