/** Traduce mensajes de validación Laravel que aún lleguen en inglés. */
const API_VALIDATION_EN_TO_ES: { pattern: RegExp; text: string }[] = [
  {
    pattern: /the code has already been taken\.?/i,
    text: "Ese código de orden ya está registrado. Use otro correlativo.",
  },
  {
    pattern: /has already been taken\.?/i,
    text: "Este valor ya está registrado.",
  },
  {
    pattern: /already been taken\.?/i,
    text: "Este valor ya está en uso.",
  },
  {
    pattern: /the selected .+ is invalid\.?/i,
    text: "El valor seleccionado no es válido.",
  },
  {
    pattern: /field is required\.?/i,
    text: "Este campo es obligatorio.",
  },
  {
    pattern: /must be at least /i,
    text: "El valor es menor al mínimo permitido.",
  },
  {
    pattern: /and \d+ more errors?\.?/i,
    text: "Revise los campos marcados.",
  },
]

export function translateApiValidationMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return trimmed
  for (const { pattern, text } of API_VALIDATION_EN_TO_ES) {
    if (pattern.test(trimmed)) return text
  }
  return trimmed
}

export function isDuplicatePurchaseOrderCodeMessage(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("unique") ||
    m.includes("ya está registrado") ||
    m.includes("ya esta registrado") ||
    m.includes("ya existe") ||
    m.includes("already been taken") ||
    m.includes("has already been taken") ||
    m.includes("en uso")
  )
}

export function translateApiValidationMessages(messages: string[]): string[] {
  return messages.map(translateApiValidationMessage)
}
