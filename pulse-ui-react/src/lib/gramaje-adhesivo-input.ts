/**
 * Rango de gramaje adhesivo en planilla OT (p. ej. 1,5 A 2,2).
 * - Al escribir "a" se normaliza a " A ".
 * - Tras completar el primer decimal, el siguiente dígito inicia el segundo valor.
 */

function sanitizeDecimalFragment(raw: string, preferSingleDecDigit = false): string {
  const v = raw.replace(/[^0-9,]/g, "")
  const comma = v.indexOf(",")
  if (comma < 0) {
    const digits = v.replace(/,/g, "")
    if (digits.length <= 2) {
      if (preferSingleDecDigit && digits.length === 2) {
        return `${digits[0]},${digits[1]}`
      }
      return digits
    }
    const intPart = digits.slice(0, 2)
    const rest = digits.slice(2)
    if (rest.length <= 2) return `${intPart},${rest}`
    return `${intPart},${rest.slice(0, 2)}`
  }

  const intPart = v.slice(0, comma).slice(0, 2)
  const decPart = v.slice(comma + 1).replace(/,/g, "").slice(0, 2)
  if (!decPart) return v.endsWith(",") ? `${intPart},` : intPart
  return `${intPart},${decPart}`
}

function splitAtRange(raw: string): { first: string; second: string } {
  const v = raw.replace(/[^0-9,]/g, "")
  const comma = v.indexOf(",")
  if (comma < 0) {
    const digits = v
    if (digits.length <= 2) return { first: digits, second: "" }
    if (digits.length >= 3) {
      return {
        first: `${digits[0]},${digits[1]}`,
        second: sanitizeDecimalFragment(digits.slice(2), true),
      }
    }
    return { first: digits.slice(0, 2), second: sanitizeDecimalFragment(digits.slice(2)) }
  }

  const intPart = v.slice(0, comma).slice(0, 2)
  const afterComma = v.slice(comma + 1).replace(/,/g, "")

  if (afterComma.length === 0) {
    return { first: v.endsWith(",") ? `${intPart},` : intPart, second: "" }
  }
  if (afterComma.length === 1) {
    return { first: `${intPart},${afterComma}`, second: "" }
  }
  if (afterComma.length === 2) {
    if (intPart.length === 1) {
      return {
        first: `${intPart},${afterComma[0]}`,
        second: sanitizeDecimalFragment(afterComma[1] ?? "", true),
      }
    }
    return { first: `${intPart},${afterComma}`, second: "" }
  }

  return {
    first: `${intPart},${afterComma.slice(0, 2)}`,
    second: sanitizeDecimalFragment(afterComma.slice(2)),
  }
}

export function sanitizeGramajeAdhesivoInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""

  let normalized = trimmed.replace(/(\d)\s*([aA])\s*(\d)/g, "$1 A $3")
  normalized = normalized.replace(/\ba\b/gi, " A ")

  const sepParts = normalized.split(/\s+A\s+/i)
  if (sepParts.length >= 2) {
    const first = sanitizeDecimalFragment(sepParts[0] ?? "")
    const secondRaw = sepParts.slice(1).join("")
    const second = sanitizeDecimalFragment(secondRaw, true)
    if (!second && /\s+A\s*$/i.test(normalized)) return first ? `${first} A ` : ""
    return second ? `${first} A ${second}` : first
  }

  const { first, second } = splitAtRange(normalized)
  return second ? `${first} A ${second}` : first
}

export function isGramajeAdhesivoRangeLike(v: unknown): boolean {
  const s = String(v ?? "").trim()
  if (!s) return false
  const dec = String.raw`\d{1,2}(?:[.,]\d{1,2})?`
  return new RegExp(`^${dec}\\s+A\\s+${dec}$`, "i").test(s)
}
