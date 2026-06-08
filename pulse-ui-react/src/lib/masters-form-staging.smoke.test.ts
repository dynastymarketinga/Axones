import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { buildAxonesBreadcrumbTrail } from "@/lib/axones-breadcrumb-trail"
import {
  catalogMasterFormActionsClass,
  catalogMasterFormInputClass,
  catalogMasterFormPanelClass,
  catalogMasterFormPanelWideClass,
  catalogMasterFormPlainInputClass,
  catalogMasterFormSectionClass,
} from "@/components/axones/catalog-list-classes"

/** Smoke checks for the 5 Datos maestros form routes before deploy. */
const MASTERS_FORM_ROUTES = [
  {
    path: "/vendedores/form",
    listPath: "/vendedores",
    listLabel: "Vendedores",
    pageFile: "VendorFormPage.tsx",
    sectionTitle: "Datos del vendedor",
    submitLabel: "Crear vendedor",
    wide: false,
  },
  {
    path: "/clientes/form",
    listPath: "/clientes",
    listLabel: "Clientes",
    pageFile: "ClientFormPage.tsx",
    sectionTitle: "Datos del cliente",
    submitLabel: "Crear cliente",
    wide: false,
  },
  {
    path: "/productos/form",
    listPath: "/productos",
    listLabel: "Especificaciones de producto",
    pageFile: "ProductFormPage.tsx",
    sectionTitle: "Datos de la especificación",
    submitLabel: "Crear especificación",
    wide: false,
    extraChecks: ["CircleHelp", "CatalogMasterFormBackButton"],
  },
  {
    path: "/proveedores/form",
    listPath: "/proveedores",
    listLabel: "Proveedores",
    pageFile: "SupplierFormPage.tsx",
    sectionTitle: "Datos del proveedor",
    submitLabel: "Crear proveedor",
    wide: false,
  },
  {
    path: "/ordenes-compra/nueva",
    listPath: "/ordenes-compra",
    listLabel: "Órdenes de compra",
    pageFile: "PurchaseOrderNewPage.tsx",
    sectionTitle: null,
    submitLabel: "Crear orden",
    wide: true,
    extraChecks: ["¿Qué registra esta pantalla?", "headerExtras"],
  },
] as const

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "pages", "axones")

function readPageSource(filename: string): string {
  return readFileSync(join(pagesDir, filename), "utf8")
}

describe("masters form staging smoke", () => {
  it("clases compartidas: carta estándar max-w-5xl", () => {
    expect(catalogMasterFormPanelClass).toContain("max-w-5xl")
    expect(catalogMasterFormPanelClass).toContain("rounded-2xl")
    expect(catalogMasterFormPanelClass).toContain("border-primary/15")
  })

  it("clases compartidas: panel ancho sin max-w restrictivo", () => {
    expect(catalogMasterFormPanelWideClass).toContain("rounded-2xl")
    expect(catalogMasterFormPanelWideClass).not.toContain("max-w-3xl")
    expect(catalogMasterFormPanelWideClass).not.toContain("max-w-5xl")
  })

  it("clases compartidas: acciones centradas", () => {
    expect(catalogMasterFormActionsClass).toContain("justify-center")
    expect(catalogMasterFormActionsClass).toContain("border-t")
  })

  it("clases compartidas: inputs h-11", () => {
    expect(catalogMasterFormPlainInputClass).toContain("h-11")
    expect(catalogMasterFormInputClass).toContain("h-11")
  })

  it("sección interna de formulario definida", () => {
    expect(catalogMasterFormSectionClass).toContain("border-b")
  })

  it.each(MASTERS_FORM_ROUTES)("breadcrumb resuelve $path → Nuevo", ({ path, listLabel }) => {
    const crumbs = buildAxonesBreadcrumbTrail(path)
    expect(crumbs[0]?.label).toBe("Axones")
    expect(crumbs.some((c) => c.label === "Datos maestros")).toBe(true)
    expect(crumbs.some((c) => c.label === listLabel)).toBe(true)
    expect(crumbs.at(-1)?.label).toBe("Nuevo")
  })

  it.each(MASTERS_FORM_ROUTES)(
    "página $pageFile usa shell elevado y patrón compartido",
    ({ pageFile, sectionTitle, submitLabel, wide, extraChecks }) => {
      const src = readPageSource(pageFile)
      expect(src).toContain('headerVariant="elevated"')
      expect(src).toContain("CatalogPageShell")
      expect(src).toContain("CatalogMasterFormBackButton")
      expect(src).toContain("catalogMasterFormActionsClass")
      expect(src).toContain("Cancelar")

      if (wide) {
        expect(src).toContain("catalogMasterFormPanelWideClass")
      } else {
        expect(src).toContain("catalogMasterFormPanelClass")
      }

      if (sectionTitle) {
        expect(src).toContain(sectionTitle)
        expect(src).toContain("catalogMasterFormSectionClass")
      }

      expect(src).toContain(submitLabel)

      for (const token of extraChecks ?? []) {
        expect(src).toContain(token)
      }
    },
  )

  it("ClientFormPage usa inputs maestros h-11", () => {
    const src = readPageSource("ClientFormPage.tsx")
    expect(src).toContain("catalogMasterFormInputClass")
  })

  it("CatalogMasterFormBackButton es solo icono (size icon)", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "components", "axones", "CatalogMasterFormBackButton.tsx"),
      "utf8",
    )
    expect(src).toContain('size="icon"')
    expect(src).toContain("ArrowLeft")
    expect(src).not.toContain("Volver al listado</span>")
  })
})
