import { describe, expect, it } from "vitest"

import {
  bandejaPendientesAreaColumnCount,
  readBandejaPendientesAreaValues,
} from "@/lib/area-bandeja-pendientes-columns"
import type { WorkOrderListRow } from "@/types/api"

describe("readBandejaPendientesAreaValues", () => {
  it("montaje reads planilla fields", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      technical_document: {
        form: {
          frecuencia: "250±2",
          numBandas: "4",
          anchoMontaje: "1040±2",
          numColores: "6",
          tipoImpresionMontaje: "Reverso",
        },
      },
    } as unknown as WorkOrderListRow
    expect(readBandejaPendientesAreaValues(row, "montaje")).toEqual([
      "250±2",
      "4",
      "1040±2",
      "6",
      "Reverso",
    ])
  })

  it("printing reads first sustrato", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      technical_document: {
        form: {
          sustratosVirgenImp: [{ material_free_text: "BOPP 20µ", kg: "420.50" }],
        },
      },
    } as unknown as WorkOrderListRow
    expect(readBandejaPendientesAreaValues(row, "printing")).toEqual(["BOPP 20µ", "420.50"])
  })

  it("column counts per area", () => {
    expect(bandejaPendientesAreaColumnCount("montaje")).toBe(5)
    expect(bandejaPendientesAreaColumnCount("printing")).toBe(2)
    expect(bandejaPendientesAreaColumnCount("laminacion")).toBe(6)
    expect(bandejaPendientesAreaColumnCount("corte")).toBe(5)
    expect(bandejaPendientesAreaColumnCount("tintas")).toBe(3)
  })
})
