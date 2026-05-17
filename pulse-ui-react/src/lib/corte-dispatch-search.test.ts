import { describe, expect, it } from "vitest"

import {
  corteDispatchRowMatchesSearch,
  corteDispatchRowSearchHaystack,
  type CorteDispatchSearchRow,
} from "./corte-dispatch-search"

const baseRow: CorteDispatchSearchRow = {
  corte_bobina_usage_id: 10,
  work_order_id: 1,
  work_order_code: "OT-2026-00001",
  client_name: "AAA",
  product_name: "aaa",
  product_cpe: "CPE",
  material_sku: "SKU-001",
  quantity_finished_kg: "132.000",
  quantity_dispatched_kg: "0.000",
  quantity_remaining_kg: "132.000",
  pallet_label: "Paleta #01",
  paleta_id: "p-01",
  rollos_count: 13,
  rollos_kg: ["12", "12", "21", ...Array(45).fill("0")],
  is_provisional: true,
}

describe("corteDispatchRowMatchesSearch", () => {
  it("query vacío incluye todas las filas", () => {
    expect(corteDispatchRowMatchesSearch(baseRow, "")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "   ")).toBe(true)
  })

  it("coincide por OT, cliente y producto", () => {
    expect(corteDispatchRowMatchesSearch(baseRow, "OT-2026")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "aaa")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "CPE")).toBe(true)
  })

  it("coincide por paleta y provisional", () => {
    expect(corteDispatchRowMatchesSearch(baseRow, "Paleta #01")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "p-01")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "provisional")).toBe(true)
  })

  it("coincide por kg y rollos", () => {
    expect(corteDispatchRowMatchesSearch(baseRow, "132")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "12")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "21")).toBe(true)
    expect(corteDispatchRowMatchesSearch(baseRow, "13")).toBe(true)
  })

  it("no coincide si el término no está en la fila", () => {
    expect(corteDispatchRowMatchesSearch(baseRow, "ZZZ-999")).toBe(false)
  })

  it("haystack incluye work_order_id numérico", () => {
    const hay = corteDispatchRowSearchHaystack(baseRow)
    expect(hay).toContain("ot-2026-00001")
    expect(hay).toContain("1")
  })
})
