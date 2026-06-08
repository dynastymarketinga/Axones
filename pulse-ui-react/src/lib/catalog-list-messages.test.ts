import { describe, expect, it } from "vitest"

import {
  catalogPaginationSummaryMessage,
  catalogTableEmptyMessage,
} from "@/lib/catalog-list-messages"

describe("catalogTableEmptyMessage", () => {
  it("usa emptyLabel sin filtros activos", () => {
    expect(
      catalogTableEmptyMessage({
        emptyLabel: "Sin vendedores.",
        hasActiveFilters: false,
      }),
    ).toBe("Sin vendedores.")
  })

  it("prioriza mensaje de filtros cuando hay búsqueda o estado", () => {
    expect(
      catalogTableEmptyMessage({
        emptyLabel: "Sin vendedores.",
        hasActiveFilters: true,
      }),
    ).toBe("Sin resultados con los filtros actuales.")
  })
})

describe("catalogPaginationSummaryMessage", () => {
  it("no repite mensaje cuando total es cero", () => {
    expect(
      catalogPaginationSummaryMessage({
        total: 0,
        from: null,
        to: null,
        currentPage: 1,
        lastPage: 1,
      }),
    ).toBeNull()
  })

  it("resume una sola página", () => {
    expect(
      catalogPaginationSummaryMessage({
        total: 3,
        from: 1,
        to: 3,
        currentPage: 1,
        lastPage: 1,
      }),
    ).toBe("Mostrando 1 a 3 de 3 registros")
  })

  it("resume paginación múltiple", () => {
    expect(
      catalogPaginationSummaryMessage({
        total: 45,
        from: 21,
        to: 40,
        currentPage: 2,
        lastPage: 3,
      }),
    ).toBe("Mostrando 21 a 40 de 45 · página 2 de 3")
  })
})
