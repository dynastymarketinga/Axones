// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  laminacionActivasBucketFromRow,
  laminacionMesBandFromWorkOrderRow,
} from "@/lib/laminacion-mes-band-status"
import { LAM_ACTUAL_KEY, LAM_ESTADO_KEY, LAM_TURNOS_KEY } from "@/pages/axones/laminacion-turnos"

describe("laminacionMesBandFromWorkOrderRow", () => {
  it("producido acumulado desde turnos cerrados", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "laminacion",
      technical_document: {
        form: {
          [LAM_ESTADO_KEY]: "abierta",
          [LAM_TURNOS_KEY]: [
            {
              id: "t-1",
              turno: "diurno",
              grupo: "A",
              operador: "Op",
              closed_at: "2026-05-28T12:00:00.000Z",
              salidaBobinasKg: ["26", ...Array(29).fill("")],
              timer: { state: "stopped", effectiveAccSec: 40, deadAccSec: 4 },
            },
          ],
          [LAM_ACTUAL_KEY]: null,
          lamAcumuladoProducidoKg: "26",
        },
      },
    }
    const band = laminacionMesBandFromWorkOrderRow(row, Date.now())
    expect(band?.workflow).toBe("entre_turnos")
    expect(band?.producidoKg).toBe(26)
  })

  it("entre turnos en subpestaña produccion", () => {
    const row = {
      board_stage: "montaje",
      technical_document: {
        form: {
          [LAM_ESTADO_KEY]: "abierta",
          [LAM_TURNOS_KEY]: [
            {
              id: "t-1",
              turno: "nocturno",
              grupo: "B",
              operador: "Victor",
              closed_at: "2026-05-28T21:24:11.000Z",
              timer: { state: "stopped", effectiveAccSec: 41, deadAccSec: 4 },
            },
          ],
          [LAM_ACTUAL_KEY]: null,
        },
      },
    }
    expect(laminacionActivasBucketFromRow(row, Date.now())).toBe("produccion")
  })
})
