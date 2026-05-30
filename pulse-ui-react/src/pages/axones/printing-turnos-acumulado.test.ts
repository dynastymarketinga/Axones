import { describe, expect, it } from "vitest"

import {
  accumulatePrintingFromJson,
  emptyBobinaLabelMeta,
  flushPrintingTurnoOperativoToCapturas,
  salidaKgFromSlotsAndMeta,
  syncPrintingTurnoFromFormMirror,
  turnoProduccionTotals,
  type PrintingTurnoEntry,
} from "@/pages/axones/printing-turnos"

function baseTurno(overrides: Partial<PrintingTurnoEntry> = {}): PrintingTurnoEntry {
  return {
    id: "t-test",
    started_at: new Date().toISOString(),
    closed_at: null,
    closed_by: null,
    control_owner_user_id: null,
    control_owner_name: null,
    control_taken_at: null,
    turno: "diurno",
    grupo: "A",
    operador: "Op",
    ayudante: "",
    supervisor: "",
    entradaBobinasKg: Array(30).fill(""),
    entradaBobinasMeta: Array(30).fill(null).map(() => emptyBobinaLabelMeta()),
    salidaBobinasKg: Array(30).fill(""),
    salidaBobinasMeta: Array(30).fill(null).map(() => emptyBobinaLabelMeta()),
    devolucionBuenaKg: "",
    devolucionRechazadaKg: "",
    devolucionRechazadaBobinas: "",
    devolucionRechazadaMotivo: "",
    scrapTransparenteKg: "0",
    scrapImpresoKg: "0",
    observaciones: "",
    timer: {
      state: "stopped",
      startedAtMs: 0,
      lastResumeAtMs: 0,
      pauseAtMs: 0,
      effectiveAccSec: 0,
      deadAccSec: 0,
      pauses: [],
    },
    capturas: [],
    ...overrides,
  }
}

describe("printing acumulado kg", () => {
  it("suma tres turnos cerrados de 1000 kg", () => {
    const mkClosed = (id: string) =>
      baseTurno({
        id,
        closed_at: new Date().toISOString(),
        salidaBobinasKg: ["1000", ...Array(29).fill("")],
      })
    const acum = accumulatePrintingFromJson(
      [mkClosed("t1"), mkClosed("t2"), mkClosed("t3")],
      null,
    )
    expect(acum.producidoKg).toBe(3000)
  })

  it("cuenta peso de etiqueta cuando la casilla de salida está vacía", () => {
    const metas = baseTurno().salidaBobinasMeta.map((m, i) =>
      i === 0 ? { ...m, peso: "1000" } : m,
    )
    expect(salidaKgFromSlotsAndMeta(Array(30).fill(""), metas)).toBe(1000)
    expect(turnoProduccionTotals(baseTurno({ salidaBobinasMeta: metas })).salidaKg).toBe(1000)
  })

  it("syncPrintingTurnoFromFormMirror toma kg del espejo plano impSalidaBobinasKg", () => {
    const turno = baseTurno()
    const form = {
      impSalidaBobinasKg: ["1000", ...Array(29).fill("")],
    }
    const synced = syncPrintingTurnoFromFormMirror(form, turno)
    expect(turnoProduccionTotals(synced).salidaKg).toBe(1000)
  })

  it("flush a capturas conserva kg para acumulado del turno cerrado", () => {
    const turno = baseTurno({
      salidaBobinasKg: ["1000", ...Array(29).fill("")],
    })
    const flushed = flushPrintingTurnoOperativoToCapturas(turno)
    const closed = { ...flushed, closed_at: new Date().toISOString() }
    expect(turnoProduccionTotals(closed).salidaKg).toBe(1000)
    expect(accumulatePrintingFromJson([closed], null).producidoKg).toBe(1000)
  })
})
