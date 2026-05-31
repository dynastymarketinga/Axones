import { parsePoLineItemType, type PoItemType } from "@/pages/axones/purchase-order-shared"

export type PoLineDraft = {
  description: string
  material_id: string
  item_type: PoItemType
  micras: string
  ancho_mm: string
  quantity_ordered: string
  unit: string
}

export type PoLineEditDraft = PoLineDraft & {
  line_id?: number
  quantity_received?: number
}

export const PO_LINE_UNITS = ["kg", "unidad", "m", "rollo", "otros"] as const
export type PoLineUnit = (typeof PO_LINE_UNITS)[number]

export const PO_LINES_PAGE_SIZE = 8

export function isPoLineUnit(u: string): u is PoLineUnit {
  return (PO_LINE_UNITS as readonly string[]).includes(u)
}

export function parseDecimalInput(raw: string): number {
  const t = raw.trim().replace(/\s+/g, "").replace(",", ".")
  if (!t) return Number.NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : Number.NaN
}

export function sanitizePositiveDecimalInput(raw: string, maxFracDigits: number): string {
  let out = ""
  let hasSep = false
  let fracCount = 0
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (hasSep) {
        if (fracCount >= maxFracDigits) continue
        fracCount++
      }
      out += ch
      continue
    }
    if ((ch === "." || ch === ",") && !hasSep) {
      hasSep = true
      out += "."
    }
  }
  return out
}

export const emptyLine = (): PoLineEditDraft => ({
  description: "",
  material_id: "",
  item_type: "sustrato",
  micras: "",
  ancho_mm: "",
  quantity_ordered: "",
  unit: "kg",
})

export function shouldShowDims(itemType: PoItemType) {
  return itemType === "sustrato"
}

export function normalizeLineByBusinessRules(line: PoLineEditDraft): PoLineEditDraft {
  if (shouldShowDims(line.item_type)) return line
  return { ...line, micras: "", ancho_mm: "" }
}

export function isPoLineSubmitReady(line: PoLineDraft): boolean {
  const qty = parseDecimalInput(line.quantity_ordered)
  const unit = line.unit.trim() || "kg"
  return (
    line.description.trim().length > 0 &&
    Number.isFinite(qty) &&
    qty >= 0.001 &&
    isPoLineUnit(unit)
  )
}

export function buildLineDescription(line: PoLineDraft): string {
  const base = line.description.trim()
  const micras = line.micras.trim()
  const ancho = line.ancho_mm.trim()
  const parts: string[] = []
  if (base) parts.push(base)
  parts.push(`Tipo: ${line.item_type}`)
  if (shouldShowDims(line.item_type)) {
    if (micras) parts.push(`Micras: ${micras}`)
    if (ancho) parts.push(`Ancho(mm): ${ancho}`)
  }
  return parts.join(" | ").trim()
}

function parseDescriptionField(description: string | null | undefined): {
  label: string
  micras: string
  ancho_mm: string
} {
  const desc = (description ?? "").trim()
  if (!desc) return { label: "", micras: "", ancho_mm: "" }

  const parts = desc.split("|").map((p) => p.trim())
  let label = parts[0] ?? ""
  let micras = ""
  let ancho_mm = ""

  for (const part of parts.slice(1)) {
    const micrasMatch = /^Micras:\s*(.+)$/i.exec(part)
    const anchoMatch = /^Ancho\(mm\):\s*(.+)$/i.exec(part)
    if (micrasMatch) micras = micrasMatch[1].trim()
    if (anchoMatch) ancho_mm = anchoMatch[1].trim()
  }

  if (/^Tipo:/i.test(label)) label = ""

  return { label, micras, ancho_mm }
}

export function apiLineToDraft(line: {
  id?: number
  description?: string | null
  material_id?: number | null
  quantity_ordered: string | number
  quantity_received?: string | number
  unit?: string | null
  material?: { name?: string | null } | null
}): PoLineEditDraft {
  const item_type = parsePoLineItemType(line.description)
  const parsed = parseDescriptionField(line.description)
  const qtyReceived = Number(line.quantity_received ?? 0)

  return normalizeLineByBusinessRules({
    line_id: line.id,
    quantity_received: Number.isFinite(qtyReceived) ? qtyReceived : 0,
    description: parsed.label || line.material?.name?.trim() || "",
    material_id: line.material_id ? String(line.material_id) : "",
    item_type,
    micras: parsed.micras,
    ancho_mm: parsed.ancho_mm,
    quantity_ordered: String(line.quantity_ordered ?? ""),
    unit: line.unit?.trim() || "kg",
  })
}

export function buildLinesPayload(lines: PoLineEditDraft[]) {
  return lines.filter(isPoLineSubmitReady).map((line) => {
    const materialId = Number(line.material_id)
    return {
      ...(line.line_id ? { id: line.line_id } : {}),
      description: buildLineDescription(line),
      quantity_ordered: parseDecimalInput(line.quantity_ordered),
      unit: line.unit.trim() || "kg",
      ...(Number.isFinite(materialId) && materialId > 0 ? { material_id: materialId } : {}),
    }
  })
}

export function serializeLinesSnapshot(lines: PoLineEditDraft[]): string {
  return JSON.stringify(buildLinesPayload(lines))
}

export function lineHasAnyValue(line: PoLineDraft): boolean {
  return (
    line.description.trim().length > 0 ||
    line.material_id.trim().length > 0 ||
    line.micras.trim().length > 0 ||
    line.ancho_mm.trim().length > 0 ||
    line.quantity_ordered.trim().length > 0
  )
}
