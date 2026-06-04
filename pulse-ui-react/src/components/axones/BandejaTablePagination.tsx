"use client"

import { ChevronLeft, ChevronRight, MoreHorizontal, Rows3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import type { LaravelPaginated } from "@/types/api"

export const BANDEJA_PER_PAGE_OPTIONS = [10, 20, 50] as const

type BandejaTablePaginationProps = {
  rows: LaravelPaginated<unknown>
  page: number
  perPage: number
  loading?: boolean
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}

/** Ventana de páginas con huecos para elipsis. */
function pageWindow(current: number, last: number): Array<number | "gap"> {
  if (last <= 1) return [1]
  if (last <= 6) {
    return Array.from({ length: last }, (_, i) => i + 1)
  }
  const set = new Set<number>([1, last, current, current - 1, current + 1])
  const sorted = [...set].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
  const out: Array<number | "gap"> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) out.push("gap")
    out.push(sorted[i]!)
  }
  return out
}

export function BandejaTablePagination({
  rows,
  page,
  perPage,
  loading = false,
  onPageChange,
  onPerPageChange,
}: BandejaTablePaginationProps) {
  const { current_page, last_page, total, from, to } = rows
  const hasMultiplePages = last_page > 1
  const pages = pageWindow(current_page, last_page)

  return (
    <div
      className={cn(
        "mt-3 flex flex-col gap-3 rounded-xl border border-primary/15 bg-gradient-to-br",
        "from-primary/[0.05] via-card/95 to-violet-500/[0.06] px-3 py-3 shadow-sm ring-1 ring-black/[0.03]",
        "dark:ring-white/[0.05] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
      )}
      role="navigation"
      aria-label="Paginación de la bandeja"
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
        <span
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15 sm:mt-0"
          aria-hidden
        >
          <Rows3 className="h-4 w-4" />
        </span>
        <p className="min-w-0 text-left text-xs leading-snug text-muted-foreground sm:text-sm">
          {total === 0 ? (
            "Sin resultados con los filtros actuales."
          ) : (
            <>
              <span className="text-foreground/90">Mostrando </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">{from ?? 0}</span>
              <span className="text-foreground/90"> – </span>
              <span className="font-mono font-semibold tabular-nums text-foreground">{to ?? 0}</span>
              <span className="text-foreground/90"> de </span>
              <span className="font-mono font-semibold tabular-nums text-primary">{total}</span>
              {hasMultiplePages ? (
                <span className="text-foreground/80">
                  {" "}
                  · página{" "}
                  <span className="font-mono font-semibold tabular-nums text-foreground">{current_page}</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="font-mono font-semibold tabular-nums text-foreground">{last_page}</span>
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-muted-foreground shrink-0 text-[11px] font-medium uppercase tracking-wide">
            Filas
          </span>
          <ToggleGroup
            type="single"
            value={String(perPage)}
            onValueChange={(v) => {
              const n = Number(v)
              if (BANDEJA_PER_PAGE_OPTIONS.includes(n as (typeof BANDEJA_PER_PAGE_OPTIONS)[number])) {
                onPerPageChange(n)
              }
            }}
            className="h-8 rounded-lg border border-primary/15 bg-background/80 p-0.5 shadow-inner"
          >
            {BANDEJA_PER_PAGE_OPTIONS.map((n) => (
              <ToggleGroupItem
                key={n}
                value={String(n)}
                className={cn(
                  "h-7 min-w-[2.25rem] rounded-md px-2.5 font-mono text-xs font-semibold tabular-nums",
                  "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm",
                )}
                aria-label={`${n} por página`}
              >
                {n}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {hasMultiplePages ? (
          <div
            className="flex items-center justify-center gap-1 rounded-lg border border-primary/12 bg-background/70 p-0.5 shadow-sm"
            aria-label="Ir a página"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              disabled={current_page <= 1 || loading}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>

            <div className="flex items-center gap-0.5 px-0.5">
              {pages.map((p, i) =>
                p === "gap" ? (
                  <span
                    key={`gap-${i}`}
                    className="flex h-8 w-7 items-center justify-center text-muted-foreground/70"
                    aria-hidden
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <Button
                    key={p}
                    type="button"
                    variant={p === current_page ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-8 min-w-[2rem] rounded-md px-2 font-mono text-xs font-semibold tabular-nums",
                      p === current_page
                        ? "pointer-events-none bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                    )}
                    disabled={loading}
                    onClick={() => onPageChange(p)}
                    aria-label={`Página ${p}`}
                    aria-current={p === current_page ? "page" : undefined}
                  >
                    {p}
                  </Button>
                ),
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              disabled={current_page >= last_page || loading}
              onClick={() => onPageChange(Math.min(last_page, page + 1))}
              aria-label="Página siguiente"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
