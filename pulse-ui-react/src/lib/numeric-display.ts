/**
 * Muestra números sin ceros decimales innecesarios.
 * Evita confusión tipo 20.000 (veinte mil) o 1.000 (mil) en pantallas en español.
 */
export function formatPlainNumberDisplay(
  value: string | number | null | undefined,
  maxFractionDigits = 3,
): string {
  const raw = String(value ?? "").trim()
  if (!raw) return ""
  const n = Number(raw.replace(",", "."))
  if (!Number.isFinite(n)) return raw
  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.round(n))
  }
  const fixed = n.toFixed(maxFractionDigits)
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

/** Cantidades de inventario / kg / unidades en UI (misma regla que dimensiones). */
export function formatQuantityDisplay(
  value: string | number | null | undefined,
  maxFractionDigits = 3,
): string {
  return formatPlainNumberDisplay(value, maxFractionDigits)
}

/** Cantidades en UI tintas / inventario (es-VE): sin ceros de relleno y coma decimal. */
export function formatQuantityDisplayEs(
  value: string | number | null | undefined,
  maxFractionDigits = 3,
): string {
  const formatted = formatPlainNumberDisplay(value, maxFractionDigits)
  if (!formatted) return ""
  return formatted.replace(".", ",")
}
