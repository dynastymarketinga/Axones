/**
 * Entrada con tolerancia ± en planilla OT (p. ej. 250±2, 1040±2, 19-20).
 * - Al escribir "+", "+-" o "+/-" se convierte a ±.
 * - Tras completar los dígitos nominales (máx. por campo), el siguiente dígito va a tolerancia.
 */

export type MetricPlusMinusOptions = {
  maxNominalDigits?: number
  maxToleranceDigits?: number
  /** Permite rango con guion (p. ej. 19-20 en peso bobina). */
  allowRange?: boolean
  /** Tolerancia por defecto al completar en blur (p. ej. "2" en placeholder 250±2). */
  defaultTolerance?: string
  /** Sin límite de dígitos ni auto-partición al escribir (solo ± explícito o +). */
  unlimited?: boolean
}

const DEFAULT_OPTS: Required<MetricPlusMinusOptions> = {
  maxNominalDigits: 4,
  maxToleranceDigits: 2,
  allowRange: false,
}

/** Presets alineados con placeholders de la planilla OT. */
export const METRIC_INPUT_MM_3_T1: MetricPlusMinusOptions = {
  maxNominalDigits: 3,
  maxToleranceDigits: 1,
}
export const METRIC_INPUT_MM_4_T1: MetricPlusMinusOptions = {
  maxNominalDigits: 4,
  maxToleranceDigits: 1,
}
export const METRIC_INPUT_MM_4_T2: MetricPlusMinusOptions = {
  maxNominalDigits: 4,
  maxToleranceDigits: 2,
}
export const METRIC_INPUT_MM_2_T1: MetricPlusMinusOptions = {
  maxNominalDigits: 2,
  maxToleranceDigits: 1,
}
export const METRIC_INPUT_MM_1_T1: MetricPlusMinusOptions = {
  maxNominalDigits: 1,
  maxToleranceDigits: 1,
}
export const METRIC_INPUT_PLAIN: MetricPlusMinusOptions = {
  maxNominalDigits: 6,
  maxToleranceDigits: 0,
}
export const METRIC_INPUT_RANGE: MetricPlusMinusOptions = {
  maxNominalDigits: 3,
  maxToleranceDigits: 3,
  allowRange: true,
}
/** Planilla OT: campos con placeholder ± — entrada libre (p. ej. 4535353453±32423432). */
export const METRIC_INPUT_UNLIMITED_PLUS_MINUS: MetricPlusMinusOptions = {
  unlimited: true,
}
/** Peso bobina: rango con guion, sin ±, sin límite de dígitos. */
export const METRIC_INPUT_UNLIMITED_RANGE: MetricPlusMinusOptions = {
  unlimited: true,
  allowRange: true,
}

function normalizePlusMinusChars(v: string): string {
  return v
    .replace(/\+\s*[/]\s*-\s*/g, "±")
    .replace(/\+\s*-\s*/g, "±")
    .replace(/\+/g, "±")
}

function sanitizeRangeInput(v: string, maxDigitsPerSide: number | null): string {
  const idx = v.indexOf("-")
  if (idx < 0) {
    const left = v.replace(/\D/g, "")
    return maxDigitsPerSide === null ? left : left.slice(0, maxDigitsPerSide)
  }
  const leftRaw = v.slice(0, idx).replace(/\D/g, "")
  const rightRaw = v.slice(idx + 1).replace(/\D/g, "")
  const left = maxDigitsPerSide === null ? leftRaw : leftRaw.slice(0, maxDigitsPerSide)
  const right = maxDigitsPerSide === null ? rightRaw : rightRaw.slice(0, maxDigitsPerSide)
  if (!right && v.endsWith("-")) return `${left}-`
  return right ? `${left}-${right}` : left
}

function formatUnlimitedPlusMinus(v: string): string {
  const pmIdx = v.indexOf("±")
  if (pmIdx < 0) {
    return v.replace(/[^\d.,]/g, "")
  }
  const before = v.slice(0, pmIdx)
  const after = v.slice(pmIdx + 1)
  const nominal = before.replace(/[^\d.,]/g, "")
  const tolerance = after.replace(/[^\d.,]/g, "")
  const sep = /\s±/.test(v) ? " ±" : "±"
  if (tolerance) return `${nominal}${sep}${tolerance}`
  return nominal ? `${nominal}${sep}` : "±"
}

function sanitizeUnlimitedMetricInput(raw: string, opts: MetricPlusMinusOptions & typeof DEFAULT_OPTS): string {
  let v = raw.trim().replace(/[^0-9.,±+\-/\s]/g, "")
  v = normalizePlusMinusChars(v)

  if (opts.allowRange) {
    if (v.includes("±")) {
      v = v.slice(0, v.indexOf("±"))
    } else {
      v = v.replace(/±/g, "")
    }
  }

  if (opts.allowRange && !v.includes("±") && v.includes("-")) {
    return sanitizeRangeInput(v, null)
  }

  if (v.includes("±")) {
    return formatUnlimitedPlusMinus(v)
  }

  return v.replace(/[^\d.,]/g, "")
}

