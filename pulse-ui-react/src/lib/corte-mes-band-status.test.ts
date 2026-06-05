import { describe, expect, it } from "vitest"

import {
  corteActivasBucketFromRow,
  corteMesBandFromWorkOrderRow,
} from "@/lib/corte-mes-band-status"
import type { WorkOrderListRow } from "@/types/api"

describe("corteActivasBucketFromRow", () => {
  it("finalizadas: corEstadoArea finalizada aunque haya area_time_summary", () => {
    const row = {
      id: 4,
      code: "OT-2026-00004",
      status: "open",
      board_stage: "corte",
      area_time_summary: {
        effective_seconds: 158,
        dead_seconds: 0,
        open_segment_type: null,
        open_started_at: null,
      },
      technical_document: {
        form: {
          corEstadoArea: "finalizada",
          cor_turnos: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              closed_at: "2026-06-04T23:10:59.000Z",
              timer: { state: "completed", effectiveAccSec: 158, deadAccSec: 0 },
            },
          ],
          corTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow

    expect(corteActivasBucketFromRow(row, Date.now())).toBe("finalizadas")
    expect(corteMesBandFromWorkOrderRow(row, Date.now())?.workflow).toBe("finalizado")
  })

  it("produccion: turnos cerrados sin finalizar área", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "corte",
      area_time_summary: {
        effective_seconds: 90,
        dead_seconds: 0,
        open_segment_type: null,
        open_started_at: null,
      },
      technical_document: {
        form: {
          corEstadoArea: "abierta",
          cor_turnos: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              closed_at: "2026-06-04T12:00:00.000Z",
              timer: { state: "stopped", effectiveAccSec: 90, deadAccSec: 0 },
            },
          ],
          corTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow

    expect(corteActivasBucketFromRow(row, Date.now())).toBe("produccion")
  })

  it("entre_turnos en formulario sin area_time_summary", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "corte",
      technical_document: {
        form: {
          corEstadoArea: "abierta",
          cor_turnos: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              closed_at: "2026-06-04T12:00:00.000Z",
              timer: { state: "stopped", effectiveAccSec: 90, deadAccSec: 0 },
            },
          ],
          corTurnoActual: null,
        },
      },
    } as unknown as WorkOrderListRow

    expect(corteMesBandFromWorkOrderRow(row, Date.now())?.workflow).toBe("entre_turnos")
  })
})
