import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"

export function normalizeRollosKg(rollosKg?: string[] | null): string[] {
  return Array.from({ length: COR_ROLLOS_PER_PALETA }, (_, i) => {
    const raw = rollosKg?.[i]
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw > 0 ? String(raw) : ""
    }
    if (typeof raw === "string") {
      const s = raw.trim()
      if (!s) return ""
      const n = Number(s.replace(",", "."))
      return Number.isFinite(n) && n > 0 ? s : ""
    }
    return ""
  })
}

export function readRolloKg(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? value : 0
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return 0
    const n = Number(s.replace(",", "."))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return 0
}

export function countRollosWithKg(rollosKg?: string[] | null): number {
  return normalizeRollosKg(rollosKg).filter((v) => readRolloKg(v) > 0).length
}

export function sumRollosKg(rollosKg?: string[] | null): number {
  return normalizeRollosKg(rollosKg).reduce((acc, v) => acc + readRolloKg(v), 0)
}
