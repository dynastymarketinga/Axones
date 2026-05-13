/** Clases compartidas con el listado de Órdenes de compra */
export const catalogTableHeaderRowClass =
  "border-b bg-muted/25 hover:bg-muted/25"

export const catalogTableBodyRowClass =
  "group hover:bg-transparent data-[state=selected]:bg-transparent focus-within:bg-transparent"

export const catalogTableBodyCellClass =
  "transition-colors group-hover:bg-muted/60"

export const catalogActionButtonClass =
  "h-9 w-9 border-primary/25 text-primary hover:bg-primary/10"

/** Panel que agrupa filtros de bandeja / catálogo (borde suave, sombra ligera). */
export const catalogFilterPanelClass =
  "rounded-xl border border-primary/20 bg-card/90 p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-card/70 dark:ring-white/[0.06]"

export const catalogSelectTriggerClass =
  "h-11 rounded-lg border border-primary/25 bg-background font-normal shadow-sm transition-[border-color,box-shadow] hover:border-primary/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"

export const catalogSearchInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background pl-9 text-base shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"

/** Inputs tipo fecha en rejillas de filtro (misma altura y acento que selects). */
export const catalogFilterDateInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background text-sm shadow-sm transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"

/** Select «por página» en barras de paginación (superficie opaca sobre gradientes). */
export const catalogPaginationSelectTriggerClass =
  "border-input bg-card text-card-foreground shadow-sm"

/** Botones Anterior/Siguiente en la misma barra (outline + fondo card; disabled legible). */
export const catalogPaginationOutlineButtonClass =
  "bg-card disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"
