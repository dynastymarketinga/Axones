import { describe, expect, it } from "vitest"

import type { WorkOrderListRow } from "@/types/api"

import { processStateForAreaBandeja } from "./area-mes-progress"

describe("processStateForAreaBandeja", () => {
  it("no marca hecho en montaje solo porque el tablero está en laminación", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "laminacion",
      technical_document: { form: { montEstadoArea: "abierta" } },
      area_requests: [{ id: 1, area: "montaje", status: "pending", work_order_id: 1 }],
    } as unknown as WorkOrderListRow

    expect(processStateForAreaBandeja("montaje", row)).toBe("Pendiente")
  })

  it("marca hecho en montaje cuando montEstadoArea está finalizada", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      board_stage: "laminacion",
      technical_document: { form: { montEstadoArea: "finalizada" } },
    } as unknown as WorkOrderListRow

    expect(processStateForAreaBandeja("montaje", row)).toBe("Hecho en área")
  })
})
