/** Clases compartidas con el listado de Órdenes de compra */
export const catalogTableHeaderRowClass =
  "border-b bg-muted/25 hover:bg-muted/25"

export const catalogTableBodyRowClass =
  "group hover:bg-transparent data-[state=selected]:bg-transparent focus-within:bg-transparent"

export const catalogTableBodyCellClass =
  "transition-colors group-hover:bg-muted/60"

export const catalogActionButtonClass =
  "h-9 w-9 border-primary/25 text-primary hover:bg-primary/10"

export const catalogSelectTriggerClass =
  "h-11 border-primary/30 bg-background/95"

export const catalogSearchInputClass =
  "h-11 border-primary/30 bg-background/95 pl-9 text-base focus-visible:ring-primary/40 md:text-sm"

/** Select «por página» en barras de paginación (superficie opaca sobre gradientes). */
export const catalogPaginationSelectTriggerClass =
  "border-input bg-card text-card-foreground shadow-sm"

/** Botones Anterior/Siguiente en la misma barra (outline + fondo card; disabled legible). */
export const catalogPaginationOutlineButtonClass =
  "bg-card disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"
