/** Entrada decimal con hasta 2 fracciones; acepta `.` o `,` y muestra coma (ej. 324,00). */

export function sanitizeDecimalTwoInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  const v = trimmed.replace(/[^\d.,]/g, "")
  if (!v) return ""

  const sepIdx = v.search(/[.,]/)
  if (sepIdx < 0) return v.replace(/[.,]/g, "")

  const intPart = v.slice(0, sepIdx).replace(/[.,]/g, "")
  const decPart = v.slice(sepIdx + 1).replace(/[.,]/g, "").slice(0, 2)
  const endsWithSep = /[.,]$/.test(v)

  if (!decPart && endsWithSep) return intPart ? `${intPart},` : ","
  if (!decPart) return intPart
  return `${intPart},${decPart}`
}

export function parseDecimalTwoInput(raw: unknown): number | null {
  const t = sanitizeDecimalTwoInput(String(raw ?? "")).replace(/,$/, "")
  if (!t) return null
  const n = Number(t.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/** Formato fijo con coma y 2 decimales, sin separador de miles. */
export function formatDecimalTwoDisplay(raw: unknown): string {
  const t = String(raw ?? "").trim()
  if (!t) return ""
  const n = Number(t.replace(",", "."))
  if (!Number.isFinite(n)) return t
  return n.toFixed(2).replace(".", ",")
}

export function formatDecimalTwoOnBlur(raw: string): string {
  const parsed = parseDecimalTwoInput(raw)
  if (parsed === null) return ""
  return parsed.toFixed(2).replace(".", ",")
}

/** Valor aleatorio en [min, max] con coma y 2 decimales (relleno demo planilla OT). */
export function randomDecimalTwoComma(min: number, max: number): string {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const n = lo + Math.random() * (hi - lo)
  return formatDecimalTwoDisplay(n)
}

/** Igual que randomDecimalTwoComma pero con punto (inputs HTML type="number"). */
export function randomDecimalTwoDot(min: number, max: number): string {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const n = lo + Math.random() * (hi - lo)
  return n.toFixed(2)
}

/** Decimal con fracción libre (sin tope de cifras); acepta `.` o `,` y muestra coma. */
export function sanitizeDecimalInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  const v = trimmed.replace(/[^\d.,]/g, "")
  if (!v) return ""

  const sepIdx = v.search(/[.,]/)
  if (sepIdx < 0) return v.replace(/[.,]/g, "")

  const intPart = v.slice(0, sepIdx).replace(/[.,]/g, "")
  const decPart = v.slice(sepIdx + 1).replace(/[.,]/g, "")
  const endsWithSep = /[.,]$/.test(v)

  if (!decPart && endsWithSep) return intPart ? `${intPart},` : ","
  if (!decPart) return intPart
  return `${intPart},${decPart}`
}

export function parseDecimalInput(raw: unknown): number | null {
  const t = sanitizeDecimalInput(String(raw ?? "")).replace(/,$/, "")
  if (!t) return null
  const n = Number(t.replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/** Normaliza coma/punto sin forzar cantidad de decimales. */
export function formatDecimalDisplay(raw: unknown): string {
  const t = String(raw ?? "").trim()
  if (!t) return ""
  const normalized = sanitizeDecimalInput(t)
  return normalized || t
}

export function formatDecimalOnBlur(raw: string): string {
  const sanitized = sanitizeDecimalInput(raw)
  if (!sanitized) return ""
  return sanitized.endsWith(",") ? sanitized.slice(0, -1) : sanitized
}

export const LAM_MATERIAL_METROS_NA = "N/A"

/** Metros adhesivo/catalizador laminación: vacío → N/A; editable como texto libre o número. */
export function lamMaterialMetrosDisplay(
  value: unknown,
  fieldKey: string,
  focusedKey: string | null,
): string {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : ""
  if (focusedKey === fieldKey) return raw
  const trimmed = raw.trim()
  return trimmed || LAM_MATERIAL_METROS_NA
}

export function normalizeLamMaterialMetrosOnBlur(raw: string): string {
  const t = raw.trim()
  if (!t) return LAM_MATERIAL_METROS_NA
  const compact = t.replace(/\s/g, "").replace(/\//g, "")
  if (/^na$/i.test(compact)) return LAM_MATERIAL_METROS_NA
  return t
}
