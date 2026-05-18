/** Valor canónico para polietileno en reportes y planilla de corte. */
export const SCRAP_POLIETILENO = "polietileno" as const

/** Alias histórico (typo); se normaliza al leer. */
export const SCRAP_POLIETILENO_LEGACY = "politerlero" as const

export function normalizeScrapSubstrate(value: string): string {
  const s = value.toLowerCase().trim()
  if (s === SCRAP_POLIETILENO_LEGACY) {
    return SCRAP_POLIETILENO
  }
  return s
}

export function isPolietilenoScrapSubstrate(value: string): boolean {
  const s = value.toLowerCase().trim()
  return s === SCRAP_POLIETILENO || s === SCRAP_POLIETILENO_LEGACY
}
