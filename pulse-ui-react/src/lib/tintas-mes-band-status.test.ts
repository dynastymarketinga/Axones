import { describe, expect, it } from "vitest"

import { tintasActivasBucketFromRow } from "@/lib/tintas-mes-band-status"
import type { WorkOrderListRow } from "@/types/api"

describe("tintasActivasBucketFromRow", () => {
  it("pendientes: sin area_time_summary", () => {
    const row = { id: 1, code: "OT-1", status: "open" } as unknown as WorkOrderListRow
    expect(tintasActivasBucketFromRow(row, Date.now())).toBe("pendientes")
  })

  it("produccion: timer iniciado", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      area_time_summary: {
        effective_seconds: 120,
        dead_seconds: 0,
        open_segment_type: "effective",
        open_started_at: new Date(Date.now() - 60_000).toISOString(),
      },
    } as unknown as WorkOrderListRow
    expect(tintasActivasBucketFromRow(row, Date.now())).toBe("produccion")
  })
})
