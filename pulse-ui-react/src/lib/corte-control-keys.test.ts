import { describe, expect, it } from "vitest"

import { filterCorteControlForm, isCorteControlKey } from "./corte-control-keys"

describe("corte-control-keys", () => {
  it("accepts cor prefix and Corte metric keys", () => {
    expect(isCorteControlKey("corTurnoActual")).toBe(true)
    expect(isCorteControlKey("cor_paletas")).toBe(true)
    expect(isCorteControlKey("kgSalidaCorte")).toBe(true)
    expect(isCorteControlKey("pedidoKg")).toBe(false)
  })

  it("filters form to corte keys only", () => {
    const filtered = filterCorteControlForm({
      pedidoKg: "100",
      corOperador: "Ana",
      kgMermaCorte: "5",
    })
    expect(filtered).toEqual({ corOperador: "Ana", kgMermaCorte: "5" })
  })
})
