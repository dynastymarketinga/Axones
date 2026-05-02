const seen = new Map<number, number>()

/** Evita toasts duplicados (p. ej. dos suscriptores o StrictMode). */
export function markAlertToastOnce(id: number, ttlMs = 120_000): boolean {
  const now = Date.now()
  for (const [k, t] of seen) {
    if (now - t > ttlMs) seen.delete(k)
  }
  if (seen.has(id)) return false
  seen.set(id, now)
  return true
}