export function sanitizeMetricPlusMinusInput(
  raw: string,
  options?: MetricPlusMinusOptions,
): string {
  const opts = { ...DEFAULT_OPTS, ...options }
  const trimmed = raw.trim()
  if (!trimmed) return ""

  if (opts.unlimited) {
    return sanitizeUnlimitedMetricInput(trimmed, opts)
  }

  let v = trimmed.replace(/[^0-9.,±+\-/\s]/g, "")
  v = normalizePlusMinusChars(v).replace(/\s+/g, "")

  if (opts.maxToleranceDigits === 0) {
    return v.replace(/\D/g, "").slice(0, opts.maxNominalDigits)
  }

  if (opts.allowRange && !v.includes("±") && v.includes("-")) {
    return sanitizeRangeInput(v, Math.max(opts.maxNominalDigits, opts.maxToleranceDigits))
  }

  const pmIdx = v.indexOf("±")

  if (pmIdx >= 0) {
    const nominal = v.slice(0, pmIdx).replace(/\D/g, "").slice(0, opts.maxNominalDigits)
    const tolerance = v.slice(pmIdx + 1).replace(/\D/g, "").slice(0, opts.maxToleranceDigits)
    if (tolerance) return `${nominal}±${tolerance}`
    return nominal ? `${nominal}±` : "±"
  }

  const allDigits = v.replace(/\D/g, "")
  if (!allDigits) return ""

  if (opts.defaultTolerance && pmIdx < 0) {
    const tol = opts.defaultTolerance.replace(/\D/g, "").slice(0, opts.maxToleranceDigits)
    if (tol.length > 0 && allDigits.length > tol.length && allDigits.endsWith(tol)) {
      const nominal = allDigits.slice(0, -tol.length).slice(0, opts.maxNominalDigits)
      if (nominal.length > 0) {
        return `${nominal}±${tol}`
      }
    }
  }

  if (allDigits.length <= opts.maxNominalDigits) {
    return allDigits
  }

  const nominal = allDigits.slice(0, opts.maxNominalDigits)
  const tolerance = allDigits.slice(opts.maxNominalDigits, opts.maxNominalDigits + opts.maxToleranceDigits)
  if (tolerance) return `${nominal}±${tolerance}`
  return nominal
}

/** Alias usado en handlers onChange de la planilla. */
export function sanitizeMetricInput(raw: string, options?: MetricPlusMinusOptions): string {
  return sanitizeMetricPlusMinusInput(raw, options)
}

/** Extrae la tolerancia del placeholder (p. ej. "250±2" → "2", "1020 ± 20" → "20"). */
export function parseMetricPlaceholderTolerance(placeholder: string): string | undefined {
  const normalized = placeholder.replace(/\s+/g, "")
  const idx = normalized.indexOf("±")
  if (idx < 0) return undefined
  const tol = normalized.slice(idx + 1).replace(/\D/g, "")
  return tol.length > 0 ? tol : undefined
}

/** Combina preset del campo con tolerancia por defecto del placeholder. */
export function metricOptionsFromPlaceholder(
  preset: MetricPlusMinusOptions,
  placeholder: string,
): MetricPlusMinusOptions {
  const defaultTolerance = parseMetricPlaceholderTolerance(placeholder)
  return defaultTolerance !== undefined ? { ...preset, defaultTolerance } : preset
}

function resolvedDefaultTolerance(opts: MetricPlusMinusOptions & typeof DEFAULT_OPTS): string {
  const fromOpt = readString(opts.defaultTolerance).replace(/\D/g, "")
  const raw = fromOpt || "1"
  return raw.slice(0, opts.maxToleranceDigits)
}

function readString(v: unknown): string {
  if (v == null) return ""
  return String(v)
}

/**
 * Al salir del campo: completa tolerancia faltante (25± → 25±2) o añade ± del placeholder si solo hay nominal.
 */
export function formatMetricPlusMinusOnBlur(
  raw: string,
  options?: MetricPlusMinusOptions,
): string {
  const opts = { ...DEFAULT_OPTS, ...options }
  const trimmed = raw.trim()
  if (!trimmed) return ""

  if (opts.unlimited) {
    const sanitized = sanitizeUnlimitedMetricInput(trimmed, opts)
    if (!sanitized) return ""
    if (sanitized.includes("±") || (opts.allowRange && sanitized.includes("-"))) {
      return sanitized
    }
    if (opts.allowRange) return sanitized
    const defaultTol = readString(opts.defaultTolerance).replace(/\D/g, "")
    if (defaultTol) return `${sanitized}±${defaultTol}`
    return sanitized
  }

  if (opts.maxToleranceDigits === 0) {
    return sanitizeMetricPlusMinusInput(trimmed, options)
  }

  if (opts.allowRange && trimmed.includes("-") && !trimmed.includes("±")) {
    return sanitizeMetricPlusMinusInput(trimmed, options)
  }

  const defaultTol = resolvedDefaultTolerance(opts)

  const pmIdx = trimmed.indexOf("±")
  if (pmIdx >= 0) {
    const nominal = trimmed.slice(0, pmIdx).replace(/\D/g, "").slice(0, opts.maxNominalDigits)
    const tolerance = trimmed.slice(pmIdx + 1).replace(/\D/g, "").slice(0, opts.maxToleranceDigits)
    if (nominal && tolerance) {
      return sanitizeMetricPlusMinusInput(trimmed, options)
    }
    if (nominal) {
      return `${nominal}±${defaultTol}`
    }
    return ""
  }

  const sanitized = sanitizeMetricPlusMinusInput(trimmed, options)
  if (!sanitized || sanitized.includes("±")) return sanitized

  const nominal = sanitized.replace(/\D/g, "").slice(0, opts.maxNominalDigits)
  if (!nominal) return ""
  return `${nominal}±${defaultTol}`
}
