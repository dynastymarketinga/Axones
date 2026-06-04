"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type MesBandejaCriteriaAccent = "violet" | "sky" | "amber" | "orange"

const SHELL: Record<MesBandejaCriteriaAccent, string> = {
  violet:
    "border-violet-500/30 from-violet-500/12 via-background/95 to-violet-500/[0.04] ring-violet-500/15 dark:from-violet-500/18",
  sky: "border-sky-500/30 from-sky-500/12 via-background/95 to-sky-500/[0.04] ring-sky-500/15 dark:from-sky-500/18",
  amber:
    "border-amber-500/30 from-amber-500/12 via-background/95 to-amber-500/[0.04] ring-amber-500/15 dark:from-amber-500/18",
  orange:
    "border-orange-500/30 from-orange-500/12 via-background/95 to-orange-500/[0.04] ring-orange-500/15 dark:from-orange-500/18",
}

const SHELL_ACTIVE: Record<MesBandejaCriteriaAccent, string> = {
  violet: "border-violet-600/55 bg-violet-500/14 ring-2 ring-violet-500/25",
  sky: "border-sky-600/55 bg-sky-500/14 ring-2 ring-sky-500/25",
  amber: "border-amber-600/55 bg-amber-500/14 ring-2 ring-amber-500/25",
  orange: "border-orange-600/55 bg-orange-500/14 ring-2 ring-orange-500/25",
}

const ICON_WRAP: Record<MesBandejaCriteriaAccent, string> = {
  violet: "bg-violet-500/18 text-violet-700 ring-violet-500/25 dark:text-violet-200",
  sky: "bg-sky-500/18 text-sky-700 ring-sky-500/25 dark:text-sky-200",
  amber: "bg-amber-500/18 text-amber-800 ring-amber-500/25 dark:text-amber-200",
  orange: "bg-orange-500/18 text-orange-800 ring-orange-500/25 dark:text-orange-200",
}

const LABEL: Record<MesBandejaCriteriaAccent, string> = {
  violet: "text-violet-900/90 dark:text-violet-100",
  sky: "text-sky-900/90 dark:text-sky-100",
  amber: "text-amber-950/90 dark:text-amber-100",
  orange: "text-orange-950/90 dark:text-orange-100",
}

/** Select/combobox de criterio en bandeja MES. */
export function mesBandejaCriteriaSelectClass(
  accent: MesBandejaCriteriaAccent,
  active = false,
): string {
  const base =
    "h-10 w-full rounded-lg border-2 bg-background/95 font-medium shadow-inner transition-all hover:brightness-[1.02] focus-visible:ring-2 focus-visible:ring-offset-1"
  if (accent === "violet") {
    return cn(
      base,
      active
        ? "border-violet-600/60 text-violet-950 ring-violet-500/30 focus-visible:ring-violet-500/40 dark:text-violet-50"
        : "border-violet-500/25 text-foreground hover:border-violet-500/45 focus-visible:ring-violet-500/30",
    )
  }
  if (accent === "sky") {
    return cn(
      base,
      active
        ? "border-sky-600/60 text-sky-950 ring-sky-500/30 focus-visible:ring-sky-500/40 dark:text-sky-50"
        : "border-sky-500/25 text-foreground hover:border-sky-500/45 focus-visible:ring-sky-500/30",
    )
  }
  if (accent === "amber") {
    return cn(
      base,
      active
        ? "border-amber-600/60 text-amber-950 ring-amber-500/30 focus-visible:ring-amber-500/40 dark:text-amber-50"
        : "border-amber-500/25 text-foreground hover:border-amber-500/45 focus-visible:ring-amber-500/30",
    )
  }
  return cn(
    base,
    active
      ? "border-orange-600/60 text-orange-950 ring-orange-500/30 focus-visible:ring-orange-500/40 dark:text-orange-50"
      : "border-orange-500/25 text-foreground hover:border-orange-500/45 focus-visible:ring-orange-500/30",
  )
}

/** Input fecha en bandeja MES. */
export function mesBandejaCriteriaDateClass(
  accent: MesBandejaCriteriaAccent,
  active = false,
): string {
  const base =
    "h-10 w-full rounded-lg border-2 bg-background/95 px-3 text-sm font-medium shadow-inner transition-all hover:brightness-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 [color-scheme:light] dark:[color-scheme:dark]"
  if (accent === "amber") {
    return cn(
      base,
      active
        ? "border-amber-600/60 text-amber-950 focus-visible:ring-amber-500/40 dark:text-amber-50"
        : "border-amber-500/25 hover:border-amber-500/45 focus-visible:ring-amber-500/30",
    )
  }
  return cn(
    base,
    active
      ? "border-orange-600/60 text-orange-950 focus-visible:ring-orange-500/40 dark:text-orange-50"
      : "border-orange-500/25 hover:border-orange-500/45 focus-visible:ring-orange-500/30",
  )
}

type MesBandejaCriteriaFieldProps = {
  label: string
  icon: LucideIcon
  accent: MesBandejaCriteriaAccent
  active?: boolean
  className?: string
  children: ReactNode
}

export function MesBandejaCriteriaField({
  label,
  icon: Icon,
  accent,
  active = false,
  className,
  children,
}: MesBandejaCriteriaFieldProps) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-gradient-to-br p-2 shadow-sm ring-1 transition-all",
        SHELL[accent],
        active && SHELL_ACTIVE[accent],
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-2 px-0.5">
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 shadow-inner",
            ICON_WRAP[accent],
          )}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className={cn("truncate text-[11px] font-bold uppercase tracking-wide", LABEL[accent])}>
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
