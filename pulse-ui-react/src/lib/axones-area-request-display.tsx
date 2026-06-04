"use client"

import { CheckCircle2, CircleDot, Clock, XCircle } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export function areaRequestStatusLabel(v?: string | null): string {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "pending") return "Pendiente"
  if (key === "done") return "Hecho"
  if (key === "cancelled") return "Cancelado"
  return v?.trim() || "—"
}

export function areaRequestStatusTooltip(v?: string | null): { title: string; description: string } {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "done") {
    return {
      title: "Hecho",
      description:
        "La solicitud al área fue atendida y cerrada (material entregado o proceso completado según el flujo del área).",
    }
  }
  if (key === "cancelled") {
    return {
      title: "Cancelado",
      description:
        "La solicitud al área fue cancelada; la OT puede continuar sin esta cola administrativa activa.",
    }
  }
  return {
    title: "Pendiente",
    description:
      "Solicitud administrativa al área en cola: la OT espera atención del área o ya está en esta etapa sin cerrar la solicitud. No es el estado del cronómetro MES (turno abierto, pausa, etc.).",
  }
}

export function areaRequestBadgeClass(v?: string | null): string {
  const base =
    "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide shadow-sm ring-1 sm:text-sm"
  const key = (v ?? "").toLowerCase().trim()
  if (key === "done") {
    return `${base} border-emerald-500/55 bg-emerald-500/22 text-emerald-950 ring-emerald-500/30 dark:bg-emerald-500/28 dark:text-emerald-50`
  }
  if (key === "cancelled") {
    return `${base} border-slate-500/45 bg-slate-500/15 text-slate-700 ring-slate-500/20 dark:bg-slate-500/22 dark:text-slate-200`
  }
  return `${base} border-amber-500/60 bg-amber-500/26 text-amber-950 ring-amber-500/40 dark:bg-amber-500/32 dark:text-amber-50`
}

export function areaRequestIconButtonClass(v?: string | null): string {
  const base =
    "group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const key = (v ?? "").toLowerCase().trim()
  if (key === "done") {
    return `${base} border-emerald-500/35 bg-emerald-500/10 text-emerald-700/70 hover:border-emerald-500 hover:bg-emerald-500/25 hover:text-emerald-600 hover:shadow-[0_0_12px_rgba(16,185,129,0.45)] dark:text-emerald-400 dark:hover:text-emerald-300`
  }
  if (key === "cancelled") {
    return `${base} border-slate-500/35 bg-slate-500/10 text-slate-600/70 hover:border-slate-500 hover:bg-slate-500/22 hover:text-slate-700 hover:shadow-[0_0_10px_rgba(100,116,139,0.35)] dark:text-slate-400 dark:hover:text-slate-200`
  }
  return `${base} border-amber-500/40 bg-amber-500/12 text-amber-700/65 hover:border-amber-500 hover:bg-amber-500/28 hover:text-amber-600 hover:shadow-[0_0_14px_rgba(245,158,11,0.55)] dark:text-amber-400 dark:hover:text-amber-200`
}

export function areaRequestStatusGlyph(req?: string | null, iconClassName?: string) {
  const key = (req ?? "").toLowerCase().trim()
  const c = cn("h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110", iconClassName)
  if (!key) {
    return <CircleDot className={cn(c, "text-muted-foreground")} aria-hidden />
  }
  if (key === "done") {
    return <CheckCircle2 className={cn(c, "text-current")} aria-hidden />
  }
  if (key === "cancelled") {
    return <XCircle className={cn(c, "text-current")} aria-hidden />
  }
  return <Clock className={cn(c, "text-current")} aria-hidden />
}

export function AreaRequestStatusIcon({
  status,
  className,
  side = "top",
}: {
  status?: string | null
  className?: string
  side?: "top" | "bottom" | "left" | "right"
}) {
  const { title, description } = areaRequestStatusTooltip(status)
  const label = areaRequestStatusLabel(status)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(areaRequestIconButtonClass(status), className)}
            aria-label={`Solicitud al área: ${label}`}
          >
            {areaRequestStatusGlyph(status)}
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[17rem] space-y-1 text-left">
          <p className="font-semibold leading-none">{title}</p>
          <p className="text-primary-foreground/90 leading-snug">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
