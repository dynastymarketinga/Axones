import { describe, expect, it } from "vitest"

import {
  printingActivasBucketFromRow,
  printingMesBandFromWorkOrderRow,
} from "@/lib/printing-mes-band-status"
import { mesBandejaKgTotalsFromBands } from "@/lib/mes-timer-band-shared"
import type { WorkOrderListRow } from "@/types/api"

describe("printingActivasBucketFromRow", () => {
  it("pendientes: solicitud nueva sin turnos", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "impresion",
      technical_document: {
        form: { impEstadoArea: "abierta", impTurnosImpresion: [], impTurnoActual: null },
      },
    } as unknown as WorkOrderListRow
    expect(printingActivasBucketFromRow(row, Date.now())).toBe("pendientes")
  })

  it("produccion: entre turnos con turnos cerrados", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "montaje",
      technical_document: {
        form: {
          impEstadoArea: "abierta",
          impTurnosImpresion: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              ayudante: "",
              supervisor: "",
              timer: { state: "stopped", effectiveAccSec: 50, deadAccSec: 5 },
            },
          ],
          impTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow
    expect(printingActivasBucketFromRow(row, Date.now())).toBe("produccion")
    expect(printingMesBandFromWorkOrderRow(row, Date.now())?.workflow).toBe("entre_turnos")
  })

  it("producido acumulado incluye turnos cerrados y turno actual", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "impresion",
      technical_document: {
        form: {
          impEstadoArea: "abierta",
          impTurnosImpresion: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              ayudante: "",
              supervisor: "",
              salidaBobinasKg: ["100", ""],
              timer: { state: "stopped", effectiveAccSec: 0, deadAccSec: 0 },
            },
          ],
          impTurnoActual: {
            id: "t-2",
            turno: "nocturno",
            grupo: "B",
            operador: "Op2",
            ayudante: "",
            supervisor: "",
            salidaBobinasKg: ["50", ""],
            timer: { state: "stopped", effectiveAccSec: 0, deadAccSec: 0 },
          },
        },
      },
    } as unknown as WorkOrderListRow
    const band = printingMesBandFromWorkOrderRow(row, Date.now())
    expect(band?.producidoKg).toBe(150)
  })

  it("entre turnos con espejo legacy running y sin turno actual", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "impresion",
      technical_document: {
        form: {
          impEstadoArea: "abierta",
          impTurnosImpresion: [
            {
              id: "t-1",
              turno: "nocturno",
              grupo: "B",
              operador: "Victor",
              ayudante: "",
              supervisor: "",
              closed_at: "2026-05-28T23:07:12.000Z",
              timer: { state: "stopped", effectiveAccSec: 1048, deadAccSec: 0 },
            },
          ],
          impTurnoActual: null,
          impTimerState: "running",
          impOperador: "Victor",
        },
      },
    } as unknown as WorkOrderListRow
    const band = printingMesBandFromWorkOrderRow(row, Date.now())
    expect(band?.workflow).toBe("entre_turnos")
    expect(band?.effectiveHms).toBe("00:17:28")
  })

  it("producido acumulado suma tres turnos cerrados de 1000 kg", () => {
    const mkTurno = (id: string, kg: string) => ({
      id,
      turno: "diurno",
      grupo: "A",
      operador: "Op",
      ayudante: "",
      supervisor: "",
      closed_at: "2026-05-28T12:00:00.000Z",
      salidaBobinasKg: [kg, ""],
      timer: { state: "stopped", effectiveAccSec: 0, deadAccSec: 0 },
    })
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "impresion",
      technical_document: {
        form: {
          impEstadoArea: "abierta",
          impAcumuladoProducidoKg: "3000",
          impTurnosImpresion: [mkTurno("t-1", "1000"), mkTurno("t-2", "1000"), mkTurno("t-3", "1000")],
          impTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow
    const band = printingMesBandFromWorkOrderRow(row, Date.now())
    expect(band?.producidoKg).toBe(3000)
  })

  it("finalizadas: impEstadoArea finalizada aunque board_stage no sea impresion", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "montaje",
      technical_document: {
        form: {
          impEstadoArea: "finalizada",
          impTurnosImpresion: [],
          impTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow
    expect(printingActivasBucketFromRow(row, Date.now())).toBe("finalizadas")
    expect(printingMesBandFromWorkOrderRow(row, Date.now())?.workflow).toBe("finalizado")
  })
})

describe("mesBandejaKgTotalsFromBands", () => {
  it("suma kg de varias filas visibles en la bandeja", () => {
    const totals = mesBandejaKgTotalsFromBands([
      {
        workflow: "turno_abierto",
        contextLine: "",
        hint: "",
        effectiveHms: "0:00:00",
        deadHms: "0:00:00",
        totalHms: "0:00:00",
        showTimes: false,
        showDeadBreakdown: false,
        producidoKg: 10,
        entradaKg: 10,
        desperdicioKg: 20,
      },
      {
        workflow: "iniciado",
        contextLine: "",
        hint: "",
        effectiveHms: "0:00:00",
        deadHms: "0:00:00",
        totalHms: "0:00:00",
        showTimes: false,
        showDeadBreakdown: false,
        producidoKg: 5,
        entradaKg: 3,
        desperdicioKg: 2,
      },
    ])

    expect(totals.rowsWithKg).toBe(2)
    expect(totals.producidoKg).toBe(15)
    expect(totals.entradaKg).toBe(13)
    expect(totals.desperdicioKg).toBe(22)
    expect(totals.totalMasaKg).toBe(50)
  })
})
