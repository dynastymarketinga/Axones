import { describe, expect, it } from "vitest"

import {
  formatBandejaIsoDate,
  normalizeBandejaPriority,
  readBandejaProgramacion,
} from "@/lib/area-bandeja-programacion"
import type { WorkOrderListRow } from "@/types/api"

describe("normalizeBandejaPriority", () => {
  it("maps known values", () => {
    expect(normalizeBandejaPriority("urgente")).toBe("urgente")
    expect(normalizeBandejaPriority("ALTA")).toBe("alta")
    expect(normalizeBandejaPriority("")).toBe("normal")
  })
})

describe("formatBandejaIsoDate", () => {
  it("formats ISO dates", () => {
    expect(formatBandejaIsoDate("2026-06-10")).toBe("10/06/2026")
  })

  it("returns em dash for empty", () => {
    expect(formatBandejaIsoDate("")).toBe("—")
    expect(formatBandejaIsoDate(null)).toBe("—")
  })
})

describe("readBandejaProgramacion", () => {
  it("reads from row priority and form fields", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      priority: "urgente",
      technical_document: {
        form: {
          fechaInicio: "2026-06-01",
          fechaEntrega: "2026-06-20",
          programacionMotivo: "Coordinar corte con cliente",
        },
      },
    } as unknown as WorkOrderListRow

    expect(readBandejaProgramacion(row)).toEqual({
      priority: "urgente",
      fechaInicio: "2026-06-01",
      fechaEntrega: "2026-06-20",
      motivo: "Coordinar corte con cliente",
    })
  })

  it("falls back to form priority when row priority missing", () => {
    const row = {
      id: 1,
      code: "OT-1",
      status: "open",
      technical_document: {
        form: { priority: "alta" },
      },
    } as unknown as WorkOrderListRow

    expect(readBandejaProgramacion(row).priority).toBe("alta")
  })
})
