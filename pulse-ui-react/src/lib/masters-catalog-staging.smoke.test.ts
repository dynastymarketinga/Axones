import { describe, expect, it } from "vitest"

import { buildAxonesBreadcrumbTrail } from "@/lib/axones-breadcrumb-trail"
import { catalogCountLabel } from "@/lib/catalog-count-label"
import {
  catalogPaginationSummaryMessage,
  catalogTableEmptyMessage,
} from "@/lib/catalog-list-messages"

/** Smoke checks for the 5 Datos maestros list routes before deploy. */
const MASTERS_LIST_ROUTES = [
  {
    path: "/vendedores",
    label: "Vendedores",
    emptyLabel: "Sin vendedores.",
    singular: "vendedor",
    plural: "vendedores",
  },
  {
    path: "/clientes",
    label: "Clientes",
    emptyLabel: "Sin clientes.",
    singular: "cliente",
    plural: "clientes",
  },
  {
    path: "/productos",
    label: "Especificaciones de producto",
    emptyLabel: "Sin especificaciones.",
    singular: "especificación",
    plural: "especificaciones",
  },
  {
    path: "/proveedores",
    label: "Proveedores",
    emptyLabel: "Sin proveedores.",
    singular: "proveedor",
    plural: "proveedores",
  },
  {
    path: "/ordenes-compra",
    label: "Órdenes de compra",
    emptyLabel: "Sin órdenes.",
    singular: "orden",
    plural: "órdenes",
  },
] as const

describe("masters catalog staging smoke", () => {
  it.each(MASTERS_LIST_ROUTES)("breadcrumb resuelve $path", ({ path, label }) => {
    const crumbs = buildAxonesBreadcrumbTrail(path)
    expect(crumbs[0]?.label).toBe("Axones")
    expect(crumbs.some((c) => c.label === "Datos maestros")).toBe(true)
    expect(crumbs.at(-1)?.label).toBe(label)
  })

  it.each(MASTERS_LIST_ROUTES)("count label singular/plural $path", ({ singular, plural }) => {
    expect(catalogCountLabel(0, singular, plural)).toBe(`0 ${plural}`)
    expect(catalogCountLabel(1, singular, plural)).toBe(`1 ${singular}`)
    expect(catalogCountLabel(3, singular, plural)).toBe(`3 ${plural}`)
  })

  it.each(MASTERS_LIST_ROUTES)(
    "empty vs filtered messages for $path",
    ({ emptyLabel }) => {
      expect(
        catalogTableEmptyMessage({ emptyLabel, hasActiveFilters: false }),
      ).toBe(emptyLabel)
      expect(
        catalogTableEmptyMessage({ emptyLabel, hasActiveFilters: true }),
      ).toBe("Sin resultados con los filtros actuales.")
    },
  )

  it("paginación oculta resumen cuando total es cero", () => {
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

  it("paginación muestra resumen cuando hay datos", () => {
    expect(
      catalogPaginationSummaryMessage({
        total: 1,
        from: 1,
        to: 1,
        currentPage: 1,
        lastPage: 1,
      }),
    ).toBe("Mostrando 1 a 1 de 1 registros")
  })
})
