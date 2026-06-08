import { describe, expect, it } from "vitest"

import {
  TINTAS_CONSUMPTION_NOTES_MARKER,
  TINTAS_MIXTURE_NOTES_MARKER,
  tintasMaterialRequestOriginLabel,
} from "@/lib/tintas-warehouse-labels"

describe("tintasMaterialRequestOriginLabel", () => {
  it("consumo tintas", () => {
    expect(
      tintasMaterialRequestOriginLabel(`${TINTAS_CONSUMPTION_NOTES_MARKER} · OT X`, "tintas"),
    ).toBe("Consumo tintas (OT)")
  })

  it("mezcla tintas", () => {
    expect(tintasMaterialRequestOriginLabel(`${TINTAS_MIXTURE_NOTES_MARKER} · mezcla`, "tintas")).toBe(
      "Mezcla tintas",
    )
  })

  it("null si no es tintas", () => {
    expect(tintasMaterialRequestOriginLabel("Otra cosa", "impresion")).toBeNull()
  })
})
