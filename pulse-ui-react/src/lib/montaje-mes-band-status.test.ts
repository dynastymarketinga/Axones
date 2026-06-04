import { describe, expect, it } from "vitest"

import {
  montajeActivasBucketFromRow,
  montajeMesBandFromWorkOrderRow,
} from "@/lib/montaje-mes-band-status"
import type { WorkOrderListRow } from "@/types/api"

describe("montajeActivasBucketFromRow", () => {
  it("pendientes: OT en montaje sin turnos", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "montaje",
      technical_document: {
        form: { montEstadoArea: "abierta", montTurnosMontaje: [], montTurnoActual: null },
      },
    } as unknown as WorkOrderListRow
    expect(montajeActivasBucketFromRow(row, Date.now())).toBe("pendientes")
  })

  it("produccion: turno abierto", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "montaje",
      technical_document: {
        form: {
          montEstadoArea: "abierta",
          montTurnoActual: {
            id: "t1",
            turno: "diurno",
            grupo: "A",
            operador: "Op",
            started_at: new Date().toISOString(),
            timer: { state: "pending" },
          },
          montTurnosMontaje: [],
        },
      },
    } as unknown as WorkOrderListRow
    expect(montajeActivasBucketFromRow(row, Date.now())).toBe("produccion")
  })

  it("produccion con arranque: workflow iniciado y etiqueta de fase", () => {
    const row = {
      id: 1,
      code: "OT-1",
      board_stage: "montaje",
      technical_document: {
        form: {
          montEstadoArea: "abierta",
          montTurnoActual: {
            id: "t1",
            turno: "diurno",
            grupo: "A",
            operador: "Op",
            started_at: new Date().toISOString(),
            timer: {
              state: "pending",
              arranqueState: "running",
              arranqueAccSec: 0,
              arranqueLastResumeAtMs: Date.now(),
            },
          },
          montTurnosMontaje: [],
        },
      },
    } as unknown as WorkOrderListRow
    const mes = montajeMesBandFromWorkOrderRow(row, Date.now())
    expect(mes?.workflow).toBe("iniciado")
    expect(mes?.statusLabel).toBe("Arranque en marcha")
  })

  it("finalizadas: montaje cerrado", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "montaje",
      technical_document: {
        form: { montEstadoArea: "finalizada", montTurnosMontaje: [], montTurnoActual: null },
      },
    } as unknown as WorkOrderListRow
    expect(montajeActivasBucketFromRow(row, Date.now())).toBe("finalizadas")
  })
})
