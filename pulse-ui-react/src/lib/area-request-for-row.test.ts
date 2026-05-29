import { describe, expect, it } from "vitest"

import type { WorkOrderListRow } from "@/types/api"

import { resolveAreaRequestStatusForTab } from "./area-request-for-row"

describe("resolveAreaRequestStatusForTab", () => {
  it("historial ignora solicitudes hechas antiguas si hay una pendiente reciente", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      area_requests: [
        { id: 2, area: "montaje", status: "done", work_order_id: 1, created_at: "2026-05-27T10:00:00Z" },
        { id: 3, area: "montaje", status: "pending", work_order_id: 1, created_at: "2026-05-28T10:00:00Z" },
      ],
    } as unknown as WorkOrderListRow
    expect(resolveAreaRequestStatusForTab(row, "historial")).toBeNull()
    expect(resolveAreaRequestStatusForTab(row, "activas")).toBe("pending")
  })

  it("historial usa la solicitud más reciente cuando no hay pendiente", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      area_requests: [
        { id: 1, area: "montaje", status: "done", work_order_id: 1, created_at: "2026-05-27T10:00:00Z" },
        { id: 2, area: "montaje", status: "cancelled", work_order_id: 1, created_at: "2026-05-28T10:00:00Z" },
      ],
    } as unknown as WorkOrderListRow
    expect(resolveAreaRequestStatusForTab(row, "historial")).toBe("cancelled")
  })
})
