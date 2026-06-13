import { describe, expect, it } from "vitest"

import { deriveAssistantContext } from "./axones-assistant-context"

describe("deriveAssistantContext", () => {
  it("detecta una OT por número en la ruta", () => {
    const ctx = deriveAssistantContext("/ordenes-trabajo/421", "boss")
    expect(ctx.route).toBe("/ordenes-trabajo/421")
    expect(ctx.entity_type).toBe("work_order")
    expect(ctx.entity_id).toBe(421)
    expect(ctx.area).toBe("general")
  })

  it("detecta un material en la ruta", () => {
    const ctx = deriveAssistantContext("/materiales/12", "inventory")
    expect(ctx.entity_type).toBe("material")
    expect(ctx.entity_id).toBe(12)
    expect(ctx.area).toBe("inventory")
  })

  it("detecta una solicitud de material", () => {
    const ctx = deriveAssistantContext("/solicitudes-material/77/edit", "planificador")
    expect(ctx.entity_type).toBe("material_request")
    expect(ctx.entity_id).toBe(77)
  })

  it("normaliza ruta sin slash inicial", () => {
    const ctx = deriveAssistantContext("alertas", null)
    expect(ctx.route).toBe("/alertas")
    expect(ctx.entity_type).toBeUndefined()
  })

  it("mapea rol corte a área corte", () => {
    const ctx = deriveAssistantContext("/resumen", "corte")
    expect(ctx.area).toBe("corte")
  })

  it("mapea rol desconocido a general", () => {
    const ctx = deriveAssistantContext("/resumen", "rol-x")
    expect(ctx.area).toBe("general")
  })
})
