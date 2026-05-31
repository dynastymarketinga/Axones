// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  formatMaterialCatalogLabel,
  formatMaterialDimensionHint,
  formatMaterialIdentity,
  formatOcLineReceiptProgress,
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

describe("formatMaterialCatalogLabel", () => {
  it("añade micras y ancho solo para sustrato", () => {
    expect(
      formatMaterialCatalogLabel({
        sku: "857757",
        name: "bopp 23",
        supplierName: "valeria prueba",
        micras: "20",
        ancho: "1000",
        itemTypeKey: "sustrato",
      }),
    ).toBe("857757 · bopp 23 · valeria prueba · 20 µm · 1000 mm")
  })

  it("no añade dimensiones para tinta", () => {
    expect(
      formatMaterialCatalogLabel({
        sku: "TINTA-01",
        name: "Cyan",
        supplierName: "Proveedor",
        micras: "20",
        ancho: "1000",
        itemTypeKey: "tinta",
      }),
    ).toBe("TINTA-01 · Cyan · Proveedor")
  })
})

describe("formatMaterialDimensionHint", () => {
  it("retorna null para químico", () => {
    expect(
      formatMaterialDimensionHint({
        sku: "Q",
        micras: "20",
        ancho: "100",
        itemTypeKey: "quimico",
      }),
    ).toBeNull()
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

  it("incluye dimensiones de descripción para sustrato", () => {
    expect(
      formatOcLineReference(
        {
          description: "BOPP | Tipo: sustrato | Micras: 20 | Ancho: 520mm",
        },
        "Millennium",
      ),
    ).toBe("BOPP · Millennium · 20 µm · 520 mm")
  })
})

describe("formatOcLineReceiptProgress", () => {
  it("muestra pedido recibido y pendiente", () => {
    expect(
      formatOcLineReceiptProgress({
        quantity_ordered: "500",
        quantity_received: "400",
        unit: "kg",
      }),
    ).toBe("Pedido 500,000 · Recibido 400,000 · Pendiente 100,000 kg")
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
