import { describe, expect, it } from "vitest"

import {
  printingActivasBucketFromRow,
  printingMesBandFromWorkOrderRow,
} from "@/lib/printing-mes-band-status"
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
    expect(printingMesBandFromWorkOrderRow(row, Date.now())?.workflow).toBe("sin_iniciar")
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
