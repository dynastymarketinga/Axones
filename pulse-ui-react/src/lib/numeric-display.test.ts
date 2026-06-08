// @vitest-environment node
import { describe, expect, it } from "vitest"

import { formatPlainNumberDisplay, formatQuantityDisplay, formatQuantityDisplayEs } from "@/lib/numeric-display"

describe("formatPlainNumberDisplay", () => {
  it("elimina decimales innecesarios en micras/ancho", () => {
    expect(formatPlainNumberDisplay("20.000")).toBe("20")
    expect(formatPlainNumberDisplay("10.000")).toBe("10")
    expect(formatPlainNumberDisplay("1000.000")).toBe("1000")
    expect(formatPlainNumberDisplay(12)).toBe("12")
  })

  it("conserva decimales significativos", () => {
    expect(formatPlainNumberDisplay("20.500")).toBe("20.5")
    expect(formatPlainNumberDisplay("20.125")).toBe("20.125")
  })

  it("maneja vacío e inválido", () => {
    expect(formatPlainNumberDisplay("")).toBe("")
    expect(formatPlainNumberDisplay(null)).toBe("")
    expect(formatPlainNumberDisplay("abc")).toBe("abc")
  })
})

describe("formatQuantityDisplay", () => {
  it("formatea stock y cantidades sin ceros de relleno", () => {
    expect(formatQuantityDisplay("1.000")).toBe("1")
    expect(formatQuantityDisplay("132.500")).toBe("132.5")
    expect(formatQuantityDisplay(0)).toBe("0")
    expect(formatQuantityDisplay("100.000")).toBe("100")
  })
})

describe("formatQuantityDisplayEs", () => {
  it("usa coma decimal y quita ceros innecesarios", () => {
    expect(formatQuantityDisplayEs("100.000")).toBe("100")
    expect(formatQuantityDisplayEs("0.000")).toBe("0")
    expect(formatQuantityDisplayEs("53.43")).toBe("53,43")
    expect(formatQuantityDisplayEs("43.23")).toBe("43,23")
    expect(formatQuantityDisplayEs("10")).toBe("10")
  })
})
