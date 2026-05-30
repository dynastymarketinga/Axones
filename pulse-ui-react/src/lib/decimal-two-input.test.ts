// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  formatDecimalDisplay,
  formatDecimalOnBlur,
  formatDecimalTwoDisplay,
  formatDecimalTwoOnBlur,
  lamMaterialMetrosDisplay,
  normalizeLamMaterialMetrosOnBlur,
  parseDecimalInput,
  parseDecimalTwoInput,
  randomDecimalTwoComma,
  randomDecimalTwoDot,
  sanitizeDecimalInput,
  sanitizeDecimalTwoInput,
} from "@/lib/decimal-two-input"

describe("sanitizeDecimalTwoInput", () => {
  it("acepta enteros y limita decimales a 2", () => {
    expect(sanitizeDecimalTwoInput("324")).toBe("324")
    expect(sanitizeDecimalTwoInput("44354.543434345")).toBe("44354,54")
    expect(sanitizeDecimalTwoInput("44354,543434345")).toBe("44354,54")
  })

  it("normaliza punto a coma y conserva separador parcial", () => {
    expect(sanitizeDecimalTwoInput("324,")).toBe("324,")
    expect(sanitizeDecimalTwoInput("324.")).toBe("324,")
    expect(sanitizeDecimalTwoInput("324,5")).toBe("324,5")
  })

  it("ignora caracteres no numéricos", () => {
    expect(sanitizeDecimalTwoInput(" 1a2b3,4x5 ")).toBe("123,45")
  })
})

describe("formatDecimalTwoDisplay", () => {
  it("fija 2 decimales con coma", () => {
    expect(formatDecimalTwoDisplay("324")).toBe("324,00")
    expect(formatDecimalTwoDisplay("44354.543434345")).toBe("44354,54")
    expect(formatDecimalTwoDisplay("345435443")).toBe("345435443,00")
  })
})

describe("formatDecimalTwoOnBlur", () => {
  it("formatea al salir del campo", () => {
    expect(formatDecimalTwoOnBlur("435435")).toBe("435435,00")
    expect(formatDecimalTwoOnBlur("14.2")).toBe("14,20")
    expect(formatDecimalTwoOnBlur("")).toBe("")
  })
})

describe("parseDecimalTwoInput", () => {
  it("parsea valores con coma o punto", () => {
    expect(parseDecimalTwoInput("324,00")).toBe(324)
    expect(parseDecimalTwoInput("324.5")).toBe(324.5)
  })
})

describe("sanitizeDecimalInput", () => {
  it("no limita decimales", () => {
    expect(sanitizeDecimalInput("545435345,45354354")).toBe("545435345,45354354")
    expect(sanitizeDecimalInput("44354.543434345")).toBe("44354,543434345")
  })

  it("conserva separador parcial", () => {
    expect(sanitizeDecimalInput("324,")).toBe("324,")
  })
})

describe("formatDecimalDisplay", () => {
  it("no fuerza 2 decimales", () => {
    expect(formatDecimalDisplay("34535435,88")).toBe("34535435,88")
    expect(formatDecimalDisplay("8200")).toBe("8200")
    expect(formatDecimalDisplay("545435345.45354354")).toBe("545435345,45354354")
  })
})

describe("formatDecimalOnBlur", () => {
  it("normaliza sin recortar fracción", () => {
    expect(formatDecimalOnBlur("545435345,45354354")).toBe("545435345,45354354")
    expect(formatDecimalOnBlur("8200,")).toBe("8200")
    expect(formatDecimalOnBlur("")).toBe("")
  })
})

describe("parseDecimalInput", () => {
  it("parsea fracción larga", () => {
    expect(parseDecimalInput("545435345,45354354")).toBe(545435345.45354354)
  })
})

describe("lamMaterialMetrosDisplay", () => {
  it("muestra N/A cuando está vacío y no tiene foco", () => {
    expect(lamMaterialMetrosDisplay("", "metrosAdhesivoLaminacion", null)).toBe("N/A")
    expect(lamMaterialMetrosDisplay(undefined, "metrosAdhesivoLaminacion", null)).toBe("N/A")
  })

  it("conserva valor al editar con foco", () => {
    expect(lamMaterialMetrosDisplay("", "metrosAdhesivoLaminacion", "metrosAdhesivoLaminacion")).toBe("")
    expect(lamMaterialMetrosDisplay("1200", "metrosAdhesivoLaminacion", "metrosAdhesivoLaminacion")).toBe("1200")
  })
})

describe("randomDecimalTwoComma", () => {
  it("devuelve coma y 2 decimales dentro del rango", () => {
    const v = randomDecimalTwoComma(10, 20)
    expect(v).toMatch(/^\d+,\d{2}$/)
    const n = Number(v.replace(",", "."))
    expect(n).toBeGreaterThanOrEqual(10)
    expect(n).toBeLessThanOrEqual(20)
  })
})

describe("randomDecimalTwoDot", () => {
  it("devuelve punto y 2 decimales dentro del rango", () => {
    const v = randomDecimalTwoDot(10, 20)
    expect(v).toMatch(/^\d+\.\d{2}$/)
    const n = Number(v)
    expect(n).toBeGreaterThanOrEqual(10)
    expect(n).toBeLessThanOrEqual(20)
  })
})

describe("normalizeLamMaterialMetrosOnBlur", () => {
  it("vacío o n/a vuelve a N/A", () => {
    expect(normalizeLamMaterialMetrosOnBlur("")).toBe("N/A")
    expect(normalizeLamMaterialMetrosOnBlur("  n/a  ")).toBe("N/A")
  })

  it("conserva metros numéricos", () => {
    expect(normalizeLamMaterialMetrosOnBlur("8200,00")).toBe("8200,00")
  })
})
