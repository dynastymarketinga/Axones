/** Validación del formulario de nueva nota de entrega (patrón orden-cliente/nueva). */

export const DN_DATE_REQUIRED_HELPER = "Indique la fecha del documento."
export const DN_DATE_REQUIRED_TOAST = "Indique la fecha del documento."
export const DN_DRIVER_REQUIRED_HELPER = "Indique el nombre del conductor."
export const DN_DRIVER_REQUIRED_TOAST = "Indique el nombre del conductor."
export const DN_DRIVER_DOC_REQUIRED_HELPER = "Indique la cédula del conductor."
export const DN_DRIVER_DOC_REQUIRED_TOAST = "Indique la cédula del conductor."
export const DN_VEHICLE_REQUIRED_HELPER = "Indique el vehículo (marca, modelo o descripción)."
export const DN_VEHICLE_REQUIRED_TOAST = "Indique el vehículo."
export const DN_PLATE_REQUIRED_HELPER = "Indique la placa del vehículo."
export const DN_PLATE_REQUIRED_TOAST = "Indique la placa del vehículo."
export const DN_PALETAS_REQUIRED_HELPER =
  "Seleccione al menos una paleta con cantidad mayor a cero."
export const DN_PALETAS_REQUIRED_TOAST = DN_PALETAS_REQUIRED_HELPER

export type DeliveryNoteFormField =
  | "documentDate"
  | "driverName"
  | "driverDocument"
  | "vehicleName"
  | "vehiclePlate"
  | "paletas"

export type DeliveryNoteFormValues = {
  documentDate: string
  driverName: string
  driverDocument: string
  vehicleName: string
  vehiclePlate: string
  includedPaletaCount: number
}

export type DeliveryNoteFormErrors = Partial<Record<DeliveryNoteFormField, string>>

export function todayLocalDateInput(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function validateDeliveryNoteForm(values: DeliveryNoteFormValues): DeliveryNoteFormErrors {
  const errors: DeliveryNoteFormErrors = {}
  if (!values.documentDate.trim()) {
    errors.documentDate = DN_DATE_REQUIRED_HELPER
  }
  if (!values.driverName.trim()) {
    errors.driverName = DN_DRIVER_REQUIRED_HELPER
  }
  if (!values.driverDocument.trim()) {
    errors.driverDocument = DN_DRIVER_DOC_REQUIRED_HELPER
  }
  if (!values.vehicleName.trim()) {
    errors.vehicleName = DN_VEHICLE_REQUIRED_HELPER
  }
  if (!values.vehiclePlate.trim()) {
    errors.vehiclePlate = DN_PLATE_REQUIRED_HELPER
  }
  if (values.includedPaletaCount < 1) {
    errors.paletas = DN_PALETAS_REQUIRED_HELPER
  }
  return errors
}

export function hasDeliveryNoteFormErrors(errors: DeliveryNoteFormErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Primer campo inválido (orden de tabulación en pantalla). */
export function firstDeliveryNoteFormErrorField(
  errors: DeliveryNoteFormErrors,
): DeliveryNoteFormField | null {
  const order: DeliveryNoteFormField[] = [
    "documentDate",
    "driverName",
    "driverDocument",
    "vehicleName",
    "vehiclePlate",
    "paletas",
  ]
  for (const key of order) {
    if (errors[key]) return key
  }
  return null
}

export const DN_FIELD_TOAST: Record<DeliveryNoteFormField, string> = {
  documentDate: DN_DATE_REQUIRED_TOAST,
  driverName: DN_DRIVER_REQUIRED_TOAST,
  driverDocument: DN_DRIVER_DOC_REQUIRED_TOAST,
  vehicleName: DN_VEHICLE_REQUIRED_TOAST,
  vehiclePlate: DN_PLATE_REQUIRED_TOAST,
  paletas: DN_PALETAS_REQUIRED_TOAST,
}
