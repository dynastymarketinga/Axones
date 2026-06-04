import { describe, expect, it } from "vitest"

import { operationalAlertTypeLabel } from "./operational-alert-labels"

describe("operationalAlertTypeLabel", () => {
  it("traduce tipos de almacén sin mostrar códigos técnicos", () => {
    expect(operationalAlertTypeLabel("material_request_pending_warehouse")).toBe(
      "Insumos pendientes de despacho",
    )
    expect(operationalAlertTypeLabel("inventory_return_pending")).toBe(
      "Devolución pendiente de revisión",
    )
  })

  it("no expone guiones bajos en tipos desconocidos", () => {
    expect(operationalAlertTypeLabel("foo_bar_baz")).toBe("Otro aviso")
  })
})
