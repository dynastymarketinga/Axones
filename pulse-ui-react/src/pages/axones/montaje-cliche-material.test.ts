import { describe, expect, it } from "vitest"

import {
  montajeMaterialesForSave,
  parseMontajeMateriales,
} from "./montaje-cliche-material"

describe("montaje-cliche-material", () => {
  it("parseMontajeMateriales normaliza filas", () => {
    const rows = parseMontajeMateriales([
      { tipo: "cinta", descripcion: "3M", cantidad: "2", unidad: "Metro" },
      { tipo: "invalid", descripcion: "", cantidad: "", unidad: "" },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]?.tipo).toBe("cinta")
    expect(rows[1]?.tipo).toBe("otro")
  })

  it("montajeMaterialesForSave filtra filas vacías", () => {
    const kept = montajeMaterialesForSave([
      { tipo: "pegamento", descripcion: "", cantidad: "", unidad: "Unidad" },
      { tipo: "solvente", descripcion: "IPA", cantidad: "0.5", unidad: "Lt" },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0]?.descripcion).toBe("IPA")
  })
})
