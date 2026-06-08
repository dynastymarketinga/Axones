"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  catalogPaginationBarClass,
  catalogPaginationOutlineButtonClass,
  catalogPaginationPageIndicatorClass,
  catalogPaginationSelectTriggerClass,
} from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LaravelPaginated } from "@/types/api"
import { cn } from "@/lib/utils"

const DEFAULT_PER_PAGE_OPTIONS = [10, 20, 50, 100] as const

type CatalogListPaginationProps = {
  rows: LaravelPaginated<unknown> | null
  loading: boolean
  perPage: number
  onPerPageChange: (value: number) => void
  onPageChange: (page: number) => void
  perPageOptions?: readonly number[]
  selectId?: string
}

function CatalogPaginationSummary({ rows }: { rows: LaravelPaginated<unknown> }) {
  const from = rows.from ?? 0
  const to = rows.to ?? 0
  const total = rows.total

  if (rows.last_page > 1) {
    return (
      <div className="min-w-0 space-y-0.5">
        <p className="text-muted-foreground text-sm">
          Mostrando{" "}
          <strong className="font-semibold text-foreground">{from}</strong> a{" "}
          <strong className="font-semibold text-foreground">{to}</strong> de{" "}
          <strong className="font-semibold text-foreground">{total}</strong>
        </p>
        <p className="text-muted-foreground text-xs">
          Página {rows.current_page} de {rows.last_page}
        </p>
      </div>
    )
  }

  return (
    <p className="text-muted-foreground min-w-0 text-sm">
      Mostrando{" "}
      <strong className="font-semibold text-foreground">{from}</strong> a{" "}
      <strong className="font-semibold text-foreground">{to}</strong> de{" "}
      <strong className="font-semibold text-foreground">{total}</strong> registros
    </p>
  )
}

export function CatalogListPagination({
  rows,
  loading,
  perPage,
  onPerPageChange,
  onPageChange,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  selectId = "catalog-per-page",
}: CatalogListPaginationProps) {
  if (!rows || rows.total === 0) return null

  const showPageNav = rows.last_page > 1

  return (
    <div className={catalogPaginationBarClass}>
      <CatalogPaginationSummary rows={rows} />

      <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs sm:text-sm">Por página</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              onPerPageChange(Number(v))
              onPageChange(1)
            }}
          >
            <SelectTrigger
              id={selectId}
              className={cn("h-8 w-[4.5rem] text-sm", catalogPaginationSelectTriggerClass)}
              aria-label="Registros por página"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {perPageOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showPageNav ? (
          <>
            <span className={catalogPaginationPageIndicatorClass} aria-live="polite">
              {rows.current_page} / {rows.last_page}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 gap-1 px-2.5", catalogPaginationOutlineButtonClass)}
                disabled={rows.current_page <= 1 || loading}
                onClick={() => onPageChange(Math.max(1, rows.current_page - 1))}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 gap-1 px-2.5", catalogPaginationOutlineButtonClass)}
                disabled={rows.current_page >= rows.last_page || loading}
                onClick={() => onPageChange(Math.min(rows.last_page, rows.current_page + 1))}
                type="button"
              >
                <span className="hidden sm:inline">Siguiente</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
