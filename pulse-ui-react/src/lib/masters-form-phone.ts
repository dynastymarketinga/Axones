/** Límite de caracteres en inputs de teléfono (forms maestros); la API admite hasta 64. */
export const MASTER_FORM_PHONE_MAX_CHARS = 22

/** Máx. dígitos (ITU-T E.164); el campo admite separadores dentro de `MASTER_FORM_PHONE_MAX_CHARS`. */
export const MASTER_FORM_PHONE_MAX_DIGITS = 15

export function clampStr(s: string, max: number): string {
  return s.slice(0, max)
}

/** Teléfono: solo dígitos y separadores habituales; sin letras. */
export function sanitizePhoneInput(
  raw: string,
  maxChars: number = MASTER_FORM_PHONE_MAX_CHARS,
): string {
  return raw.replace(/[^\d+().\-\s]/g, "").slice(0, maxChars)
}

/** Validación compartida de teléfono opcional en formularios de datos maestros. */
export function masterFormPhoneError(
  phone: string,
  maxChars: number = MASTER_FORM_PHONE_MAX_CHARS,
): string | undefined {
  const p = phone.trim()
  if (!p) return undefined
  if (p.length > maxChars) return `Máximo ${maxChars} caracteres.`
  if (/[a-zA-Z]/.test(p)) return "No use letras en el teléfono."
  const compact = p.replace(/[^\d]/g, "")
  if (compact.length < 7) return "Teléfono inválido: se requieren al menos 7 dígitos."
  if (compact.length > MASTER_FORM_PHONE_MAX_DIGITS) {
    return `Teléfono inválido: máximo ${MASTER_FORM_PHONE_MAX_DIGITS} dígitos.`
  }
  if (!/^[+\d()\-\s.]+$/.test(p)) {
    return "Teléfono inválido: use dígitos y separadores habituales."
  }
  return undefined
}
