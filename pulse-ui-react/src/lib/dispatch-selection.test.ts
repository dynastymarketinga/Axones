import { describe, expect, it } from "vitest"

import {
  mergeDispatchSelection,
  sumDispatchSelectionKg,
  type DispatchSelectionItem,
} from "./dispatch-selection"

const base = (id: number, kg: string): DispatchSelectionItem => ({
  corte_bobina_usage_id: id,
  work_order_id: 1,
  work_order_code: "OT-1",
  product_id: 1,
  description: "Paleta",
  quantity_kg: kg,
  pallet_code: `Paleta #${id}`,
  bobbin_count: 1,
})

describe("mergeDispatchSelection", () => {
  it("acumula paletas distintas por usage id", () => {
    const merged = mergeDispatchSelection([base(1, "10")], [base(2, "20")])
    expect(merged).toHaveLength(2)
    expect(sumDispatchSelectionKg(merged)).toBe(30)
  })

  it("reemplaza la misma paleta al volver a seleccionar", () => {
    const merged = mergeDispatchSelection([base(1, "10")], [base(1, "15")])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.quantity_kg).toBe("15")
  })
})
