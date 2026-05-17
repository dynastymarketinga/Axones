import { describe, expect, it } from "vitest"

import {
  firstDeliveryNoteFormErrorField,
  hasDeliveryNoteFormErrors,
  validateDeliveryNoteForm,
} from "@/lib/delivery-note-form-validation"

describe("validateDeliveryNoteForm", () => {
  const valid = {
    documentDate: "2026-05-17",
    driverName: "Juan Pérez",
    driverDocument: "V-12345678",
    vehicleName: "Camión 3.5t",
    vehiclePlate: "ABC-123",
    includedPaletaCount: 1,
  }

  it("acepta formulario completo", () => {
    const errors = validateDeliveryNoteForm(valid)
    expect(hasDeliveryNoteFormErrors(errors)).toBe(false)
  })

  it("exige todos los campos de transporte y fecha", () => {
    const errors = validateDeliveryNoteForm({
      ...valid,
      documentDate: "",
      driverName: "  ",
      driverDocument: "",
      vehicleName: "",
      vehiclePlate: "",
      includedPaletaCount: 0,
    })
    expect(errors.documentDate).toBeTruthy()
    expect(errors.driverName).toBeTruthy()
    expect(errors.driverDocument).toBeTruthy()
    expect(errors.vehicleName).toBeTruthy()
    expect(errors.vehiclePlate).toBeTruthy()
    expect(errors.paletas).toBeTruthy()
    expect(firstDeliveryNoteFormErrorField(errors)).toBe("documentDate")
  })
})
