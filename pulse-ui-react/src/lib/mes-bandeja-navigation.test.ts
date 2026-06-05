import { describe, expect, it } from "vitest"

import {
  mesBandejaPath,
  parseMesBandejaSubTabParam,
} from "@/lib/mes-bandeja-navigation"

describe("mes-bandeja-navigation", () => {
  it("parseMesBandejaSubTabParam accepts known sub-tabs", () => {
    expect(parseMesBandejaSubTabParam("produccion")).toBe("produccion")
    expect(parseMesBandejaSubTabParam("FINALIZADAS")).toBe("finalizadas")
    expect(parseMesBandejaSubTabParam(" pendientes ")).toBe("pendientes")
    expect(parseMesBandejaSubTabParam("otro")).toBeNull()
  })

  it("mesBandejaPath maps areas to routes with bandeja query", () => {
    expect(mesBandejaPath("montaje")).toBe("/montaje")
    expect(mesBandejaPath("printing", "produccion")).toBe("/impresion?bandeja=produccion")
    expect(mesBandejaPath("laminacion", "finalizadas")).toBe("/laminacion?bandeja=finalizadas")
    expect(mesBandejaPath("corte", "produccion")).toBe("/corte?bandeja=produccion")
    expect(mesBandejaPath("tintas", "finalizadas")).toBe("/tintas?bandeja=finalizadas")
  })
})
