import { parseDecimalTwoInput, sanitizeDecimalTwoInput } from "@/lib/decimal-two-input"

/** Solo dígitos y separador decimal (máx. 2 decimales) para rejillas MES de bobinas. */
export function sanitizeBobinaKgSlotInput(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return ""
    return sanitizeDecimalTwoInput(String(raw))
  }
  if (typeof raw !== "string") return ""
  return sanitizeDecimalTwoInput(raw)
}

/** Casilla con kg registrado (> 0) para indicador visual en rejilla MES. */
export function isBobinaKgSlotFilled(raw: unknown): boolean {
  const n = parseDecimalTwoInput(raw)
  return n !== null && n > 0
}

/** Kg numérico de casilla bobina: acepta `,` o `.` y tolera separador al final (ej. `12,`). */
export function parseBobinaKgSlotNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  return parseDecimalTwoInput(raw) ?? 0
}
