"use client"

import type { ReactNode } from "react"
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  PauseCircle,
  PlayCircle,
} from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  mesBandejaStateIconPillClass,
  mesBandejaWorkflowTitle,
  type MesBandejaWorkflow,
} from "@/lib/mes-timer-band-shared"
import { cn } from "@/lib/utils"

type Props = {
  workflow: MesBandejaWorkflow
  /** Si se indica, sustituye el título genérico del workflow (p. ej. fase del cronómetro). */
  statusLabel?: string
  icon?: ReactNode
  className?: string
}

function defaultWorkflowIcon(wf: MesBandejaWorkflow): ReactNode {
  const c = "h-[1.125rem] w-[1.125rem]"
  if (wf === "iniciado") {
    return <PlayCircle className={cn(c, "text-emerald-600 dark:text-emerald-400")} aria-hidden />
  }
  if (wf === "pausado") {
    return <PauseCircle className={cn(c, "text-amber-600 dark:text-amber-400")} aria-hidden />
  }
  if (wf === "entre_turnos") {
    return <Clock className={cn(c, "text-sky-600 dark:text-sky-400")} aria-hidden />
  }
  if (wf === "turno_abierto") {
    return <PlayCircle className={cn(c, "text-cyan-600 dark:text-cyan-400")} aria-hidden />
  }
  if (wf === "finalizado") {
    return <CheckCircle2 className={cn(c, "text-slate-600 dark:text-slate-300")} aria-hidden />
  }
  return <CircleDashed className={cn(c, "text-violet-600 dark:text-violet-400")} aria-hidden />
}

export function MesBandejaWorkflowStatusPill({ workflow, statusLabel, icon, className }: Props) {
  const title = statusLabel?.trim() || mesBandejaWorkflowTitle(workflow)

  return (
    <TooltipProvider delayDuration={220}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(mesBandejaStateIconPillClass(workflow), className)}
            aria-label={title}
          >
            {icon ?? defaultWorkflowIcon(workflow)}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
