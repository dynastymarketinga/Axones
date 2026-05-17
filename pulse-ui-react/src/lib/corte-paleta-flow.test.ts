import { describe, expect, it } from "vitest"

import {
  corteOperabilityFromForm,
  resolveAgregarPaletasDesdeNotaTarget,
} from "@/lib/corte-paleta-flow"
import { COR_ACTUAL_KEY, COR_ESTADO_KEY } from "@/pages/axones/corte-turnos"

describe("corteOperabilityFromForm", () => {
  it("permite agregar paleta con área abierta y turno actual", () => {
    const op = corteOperabilityFromForm({
      [COR_ESTADO_KEY]: "abierta",
      [COR_ACTUAL_KEY]: { id: "t1", started_at: "2026-01-01T00:00:00Z" },
    })
    expect(op.canAddPaleta).toBe(true)
    expect(op.areaEstado).toBe("abierta")
  })

  it("bloquea agregar paleta si el área está finalizada", () => {
    const op = corteOperabilityFromForm({
      [COR_ESTADO_KEY]: "finalizada",
      [COR_ACTUAL_KEY]: { id: "t1", started_at: "2026-01-01T00:00:00Z" },
    })
    expect(op.canAddPaleta).toBe(false)
  })
})

describe("resolveAgregarPaletasDesdeNotaTarget", () => {
  it("envía a Corte cuando una OT sigue operativa", () => {
    const target = resolveAgregarPaletasDesdeNotaTarget([1], {
      1: {
        areaEstado: "abierta",
        hasActiveTurno: true,
        canOperateProduction: true,
        canAddPaleta: true,
      },
    })
    expect(target.kind).toBe("corte")
    if (target.kind === "corte") expect(target.workOrderId).toBe(1)
  })

  it("envía a Despacho si Corte está finalizada", () => {
    const target = resolveAgregarPaletasDesdeNotaTarget([1], {
      1: {
        areaEstado: "finalizada",
        hasActiveTurno: false,
        canOperateProduction: false,
        canAddPaleta: false,
      },
    })
    expect(target.kind).toBe("despacho")
  })
})
