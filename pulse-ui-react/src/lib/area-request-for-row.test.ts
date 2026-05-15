import { describe, expect, it } from "vitest"

import type { WorkOrderListRow } from "@/types/api"

import { resolveAreaRequestStatusForTab } from "./area-request-for-row"

describe("resolveAreaRequestStatusForTab", () => {
  it("historial prioriza solicitud hecha sobre pendiente reciente", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      area_requests: [
        { id: 1, area: "montaje", status: "pending", work_order_id: 1 },
        { id: 2, area: "montaje", status: "done", work_order_id: 1 },
      ],
    } as unknown as WorkOrderListRow
    expect(resolveAreaRequestStatusForTab(row, "historial")).toBe("done")
  })
})
