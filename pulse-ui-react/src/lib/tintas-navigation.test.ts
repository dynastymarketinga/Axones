import { describe, expect, it } from "vitest"

import { tintasWorkOrderProduccionUrl } from "@/lib/tintas-navigation"

describe("tintasWorkOrderProduccionUrl", () => {
  it("sigue el patrón MES de otras áreas", () => {
    expect(tintasWorkOrderProduccionUrl(42)).toBe("/ordenes-trabajo/42/produccion?tab=tintas")
  })
})
