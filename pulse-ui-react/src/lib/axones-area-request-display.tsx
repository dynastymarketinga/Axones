"use client"

import { CheckCircle2, CircleDot, Clock, XCircle } from "lucide-react"

import { cn } from "@/lib/utils"

export function areaRequestStatusLabel(v?: string | null): string {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "pending") return "Pendiente"
  if (key === "done") return "Hecho"
  if (key === "cancelled") return "Cancelado"
  return v?.trim() || "—"
}

export function areaRequestBadgeClass(v?: string | null): string {
  const key = (v ?? "").toLowerCase().trim()
  if (key === "done") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-emerald-950 dark:text-emerald-100 border-emerald-500/28 bg-emerald-500/10"
  }
  if (key === "cancelled") {
    return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight border-muted-foreground/35 bg-muted/70 text-muted-foreground"
  }
  return "gap-1 rounded-md border px-2 py-0 text-[11px] font-medium leading-tight text-amber-950 dark:text-amber-100 border-amber-500/30 bg-amber-500/10"
}

export function areaRequestStatusGlyph(req?: string | null) {
  const key = (req ?? "").toLowerCase().trim()
  const c = "h-3 w-3 shrink-0"
  if (!key) {
    return <CircleDot className={cn(c, "text-muted-foreground")} aria-hidden />
  }
  if (key === "done") {
    return <CheckCircle2 className={cn(c, "text-emerald-600 dark:text-emerald-400")} aria-hidden />
  }
  if (key === "cancelled") {
    return <XCircle className={cn(c, "text-muted-foreground")} aria-hidden />
  }
  return <Clock className={cn(c, "text-amber-700 dark:text-amber-300")} aria-hidden />
}
