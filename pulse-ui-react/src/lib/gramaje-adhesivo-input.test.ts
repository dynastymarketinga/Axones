// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  isGramajeAdhesivoRangeLike,
  sanitizeGramajeAdhesivoInput,
} from "@/lib/gramaje-adhesivo-input"

describe("sanitizeGramajeAdhesivoInput", () => {
  it("normaliza 'a' como separador", () => {
    expect(sanitizeGramajeAdhesivoInput("1,5 a 2,2")).toBe("1,5 A 2,2")
    expect(sanitizeGramajeAdhesivoInput("1,5A2,2")).toBe("1,5 A 2,2")
  })

  it("inserta A automáticamente tras el primer decimal", () => {
    expect(sanitizeGramajeAdhesivoInput("1,5")).toBe("1,5")
    expect(sanitizeGramajeAdhesivoInput("1,52")).toBe("1,5 A 2")
    expect(sanitizeGramajeAdhesivoInput("1522")).toBe("1,5 A 2,2")
  })

  it("mantiene dos decimales en el primer valor", () => {
    expect(sanitizeGramajeAdhesivoInput("22,44")).toBe("22,44")
    expect(sanitizeGramajeAdhesivoInput("22,441")).toBe("22,44 A 1")
    expect(sanitizeGramajeAdhesivoInput("22,441122")).toBe("22,44 A 11,22")
  })

  it("permite segundo valor con coma", () => {
    expect(sanitizeGramajeAdhesivoInput("1,5 A 2,2")).toBe("1,5 A 2,2")
    expect(sanitizeGramajeAdhesivoInput("22,44 A 11,22")).toBe("22,44 A 11,22")
  })
})

describe("isGramajeAdhesivoRangeLike", () => {
  it("acepta rangos válidos", () => {
    expect(isGramajeAdhesivoRangeLike("1,5 A 2,2")).toBe(true)
    expect(isGramajeAdhesivoRangeLike("22,44 A 11,22")).toBe(true)
    expect(isGramajeAdhesivoRangeLike("1.5 A 2.2")).toBe(true)
  })

  it("rechaza valores sueltos", () => {
    expect(isGramajeAdhesivoRangeLike("1,25")).toBe(false)
    expect(isGramajeAdhesivoRangeLike("A1")).toBe(false)
    expect(isGramajeAdhesivoRangeLike("")).toBe(false)
  })
})
