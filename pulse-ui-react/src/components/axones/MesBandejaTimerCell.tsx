"use client"

import { AlarmClock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MesBandejaMes } from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

type Props = {
  mesBand: MesBandejaMes | null
  onOpenDetail: () => void
}

export function MesBandejaTimerCell({ mesBand, onOpenDetail }: Props) {
  const showPaused = mesBand?.workflow === "pausado"
  const showTimes = Boolean(mesBand?.showTimes)
  const hasExtra = showPaused || showTimes

  return (
    <TooltipProvider delayDuration={220}>
      <div className={cn("flex w-full justify-center", hasExtra && "flex-col items-center gap-1")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-primary/30"
              aria-label="Ver tiempos de la OT"
              onClick={onOpenDetail}
            >
              <AlarmClock className="h-5 w-5 shrink-0" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Tiempos (cronómetro, arranque, paradas)</TooltipContent>
        </Tooltip>
        {showPaused ? (
          <p className="text-[10px] font-medium leading-tight text-amber-800 dark:text-amber-200">
            Parada
          </p>
        ) : null}
        {showTimes ? (
          <p className="text-muted-foreground font-mono text-[10px] tabular-nums leading-tight">
            {mesBand!.effectiveHms}
            {mesBand!.showDeadBreakdown ? ` · ${mesBand!.deadHms}` : null}
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  )
}
