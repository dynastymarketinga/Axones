/**
 * Parsea `product.structure` del maestro en capas para la planilla OT.
 * Separadores habituales: +, /, |, ; o saltos de línea.
 */

export type StructureLayers = {
  capa1: string
  capa2: string
  capa3: string
}

const LAYER_SPLIT_RE = /\s*(?:\+|\/|\||;)\s*|\r?\n/

export function parseProductStructureLayers(structure: string | null | undefined): StructureLayers {
  const raw = (structure ?? "").trim()
  if (!raw) {
    return { capa1: "", capa2: "", capa3: "" }
  }
  const parts = raw
    .split(LAYER_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    capa1: parts[0] ?? "",
    capa2: parts[1] ?? "",
    capa3: parts[2] ?? "",
  }
}

export function joinStructureLayers(layers: StructureLayers): string {
  return [layers.capa1, layers.capa2, layers.capa3].filter(Boolean).join(" + ")
}

export type TipoImpresionEstructura = "" | "superficie" | "reverso"

export function tipoImpresionFromProductPrintType(printType: unknown): TipoImpresionEstructura {
  const t = String(printType ?? "").toLowerCase()
  if (t.includes("reverso")) return "reverso"
  if (t.includes("superficie") || t.includes("superf")) return "superficie"
  return ""
}

/** Campos de formulario OT derivados de la estructura del producto. */
export function structureLayersToOtFormFields(
  structure: string | null | undefined,
  tipo: TipoImpresionEstructura,
): Record<string, string> {
  const layers = parseProductStructureLayers(structure)
  if (tipo === "reverso") {
    return {
      estructuraCapa1Rev: layers.capa1,
      estructuraCapa2Rev: layers.capa2,
      estructuraCapa3Rev: layers.capa3,
    }
  }
  if (tipo === "superficie") {
    const single = joinStructureLayers(layers) || layers.capa1
    return { estructuraCapa1: single }
  }
  return {}
}

export function countFilledTintaColors(form: Record<string, unknown>, maxPositions = 8): number {
  let n = 0
  for (let i = 1; i <= maxPositions; i += 1) {
    const v = form[`tintaColor${i}`]
    if (typeof v === "string" && v.trim() !== "") n += 1
  }
  return n
}

export function countFilledTintaColorsInRange(
  form: Record<string, unknown>,
  fromPosition: number,
  toPosition: number,
): number {
  let n = 0
  for (let i = fromPosition; i <= toPosition; i += 1) {
    const v = form[`tintaColor${i}`]
    if (typeof v === "string" && v.trim() !== "") n += 1
  }
  return n
}
