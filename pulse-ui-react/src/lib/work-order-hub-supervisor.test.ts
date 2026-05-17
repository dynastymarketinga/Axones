// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  classifyWorkOrderHubRow,
  hasAnyProductionActivity,
  isCoreProductionComplete,
} from "@/lib/work-order-hub-supervisor"
import { COR_ESTADO_KEY } from "@/pages/axones/corte-turnos"
import {
  MON_ACTUAL_KEY,
  MON_ESTADO_KEY,
  type MontajeTurnoEntry,
} from "@/pages/axones/montaje-turnos"
import type { WorkOrderListRow } from "@/types/api"

function baseRow(overrides: Partial<WorkOrderListRow> = {}): WorkOrderListRow {
  return {
    id: 1,
    code: "OT-2026-00001",
    status: "open",
    board_stage: "nueva",
    technical_document: { form: {} },
    ...overrides,
  }
}

function montajeTurnoOpen(): MontajeTurnoEntry {
  const now = Date.now()
  return {
    id: "t1",
    started_at: new Date(now).toISOString(),
    closed_at: null,
    closed_by: null,
    turno: "diurno",
    grupo: "A",
    operador: "Op",
    ayudante: "",
    supervisor: "",
    kgProduccion: "0",
    mermaKg: "0",
    metrajeMontaje: "0",
    observaciones: "",
    timer: {
      state: "pending",
      startedAtMs: now,
      lastResumeAtMs: 0,
      pauseAtMs: 0,
      effectiveAccSec: 0,
      deadAccSec: 0,
      pauses: [],
    },
  }
}

describe("classifyWorkOrderHubRow", () => {
  it("registrada: nueva sin turnos ni áreas finalizadas", () => {
    const row = baseRow({ board_stage: "nueva" })
    expect(classifyWorkOrderHubRow(row)).toBe("registered")
    expect(hasAnyProductionActivity(row, Date.now())).toBe(false)
  })

  it("registrada: pendiente sin actividad MES", () => {
    const row = baseRow({ board_stage: "pendiente" })
    expect(classifyWorkOrderHubRow(row)).toBe("registered")
  })

  it("en curso: turno abierto en montaje", () => {
    const row = baseRow({
      board_stage: "montaje",
      technical_document: {
        form: {
          [MON_ACTUAL_KEY]: montajeTurnoOpen(),
          [MON_ESTADO_KEY]: "abierta",
        },
      },
    })
    expect(classifyWorkOrderHubRow(row)).toBe("in_progress")
  })

  it("en curso: pendiente con producción ya iniciada", () => {
    const row = baseRow({
      board_stage: "pendiente",
      technical_document: {
        form: {
          [MON_ACTUAL_KEY]: montajeTurnoOpen(),
          [MON_ESTADO_KEY]: "abierta",
        },
      },
    })
    expect(classifyWorkOrderHubRow(row)).toBe("in_progress")
  })

  it("cerrada: solo corte finalizada", () => {
    const row = baseRow({
      technical_document: {
        form: {
          [COR_ESTADO_KEY]: "finalizada",
          montEstadoArea: "abierta",
          impEstadoArea: "abierta",
          lamEstadoArea: "abierta",
        },
      },
    })
    expect(classifyWorkOrderHubRow(row)).toBe("closed")
    expect(isCoreProductionComplete(row.technical_document!.form)).toBe(false)
  })

  it("cerrada completada: 4 áreas finalizadas", () => {
    const form = {
      montEstadoArea: "finalizada",
      impEstadoArea: "finalizada",
      lamEstadoArea: "finalizada",
      [COR_ESTADO_KEY]: "finalizada",
    }
    const row = baseRow({ technical_document: { form } })
    expect(classifyWorkOrderHubRow(row)).toBe("closed_complete")
    expect(isCoreProductionComplete(form)).toBe(true)
  })

  it("cancelada: solo visible conceptualmente en Todas", () => {
    const row = baseRow({ status: "cancelled" })
    expect(classifyWorkOrderHubRow(row)).toBe("cancelled")
  })

  it("cerrada completada: legacy status completed", () => {
    const row = baseRow({ status: "completed", board_stage: "impresion" })
    expect(classifyWorkOrderHubRow(row)).toBe("closed_complete")
  })
})
