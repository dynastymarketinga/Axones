"use client"

import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AddButtonProps = {
  onAddPaleta: () => void
  canAddPaleta: boolean
  className?: string
}

export function CortePaletaAddButton({ onAddPaleta, canAddPaleta, className }: AddButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      className={cn("h-8 shadow-sm", className)}
      disabled={!canAddPaleta}
      onClick={onAddPaleta}
    >
      <PlusCircle className="mr-1 h-4 w-4" aria-hidden />
      Agregar paleta
    </Button>
  )
}

type ToolbarProps = {
  totalPaletas: number
  onAddPaleta: () => void
  canAddPaleta: boolean
  className?: string
}

/** Barra superior: acción principal + conteo. */
export function CortePaletasSectionToolbar({
  totalPaletas,
  onAddPaleta,
  canAddPaleta,
  className,
}: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted-foreground text-xs">
        {totalPaletas > 0 ? (
          <>
            <span className="font-medium text-foreground">{totalPaletas}</span> paleta
            {totalPaletas === 1 ? "" : "s"} registrada{totalPaletas === 1 ? "" : "s"}
          </>
        ) : (
          "Aún no hay paletas de salida."
        )}
      </p>
      <CortePaletaAddButton onAddPaleta={onAddPaleta} canAddPaleta={canAddPaleta} />
    </div>
  )
}

type FooterProps = {
  totalPaletas: number
  page: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onAddPaleta: () => void
  canAddPaleta: boolean
  className?: string
}

export function CortePaletasSectionFooter({
  totalPaletas,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onAddPaleta,
  canAddPaleta,
  className,
}: FooterProps) {
  const rangeStart = totalPaletas === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = totalPaletas === 0 ? 0 : Math.min(page * pageSize, totalPaletas)
  const showPager = totalPages > 1

  return (
    <footer
      className={cn(
        "flex flex-col gap-3 border-t border-border/70 bg-muted/30 px-3 py-3 shadow-[inset_0_1px_0_0_hsl(var(--background)/0.6)] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted-foreground text-xs leading-snug">
        {totalPaletas > 0 ? (
          <>
            Mostrando paletas{" "}
            <span className="font-medium tabular-nums text-foreground">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            de <span className="font-medium tabular-nums text-foreground">{totalPaletas}</span>
            {showPager ? (
              <>
                {" "}
                · cuadro{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {page}/{totalPages}
                </span>
              </>
            ) : null}
          </>
        ) : (
          "Sin paletas. Use el botón para agregar la primera."
        )}
      </p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {showPager ? (
          <nav
            className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-background p-0.5 shadow-sm"
            aria-label="Paginación de paletas"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="text-muted-foreground min-w-[5.5rem] px-2 text-center text-xs font-medium tabular-nums">
              Cuadro {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2.5"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </nav>
        ) : null}

        <CortePaletaAddButton onAddPaleta={onAddPaleta} canAddPaleta={canAddPaleta} />
      </div>
    </footer>
  )
}
