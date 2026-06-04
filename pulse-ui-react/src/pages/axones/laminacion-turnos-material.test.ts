import { describe, expect, it } from "vitest"
import {
  computeLamMaterialConsumo,
  pickLamTurnoMaterialField,
} from "./laminacion-turnos"

describe("computeLamMaterialConsumo", () => {
  it("resta sobro de entrada con mínimo 0", () => {
    expect(computeLamMaterialConsumo("31", "12")).toBe(19)
    expect(computeLamMaterialConsumo("12", "31")).toBe(0)
    expect(computeLamMaterialConsumo("12,5", "2,5")).toBe(10)
  })
})

describe("pickLamTurnoMaterialField", () => {
  it("prioriza turno activo sobre espejo plano", () => {
    expect(pickLamTurnoMaterialField("12", "")).toBe("12")
    expect(pickLamTurnoMaterialField("", "99")).toBe("99")
  })
})
