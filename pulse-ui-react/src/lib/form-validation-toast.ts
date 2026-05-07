import { toast } from "sonner"

/** Par ({ key }, etiqueta visible) en el orden de foco / prioridad del formulario. */
export type FieldErrorOrder = ReadonlyArray<{ readonly key: string; readonly label: string }>

const FALLBACK = "Revisa los campos marcados."

/**
 * Lista de líneas `Etiqueta: mensaje` para errores de campo (validación local).
 */
export function collectFieldValidationLines(
  errors: Record<string, string | undefined>,
  order: FieldErrorOrder,
): string[] {
  const lines: string[] = []
  const used = new Set<string>()
  for (const { key, label } of order) {
    const msg = errors[key]?.trim()
    if (msg) {
      lines.push(`${label}: ${msg}`)
      used.add(key)
    }
  }
  for (const [key, raw] of Object.entries(errors)) {
    const msg = raw?.trim()
    if (!msg || used.has(key)) continue
    lines.push(`${key}: ${msg}`)
  }
  return lines
}

/**
 * Un toast por cada error de campo (orden estable).
 */
export function toastFieldValidationErrors(
  errors: Record<string, string | undefined>,
  order: FieldErrorOrder,
): void {
  const lines = collectFieldValidationLines(errors, order)
  if (!lines.length) {
    toast.error(FALLBACK)
    return
  }
  for (const line of lines) {
    toast.error(line)
  }
}

/**
 * Arma un único texto multilínea (p. ej. logs o mensajes legacy).
 */
export function formatValidationErrorsToast(
  errors: Record<string, string | undefined>,
  order: FieldErrorOrder,
): string {
  const lines = collectFieldValidationLines(errors, order)
  return lines.length ? lines.join("\n") : FALLBACK
}
