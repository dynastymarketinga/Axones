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

/** Panel de filtros en catálogos de datos maestros (gradiente suave). */
export const catalogMasterFilterPanelClass =
  "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card/98 to-violet-500/[0.06] p-4 shadow-sm ring-1 ring-primary/10 dark:from-primary/[0.12] dark:via-card/95 dark:to-violet-500/[0.08]"

/** Contenedor de tabla en catálogos de datos maestros. */
export const catalogMasterTablePanelClass =
  "overflow-hidden overflow-x-auto rounded-2xl border border-primary/15 bg-card/95 shadow-md ring-1 ring-black/[0.03] dark:bg-card/90 dark:ring-white/[0.05]"

/** Barra de paginación en catálogos de datos maestros. */
export const catalogPaginationBarClass =
  "flex flex-col gap-3 rounded-2xl border border-primary/15 bg-gradient-to-b from-card via-card/98 to-primary/[0.04] px-4 py-3.5 text-sm shadow-sm ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:to-primary/[0.07]"

/** Indicador compacto de página actual (p. ej. 2 / 5). */
export const catalogPaginationPageIndicatorClass =
  "inline-flex min-w-[3.25rem] items-center justify-center rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 text-xs font-semibold tabular-nums text-primary"

/** Fila de acciones en tablas de catálogo (visible al hover). */
export const catalogRowActionsClass =
  "inline-flex flex-wrap justify-end gap-1 opacity-100 transition-opacity sm:opacity-70 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"

/** Panel de filtros superiores en bandejas MES (impresión, laminación, corte). */
export const mesBandejaFilterPanelClass =
  "overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card/98 to-violet-500/[0.07] shadow-md ring-1 ring-primary/12 dark:from-primary/[0.14] dark:via-card/92 dark:to-violet-500/[0.1]"

/** Select/input con filtro activo (no «Todos» / vacío). */
export const mesBandejaFilterActiveControlClass =
  "border-primary/45 bg-primary/[0.06] ring-1 ring-primary/15"

/** Shell de filtros estandarizado en páginas de reportes (modelo Desperdicio). */
export const reportFiltersPanelClass =
  "overflow-hidden rounded-2xl border border-primary/25 shadow-md bg-gradient-to-br from-primary/[0.07] via-card to-card ring-1 ring-primary/10 dark:from-primary/[0.12] dark:via-card/95 dark:to-card/90"

export const catalogSelectTriggerClass =
  "h-11 rounded-lg border border-primary/25 bg-background font-normal shadow-sm transition-[border-color,box-shadow] hover:border-primary/35 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"

export const catalogSearchInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background pl-9 text-base shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"

/** Inputs tipo fecha en rejillas de filtro (misma altura y acento que selects). */
export const catalogFilterDateInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background text-sm shadow-sm transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"

/** Rejilla «Filtrar listado»: 1 col móvil, 2 cols tablet, 12 cols en pantallas anchas. */
export const catalogFilterGridClass =
  "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12"

/** Rejilla compacta (pocos filtros): 1 col móvil, 2 cols desde tablet. */
export const catalogFilterGridCompactClass =
  "grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"

export const catalogFilterCol2Class = "min-w-0 xl:col-span-2"
export const catalogFilterCol3Class = "min-w-0 sm:col-span-2 xl:col-span-3"
export const catalogFilterCol4Class = "min-w-0 sm:col-span-2 xl:col-span-4"
export const catalogFilterCol5Class = "min-w-0 sm:col-span-2 xl:col-span-5"
export const catalogFilterCol8Class = "min-w-0 sm:col-span-2 xl:col-span-8"

/** Botonera bajo filtros: apilada en móvil, fila en tablet+. */
export const catalogFilterActionsClass =
  "flex flex-col gap-2 sm:flex-row sm:flex-wrap"

/** Select «por página» en barras de paginación (superficie opaca sobre gradientes). */
export const catalogPaginationSelectTriggerClass =
  "border-input bg-card text-card-foreground shadow-sm"

/** Botones Anterior/Siguiente en la misma barra (outline + fondo card; disabled legible). */
export const catalogPaginationOutlineButtonClass =
  "bg-card disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground"

/** Panel de formulario en catálogos de datos maestros. */
export const catalogMasterFormPanelClass =
  "mx-auto w-full max-w-5xl space-y-6 overflow-hidden rounded-2xl border border-primary/15 bg-card/95 p-6 shadow-md ring-1 ring-black/[0.03] dark:bg-card/90 dark:ring-white/[0.05] sm:p-8"

/** Panel ancho (p. ej. órdenes de compra con tabla de líneas). */
export const catalogMasterFormPanelWideClass =
  "mx-auto w-full space-y-6 overflow-hidden rounded-2xl border border-primary/15 bg-card/95 p-6 shadow-md ring-1 ring-black/[0.03] dark:bg-card/90 dark:ring-white/[0.05] sm:p-8"

/** Input en formularios maestros (misma altura y acento que filtros). */
export const catalogMasterFormPlainInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background px-3 text-base shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"

/** Input con icono en formularios maestros (misma altura y acento que filtros). */
export const catalogMasterFormInputClass =
  "h-11 rounded-lg border border-primary/25 bg-background pl-10 text-base shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"

/** Icono dentro del input en formularios maestros. */
export const catalogMasterFormFieldIconClass =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors text-muted-foreground group-focus-within/field:text-primary"

/** Botonera inferior en formularios maestros (acciones centradas). */
export const catalogMasterFormActionsClass =
  "flex flex-col-reverse items-stretch gap-2 border-t border-primary/10 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3"

/** Encabezado interno de sección en formularios maestros. */
export const catalogMasterFormSectionClass =
  "space-y-1 border-b border-primary/10 pb-5"
