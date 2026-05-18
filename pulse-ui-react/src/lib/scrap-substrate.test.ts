import { describe, expect, it } from "vitest"

import {
  isPolietilenoScrapSubstrate,
  normalizeScrapSubstrate,
  SCRAP_POLIETILENO,
  SCRAP_POLIETILENO_LEGACY,
} from "./scrap-substrate"

describe("scrap-substrate", () => {
  it("normalizes legacy politerlero to polietileno", () => {
    expect(normalizeScrapSubstrate(SCRAP_POLIETILENO_LEGACY)).toBe(SCRAP_POLIETILENO)
    expect(normalizeScrapSubstrate("  POLITERLERO  ")).toBe(SCRAP_POLIETILENO)
  })

  it("detects polietileno and legacy alias", () => {
    expect(isPolietilenoScrapSubstrate(SCRAP_POLIETILENO)).toBe(true)
    expect(isPolietilenoScrapSubstrate(SCRAP_POLIETILENO_LEGACY)).toBe(true)
    expect(isPolietilenoScrapSubstrate("bopp")).toBe(false)
  })
})
