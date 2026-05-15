export const MON_CLICHE_KEY = "montNumCliche"
export const MON_CILINDRO_KEY = "montNumCilindro"
export const MON_MATERIALES_KEY = "montMaterialesUsados"

export type MontajeMaterialTipo = "cinta" | "pegamento" | "solvente" | "polyester" | "otro"

export type MontajeMaterialRow = {
  tipo: MontajeMaterialTipo
  descripcion: string
  cantidad: string
  unidad: string
}

export const MONTAJE_MATERIAL_TIPOS: { value: MontajeMaterialTipo; label: string }[] = [
  { value: "cinta", label: "Cinta" },
  { value: "pegamento", label: "Pegamento" },
  { value: "solvente", label: "Solvente" },
  { value: "polyester", label: "Polyester" },
  { value: "otro", label: "Otro" },
]

export const MONTAJE_MATERIAL_UNIDADES = ["Unidad", "Metro", "Kg", "Gr", "Lt", "Ml"] as const

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function normalizeTipo(v: unknown): MontajeMaterialTipo {
  const s = readString(v).toLowerCase().trim()
  if (s === "cinta" || s === "pegamento" || s === "solvente" || s === "polyester" || s === "otro") {
    return s
  }
  return "otro"
}

export function emptyMontajeMaterialRow(): MontajeMaterialRow {
  return { tipo: "cinta", descripcion: "", cantidad: "", unidad: "Unidad" }
}

export function parseMontajeMateriales(raw: unknown): MontajeMaterialRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null
      const o = item as Record<string, unknown>
      return {
        tipo: normalizeTipo(o.tipo),
        descripcion: readString(o.descripcion),
        cantidad: readString(o.cantidad),
        unidad: readString(o.unidad) || "Unidad",
      }
    })
    .filter((r): r is MontajeMaterialRow => r !== null)
}

/** Filas con descripción o cantidad > 0 para persistir. */
export function montajeMaterialesForSave(rows: MontajeMaterialRow[]): MontajeMaterialRow[] {
  return rows.filter((r) => {
    const desc = r.descripcion.trim()
    const qty = Number(String(r.cantidad).replace(",", "."))
    return desc.length > 0 || (Number.isFinite(qty) && qty > 0)
  })
}

export function clearMontajeClicheMaterialKeys(): Record<string, unknown> {
  return {
    [MON_CLICHE_KEY]: "",
    [MON_CILINDRO_KEY]: "",
    [MON_MATERIALES_KEY]: [],
  }
}
