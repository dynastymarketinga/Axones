import { describe, expect, it } from "vitest"

import {
  accumulatePrintingFromJson,
  clearPrintingTurnoOperativo,
  flushPrintingTurnoOperativoToCapturas,
  IMP_BOBINAS_SLOTS,
  turnoProduccionTotals,
  type PrintingTurnoEntry,
} from "./printing-turnos"

function turnoBase(): PrintingTurnoEntry {
  return {
    id: "t-1",
    started_at: new Date().toISOString(),
    closed_at: null,
    closed_by: null,
    turno: "diurno",
    grupo: "A",
    operador: "Op",
    ayudante: "",
    supervisor: "",
    entradaBobinasKg: Array(IMP_BOBINAS_SLOTS).fill(""),
    entradaBobinasMeta: [],
    salidaBobinasKg: Array(IMP_BOBINAS_SLOTS).fill(""),
    salidaBobinasMeta: [],
    devolucionBuenaKg: "",
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: "",
    devolucionRechazadaMotivo: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    observaciones: "",
    timer: { state: "pending", effectiveAccSec: 0, deadAccSec: 0, lastResumeAtMs: 0, pauseAtMs: 0, pauses: [] },
    capturas: [],
  }
}

describe("printing capturas", () => {
  it("flush guarda captura y limpia rejillas", () => {
    const t = turnoBase()
    t.entradaBobinasKg[0] = "100"
    t.entradaBobinasKg[1] = "200"
    t.salidaBobinasKg[0] = "100"
    t.salidaBobinasKg[1] = "100"
    t.scrapTransparenteKg = "150"
    t.scrapImpresoKg = "10"

    const flushed = flushPrintingTurnoOperativoToCapturas(t)
    expect(flushed.capturas).toHaveLength(1)
    expect(flushed.entradaBobinasKg.every((v) => v === "" || v === "0")).toBe(true)
    expect(flushed.salidaBobinasKg.every((v) => v === "" || v === "0")).toBe(true)
    expect(flushed.scrapTransparenteKg).toBe("0")
    expect(flushed.scrapImpresoKg).toBe("0")

    const tot = turnoProduccionTotals(flushed)
    expect(tot.entradaKg).toBe(300)
    expect(tot.salidaKg).toBe(200)
    expect(tot.scrapKg).toBe(160)
  })

  it("accumulate suma capturas del turno actual", () => {
    let t = turnoBase()
    t.salidaBobinasKg[0] = "50"
    t = flushPrintingTurnoOperativoToCapturas(t)
    t.salidaBobinasKg[0] = "30"
    const acc = accumulatePrintingFromJson([], t)
    expect(acc.producidoKg).toBe(80)
  })
})
