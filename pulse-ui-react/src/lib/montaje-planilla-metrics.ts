/**
 * Cálculos automáticos del área de montaje en la planilla OT.
 * - Desarrollo (mm) = frecuencia × N° repetición
 * - Ancho montaje (mm) = ancho corte × N° bandas
 */

export type MetricParts = { nominal: number; tolerance: number }

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function parsePositiveInt(v: unknown): number | null {
  const s = readString(v).trim()
  if (!s || !/^\d+$/.test(s)) return null
  const n = Number(s)
  return n > 0 ? n : null
}

/** Extrae valor nominal y tolerancia de "250", "250±2" o "329-331". */
export function parseMetricParts(raw: unknown): MetricParts | null {
  const s = readString(raw).trim().replace(",", ".")
  if (!s) return null

  const num = String.raw`\d+(?:\.\d+)?`

  const plusMinus = new RegExp(`^(${num})\\s*±\\s*(${num})$`).exec(s)
  if (plusMinus) {
    const nominal = Number(plusMinus[1])
    const tolerance = Number(plusMinus[2])
    if (!Number.isFinite(nominal) || !Number.isFinite(tolerance)) return null
    return { nominal, tolerance }
  }

  const range = new RegExp(`^(${num})\\s*-\\s*(${num})$`).exec(s)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null
    return { nominal: (low + high) / 2, tolerance: Math.abs(high - low) / 2 }
  }

  const plain = new RegExp(`^(${num})$`).exec(s)
  if (plain) {
    const nominal = Number(plain[1])
    if (!Number.isFinite(nominal)) return null
    return { nominal, tolerance: 0 }
  }

  return null
}

function formatMetricNumber(value: number): string {
  if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value))
  }
  return value
    .toFixed(3)
    .replace(/\.?0+$/, "")
}

export function formatMetricValue(nominal: number, tolerance: number): string {
  const n = formatMetricNumber(nominal)
  if (!(tolerance > 0)) return n
  return `${n}±${formatMetricNumber(tolerance)}`
}

/** Desarrollo (mm) = frecuencia × N° repetición (valor nominal, sin ±). */
export function computeDesarrolloMontaje(frecuencia: unknown, numRepeticion: unknown): string {
  const freq = parseMetricParts(frecuencia)
  const rep = parsePositiveInt(numRepeticion)
  if (!freq || rep === null) return ""
  const value = Math.round(freq.nominal * rep)
  if (value <= 0 || value > 999) return ""
  return `${value}mm`
}

/** Entrada manual: hasta 3 dígitos y sufijo mm automático. */
export function sanitizeDesarrolloMmInput(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 3)
  if (!digits) return ""
  return `${digits}mm`
}

export function isDesarrolloMmLike(v: unknown): boolean {
  return /^\d{1,3}mm$/i.test(readString(v).trim())
}

/** Normaliza valores guardados (p. ej. 812, 812±2) al formato 812mm. */
export function normalizeDesarrolloMmValue(raw: unknown): string {
  const s = readString(raw).trim()
  if (!s) return ""
  const mmMatch = /^(\d{1,3})\s*mm$/i.exec(s)
  if (mmMatch) return `${mmMatch[1]}mm`
  const parts = parseMetricParts(s)
  if (parts) {
    const n = Math.round(parts.nominal)
    if (n > 0 && n <= 999) return `${n}mm`
  }
  const digits = s.replace(/\D/g, "").slice(0, 3)
  return digits ? `${digits}mm` : ""
}

/** Ancho montaje (mm) = ancho corte × N° bandas (tolerancia proporcional). */
export function computeAnchoMontaje(anchoCorteMontaje: unknown, numBandas: unknown): string {
  const ancho = parseMetricParts(anchoCorteMontaje)
  const bandas = parsePositiveInt(numBandas)
  if (!ancho || bandas === null) return ""
  return formatMetricValue(ancho.nominal * bandas, ancho.tolerance * bandas)
}

/** Devuelve solo las claves auto-calculadas que se puedan derivar. */
export function syncMontajeAutoFields(form: Record<string, unknown>): Partial<Record<"desarrollo" | "anchoMontaje", string>> {
  const patch: Partial<Record<"desarrollo" | "anchoMontaje", string>> = {}
  const desarrollo = computeDesarrolloMontaje(form.frecuencia, form.numRepeticion)
  const anchoMontaje = computeAnchoMontaje(form.anchoCorteMontaje, form.numBandas)
  if (desarrollo) patch.desarrollo = desarrollo
  if (anchoMontaje) patch.anchoMontaje = anchoMontaje
  return patch
}

/** Sugiere desarrollo/ancho montaje solo cuando el campo está vacío (no sobrescribe entrada manual). */
export function montajeAutoFieldsIfEmpty(
  form: Record<string, unknown>,
): Partial<Record<"desarrollo" | "anchoMontaje", string>> {
  const patch = syncMontajeAutoFields(form)
  const out: Partial<Record<"desarrollo" | "anchoMontaje", string>> = {}
  if (!readString(form.desarrollo).trim() && patch.desarrollo) out.desarrollo = patch.desarrollo
  if (!readString(form.anchoMontaje).trim() && patch.anchoMontaje) out.anchoMontaje = patch.anchoMontaje
  return out
}

/** Formulario con sugerencias auto solo en campos vacíos. */
export function fillMontajeAutoFieldsIfEmpty(form: Record<string, unknown>): Record<string, unknown> {
  return { ...form, ...montajeAutoFieldsIfEmpty(form) }
}
