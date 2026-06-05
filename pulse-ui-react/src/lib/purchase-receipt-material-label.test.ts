// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  formatMaterialCatalogLabel,
  formatMaterialDimensionDisplay,
  formatMaterialDimensionHint,
  formatMaterialIdentity,
  formatOcLineReceiptProgress,
  formatOcLineReference,
  formatPurchaseOrderBanner,
  formatPurchaseOrderOptionSecondary,
  formatPurchaseOrderSelectorLabels,
  parseOcLineMeta,
  parseReceiptProgressLabel,
  purchaseOrderHasPendingReceiptQuantity,
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

  it("normaliza micras/ancho con ceros decimales del API", () => {
    expect(
      formatMaterialCatalogLabel({
        sku: "MAT-MASFPAAS",
        name: "AAAA",
        supplierName: "Victor",
        micras: "10.000",
        ancho: "12.000",
        itemTypeKey: "sustrato",
      }),
    ).toBe("MAT-MASFPAAS · AAAA · Victor · 10 µm · 12 mm")
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
    ).toBe("Ref. pedido 500 · ya recibido 400 · pendiente OC 100 kg")
  })
})

describe("formatPurchaseOrderSelectorLabels", () => {
  it("muestra código proveedor estado y avance", () => {
    const result = formatPurchaseOrderSelectorLabels({
      code: "OC-2026-331",
      supplierName: "valeria prueba",
      statusLabel: "Abierta",
      linesCount: 3,
      receiptProgressLabel: "0,000 / 500,000 kg",
      receiptsCount: 0,
    })
    expect(result.primary).toBe("OC-2026-331 · valeria prueba · Abierta")
    expect(result.secondary).toBe("0,000 / 500,000 kg · 3 artículos")
  })

  it("incluye recepciones previas en secundaria", () => {
    const result = formatPurchaseOrderSelectorLabels({
      code: "OC-2026-328",
      supplierName: "Proveedor",
      statusLabel: "Parcial",
      linesCount: 1,
      receiptProgressLabel: "400,000 / 500,000 kg",
      receiptsCount: 2,
    })
    expect(result.secondary).toBe("400,000 / 500,000 kg · 1 artículo · 2 recepciones")
  })
})

describe("formatPurchaseOrderOptionSecondary", () => {
  it("lista estado avance y artículos", () => {
    expect(
      formatPurchaseOrderOptionSecondary({
        statusLabel: "Abierta",
        receiptProgressLabel: "0,000 / 500,000 kg",
        linesCount: 2,
      }),
    ).toBe("Abierta · 0,000 / 500,000 kg · 2 artículos")
  })
})

describe("parseReceiptProgressLabel", () => {
  it("parsea avance recibido vs pedido", () => {
    expect(parseReceiptProgressLabel("100,000 / 100,000 kg")).toEqual({
      received: 100,
      ordered: 100,
    })
    expect(parseReceiptProgressLabel("0,000 / 1.500,000 kg")).toEqual({
      received: 0,
      ordered: 1500,
    })
  })
})

describe("purchaseOrderHasPendingReceiptQuantity", () => {
  it("detecta OC sin pendiente", () => {
    expect(
      purchaseOrderHasPendingReceiptQuantity({ receipt_progress_label: "100,000 / 100,000 kg" }),
    ).toBe(false)
    expect(
      purchaseOrderHasPendingReceiptQuantity({ receipt_progress_label: "50,000 / 100,000 kg" }),
    ).toBe(true)
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
