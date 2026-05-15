/** Claves permitidas en PATCH orden-trabajo/corte-control (espejo backend). */
export function isCorteControlKey(key: string): boolean {
  if (!key) return false
  if (key.startsWith("cor") || key.startsWith("cor_")) return true
  return key.includes("Corte")
}

export function filterCorteControlForm(form: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(form).filter(([k]) => isCorteControlKey(k)))
}
