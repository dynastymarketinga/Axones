import { describe, expect, it } from "vitest"

import {
  formatAxonesRoleHint,
  formatAxonesRoleLabel,
  getUserInitials,
} from "@/lib/axones-role-labels"

describe("axones-role-labels", () => {
  it("traduce roles técnicos a español", () => {
    expect(formatAxonesRoleLabel("boss")).toBe("Jefe supremo")
    expect(formatAxonesRoleLabel("inventory")).toBe("Inventario")
    expect(formatAxonesRoleLabel("impresion")).toBe("Impresión")
  })

  it("describe acceso completo para jefes", () => {
    expect(formatAxonesRoleHint("boss")).toBe("Acceso completo al sistema")
    expect(formatAxonesRoleHint("admin")).toBe("Acceso completo al sistema")
  })

  it("genera iniciales del nombre", () => {
    expect(getUserInitials("Desarrollador Ingeniero Víctor")).toBe("D")
    expect(getUserInitials("Valeria Rodrigues")).toBe("V")
    expect(getUserInitials("Axones")).toBe("A")
  })
})
