"use client"

import { Filter, RotateCcw, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { mesBandejaFilterPanelClass } from "@/components/axones/catalog-list-classes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MesBandejaFiltersPanelProps = {
  activeFilterCount: number
  onClear: () => void
  /** Prioridad, estado OT y fechas OT en una fila. */
  criteriaRow: ReactNode
  /** Búsqueda por texto debajo de los filtros. */
  searchFields: ReactNode
  hint: ReactNode
  className?: string
}

export function MesBandejaFiltersPanel({
  activeFilterCount,
  onClear,
  criteriaRow,
  searchFields,
  hint,
  className,
}: MesBandejaFiltersPanelProps) {
  const hasActive = activeFilterCount > 0

  return (
    <div className={cn(mesBandejaFilterPanelClass, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 bg-primary/[0.04] px-4 py-3 dark:bg-primary/[0.08]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20 shadow-inner"
            aria-hidden
          >
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">Filtros de la bandeja</p>
            <p className="text-muted-foreground hidden text-xs leading-snug sm:block">
              Criterios y fechas al servidor; búsqueda al escribir; cronómetro se filtra debajo.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasActive ? (
            <Badge
              variant="secondary"
              className="gap-1.5 border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-xs tabular-nums text-foreground"
            >
              <Filter className="h-3 w-3 text-primary" aria-hidden />
              {activeFilterCount} activo{activeFilterCount === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
              Sin filtros aplicados
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-primary/25 bg-background/90 shadow-sm hover:bg-primary/10"
            disabled={!hasActive}
            onClick={onClear}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Limpiar
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {criteriaRow}
        {searchFields}
      </div>

      <div className="border-t border-primary/12 bg-muted/25 px-4 py-3 dark:bg-muted/15 sm:px-5">{hint}</div>
    </div>
  )
}
