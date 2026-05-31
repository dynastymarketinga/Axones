// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  formatMaterialIdentity,
  formatOcLineReference,
  formatPurchaseOrderBanner,
  parseOcLineMeta,
} from "@/lib/purchase-receipt-material-label"

describe("formatMaterialIdentity", () => {
  it("muestra código, descripción y proveedor", () => {
    expect(
      formatMaterialIdentity({
        sku: "BIOPET-400X-4005",
        name: "BOPP transparente",
        supplierName: "Víctor",
      }),
    ).toBe("BIOPET-400X-4005 · BOPP transparente · Víctor")
  })

  it("omite descripción duplicada del código", () => {
    expect(
      formatMaterialIdentity({
        sku: "BOPP",
        name: "BOPP",
        supplierName: "Victor",
      }),
    ).toBe("BOPP · Victor")
  })

  it("indica sin proveedor cuando falta", () => {
    expect(
      formatMaterialIdentity({
        sku: "MAT-01",
        name: "Film",
        supplierName: null,
      }),
    ).toBe("MAT-01 · Film · Sin proveedor")
  })
})

describe("formatOcLineReference", () => {
  it("usa material del catálogo con proveedor de línea", () => {
    expect(
      formatOcLineReference(
        {
          description: "BOPP | Tipo: sustrato",
          material: {
            sku: "BIOPET-400X-4005",
            name: "BOPP transparente",
            supplier: { name: "Víctor" },
          },
        },
        "Proveedor OC",
      ),
    ).toBe("BIOPET-400X-4005 · BOPP transparente · Víctor")
  })

  it("usa descripción parseada y proveedor de cabecera OC", () => {
    expect(
      formatOcLineReference(
        { description: "BOPP transparente | Tipo: sustrato" },
        "Millennium",
      ),
    ).toBe("BOPP transparente · Millennium")
  })
})

describe("formatPurchaseOrderBanner", () => {
  it("concatena código, proveedor y estado", () => {
    expect(
      formatPurchaseOrderBanner({
        code: "OC-2026-011",
        supplierName: "Víctor",
        statusLabel: "Abierta",
      }),
    ).toBe("OC-2026-011 · Víctor · Abierta")
  })
})

describe("parseOcLineMeta", () => {
  it("extrae tipo y dimensiones", () => {
    expect(parseOcLineMeta("BOPP | Tipo: sustrato | Micras: 20 | Ancho: 520mm")).toEqual({
      itemType: "Sustrato",
      micras: "20",
      ancho_mm: "520",
      baseText: "BOPP",
    })
  })
})
