type CatalogTableEmptyMessageArgs = {
  emptyLabel: string
  hasActiveFilters: boolean
}

/** Mensaje único dentro de la tabla cuando no hay filas. */
export function catalogTableEmptyMessage({
  emptyLabel,
  hasActiveFilters,
}: CatalogTableEmptyMessageArgs): string {
  if (hasActiveFilters) {
    return "Sin resultados con los filtros actuales."
  }
  return emptyLabel
}

type CatalogPaginationSummaryMessageArgs = {
  total: number
  from?: number | null
  to?: number | null
  currentPage: number
  lastPage: number
}

/** Resumen bajo la tabla; null cuando no hay registros (evita duplicar el vacío). */
export function catalogPaginationSummaryMessage({
  total,
  from,
  to,
  currentPage,
  lastPage,
}: CatalogPaginationSummaryMessageArgs): string | null {
  if (total === 0) return null

  const rangeFrom = from ?? 0
  const rangeTo = to ?? 0

  if (lastPage > 1) {
    return `Mostrando ${rangeFrom} a ${rangeTo} de ${total} · página ${currentPage} de ${lastPage}`
  }

  return `Mostrando ${rangeFrom} a ${rangeTo} de ${total} registros`
}
