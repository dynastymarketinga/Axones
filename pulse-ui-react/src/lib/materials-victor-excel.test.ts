import { describe, expect, it } from "vitest"

import {
  dedupeVictorRows,
  mapMiscUnit,
  skuForSustrato,
  skuForTinta,
  slugSkuPart,
} from "@/lib/materials-victor-excel"

describe("materials-victor-excel helpers", () => {
  it("generates stable sustrato SKU", () => {
    expect(skuForSustrato("BOPP NORMAL", 20, 600)).toBe("SUB-BOPP-NORMAL-20-600")
  })

  it("slugSkuPart strips accents", () => {
    expect(slugSkuPart("QUÍMICO")).toBe("QUIMICO")
  })

  it("generates tinta SKU from código", () => {
    expect(skuForTinta("BL-2036 ")).toBe("TNT-BL-2036")
  })

  it("maps misc units", () => {
    expect(mapMiscUnit("kilos")).toBe("kg")
    expect(mapMiscUnit("unidad")).toBe("unidad")
    expect(mapMiscUnit("mts")).toBe("m")
  })

  it("dedupes rows by SKU keeping last", () => {
    const { rows, duplicates } = dedupeVictorRows([
      {
        sheet_name: "Hoja3",
        row_number: 2,
        inventory_area: "material",
        sku: "SUB-A-20-100",
        name: "A",
        unit: "kg",
        micras: 20,
        ancho: 100,
        tinta_subarea: null,
        quantity: 1,
      },
      {
        sheet_name: "Hoja3",
        row_number: 3,
        inventory_area: "material",
        sku: "SUB-A-20-100",
        name: "A",
        unit: "kg",
        micras: 20,
        ancho: 100,
        tinta_subarea: null,
        quantity: 9,
      },
    ])
    expect(duplicates).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.quantity).toBe(9)
  })
})
