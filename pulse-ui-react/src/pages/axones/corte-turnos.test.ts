import { describe, expect, it } from "vitest"

import {
  syncCorteEntradaFields,
  syncCorteFormMetrics,
  sumEntradaKgFromForm,
} from "./corte-turnos"

describe("corte entrada sync", () => {
  it("syncCorteEntradaFields sets kgIngresadosCorte from grid sum", () => {
    const form = {
      corEntradaBobinasKg: ["12", "32", "12", ...Array(27).fill("")],
    }
    const synced = syncCorteEntradaFields(form)
    expect(synced.kgIngresadosCorte).toBe("56.00")
    expect(sumEntradaKgFromForm(form)).toBe(56)
  })

  it("syncCorteFormMetrics updates entrada and salida", () => {
    const form = {
      corEntradaBobinasKg: ["10", "", ""],
      cor_paletas: [
        {
          id: "p-01",
          label: "Paleta #01",
          rollosKg: ["5", ...Array(47).fill("")],
          status: "en_progreso",
        },
      ],
    }
    const synced = syncCorteFormMetrics(form)
    expect(synced.kgIngresadosCorte).toBe("10.00")
    expect(synced.kgSalidaCorte).toBe("5.00")
    expect(synced.corAcumuladoProducidoKg).toBe(5)
  })
})
