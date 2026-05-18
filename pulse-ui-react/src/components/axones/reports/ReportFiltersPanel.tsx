"use client"

import type { ReactNode } from "react"
import { Filter, Loader2, X } from "lucide-react"

import { reportFiltersPanelClass } from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ReportFilterChip = {
  id: string
  label: ReactNode
  icon?: ReactNode
  className?: string
  onRemove: () => void
  removeLabel: string
}

type ReportFiltersPanelProps = {
  title?: string
  subtitle?: string
  loading?: boolean
  activeFilterCount?: number
  children: ReactNode
  chips?: ReportFilterChip[]
  onClearAll?: () => void
  className?: string
}

export function ReportFiltersPanel({
  title = "Filtros del reporte",
  subtitle,
  loading = false,
  activeFilterCount = 0,
  children,
  chips,
  onClearAll,
  className,
}: ReportFiltersPanelProps) {
  const showChips = chips != null && chips.length > 0

  return (
    <div className={cn(reportFiltersPanelClass, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
            <Filter className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-sm font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
          </div>
        </div>
        {loading ? (
          <Badge
            variant="secondary"
            className="gap-1.5 border-primary/20 bg-primary/10 text-primary shadow-none"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Actualizando…
          </Badge>
        ) : activeFilterCount > 0 ? (
          <Badge variant="secondary" className="border-primary/25 bg-primary/10 text-primary shadow-none">
            {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"} activo
            {activeFilterCount === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">{children}</div>

      {showChips ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-primary/10 px-4 pb-4 pt-3 sm:px-5">
          <span className="text-muted-foreground text-xs font-medium">Activos:</span>
          {chips!.map((chip) => (
            <Badge key={chip.id} variant="outline" className={cn("gap-1 pr-1", chip.className)}>
              {chip.icon}
              <span className="max-w-[12rem] truncate">{chip.label}</span>
              <button
                type="button"
                className="hover:bg-black/5 ml-0.5 rounded p-0.5 dark:hover:bg-white/10"
                aria-label={chip.removeLabel}
                onClick={chip.onRemove}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </Badge>
          ))}
          {onClearAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 px-2 text-xs"
              onClick={onClearAll}
            >
              Limpiar todo
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
