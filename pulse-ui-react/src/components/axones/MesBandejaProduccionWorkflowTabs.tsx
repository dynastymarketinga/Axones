"use client"

import {
  CircleDashed,
  Clock,
  PauseCircle,
  PlayCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  MES_PRODUCCION_WORKFLOW_TAB_ORDER,
  mesBandejaWorkflowTitle,
  mesProduccionWorkflowTabToggleClass,
  type MesProduccionWorkflowFilter,
} from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

function workflowTabIcon(wf: MesProduccionWorkflowFilter): LucideIcon {
  if (wf === "iniciado") return PlayCircle
  if (wf === "pausado") return PauseCircle
  if (wf === "turno_abierto") return PlayCircle
  if (wf === "entre_turnos") return Clock
  return CircleDashed
}

type Props = {
  value: MesProduccionWorkflowFilter
  counts: Record<MesProduccionWorkflowFilter, number>
  onChange: (workflow: MesProduccionWorkflowFilter) => void
}

export function MesBandejaProduccionWorkflowTabs({ value, counts, onChange }: Props) {
  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border border-primary/20 bg-gradient-to-br",
        "from-primary/[0.07] via-card/95 to-violet-500/[0.08] p-2.5 shadow-md ring-1 ring-primary/10",
        "dark:from-primary/[0.12] dark:via-card/90 dark:ring-primary/15 sm:p-3",
      )}
    >
      <p className="text-foreground/75 px-0.5 text-[10px] font-bold uppercase tracking-wide">
        Filtrar por estado del cronómetro
      </p>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (
            v &&
            (MES_PRODUCCION_WORKFLOW_TAB_ORDER as readonly string[]).includes(v)
          ) {
            onChange(v as MesProduccionWorkflowFilter)
          }
        }}
        className="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent"
        aria-label="Estado de producción en la bandeja"
      >
        {MES_PRODUCCION_WORKFLOW_TAB_ORDER.map((wf) => {
          const Icon = workflowTabIcon(wf)
          const n = counts[wf] ?? 0
          const active = value === wf
          return (
            <ToggleGroupItem
              key={wf}
              value={wf}
              className={mesProduccionWorkflowTabToggleClass(wf)}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-95" aria-hidden />
              <span>{mesBandejaWorkflowTitle(wf)}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 font-mono text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-black/10 text-inherit dark:bg-white/15"
                    : "bg-black/5 text-inherit/80 dark:bg-white/10",
                )}
              >
                {n}
              </span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}
