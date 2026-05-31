import type { PurchaseItemTypeKey } from "@/pages/axones/purchase-item-type-meta"
import { shouldShowDimsForItemType } from "@/pages/axones/purchase-item-type-meta"

/** Separador visual entre código, descripción y proveedor en recepciones. */
export const MATERIAL_IDENTITY_SEP = " · "

export type MaterialIdentityInput = {
  sku?: string | null
  name?: string | null
  supplierName?: string | null
}

export type MaterialCatalogLabelInput = MaterialIdentityInput & {
  micras?: string | null
  ancho?: string | null
  itemTypeKey?: PurchaseItemTypeKey | null
}

export type OcLineReferenceInput = {
  description?: string | null
  quantity_ordered?: string | number | null
  quantity_received?: string | number | null
  unit?: string | null
  material?: {
    sku?: string | null
    name?: string | null
    micras?: string | null
    ancho?: string | null
    supplier?: { name?: string | null } | null
  } | null
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function formatQtyEs(value: string | number | null | undefined): string {
  const n = Number(String(value ?? "0").replace(",", "."))
  if (!Number.isFinite(n)) return "0,000"
  return n.toLocaleString("es-VE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

export function parseOcLineMeta(description: string | null | undefined): {
  itemType: string
  micras: string
  ancho_mm: string
  baseText: string
} {
  const raw = (description ?? "").trim()
  if (!raw) return { itemType: "", micras: "", ancho_mm: "", baseText: "" }
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean)
  const baseText = parts[0] ?? raw
  let itemType = ""
  let micras = ""
  let ancho_mm = ""
  for (const p of parts) {
    const [kRaw, ...rest] = p.split(":")
    const k = normalizeKey(kRaw ?? "")
    const v = rest.join(":").trim()
    if (!v) continue
    if (k === "tipo") {
      const tv = normalizeKey(v)
      if (tv === "tinta") itemType = "Tinta"
      else if (tv === "quimico" || tv === "químico") itemType = "Químico"
      else if (tv === "otros") itemType = "Misceláneo"
      else itemType = "Sustrato"
    } else if (k.startsWith("micra")) {
      micras = v
    } else if (k.startsWith("ancho")) {
      ancho_mm = v.replace(/[^\d.,]/g, "").replace(",", ".")
    }
  }
  return { itemType, micras, ancho_mm, baseText }
}

/** Etiqueta legible: código · descripción · proveedor */
export function formatMaterialIdentity(input: MaterialIdentityInput): string {
  const code = (input.sku ?? "").trim()
  const name = (input.name ?? "").trim()
  const supplier = (input.supplierName ?? "").trim()

  const segments: string[] = []
  if (code) segments.push(code)
  if (name && normalizeKey(name) !== normalizeKey(code)) segments.push(name)
  if (supplier) segments.push(supplier)
  else if (segments.length > 0) segments.push("Sin proveedor")

  return segments.join(MATERIAL_IDENTITY_SEP) || "Material sin identificar"
}

/** Línea secundaria con micras/ancho (solo sustrato). */
export function formatMaterialDimensionHint(input: MaterialCatalogLabelInput): string | null {
  const key = input.itemTypeKey ?? "sustrato"
  if (!shouldShowDimsForItemType(key)) return null
  const micras = (input.micras ?? "").trim()
  const ancho = (input.ancho ?? "").trim()
  const parts: string[] = []
  if (micras) parts.push(`${micras} µm`)
  if (ancho) parts.push(`${ancho} mm`)
  return parts.length ? parts.join(MATERIAL_IDENTITY_SEP) : null
}

/** Etiqueta de catálogo: identidad + dimensiones si es sustrato. */
export function formatMaterialCatalogLabel(input: MaterialCatalogLabelInput): string {
  const identity = formatMaterialIdentity(input)
  const dims = formatMaterialDimensionHint(input)
  return dims ? `${identity}${MATERIAL_IDENTITY_SEP}${dims}` : identity
}

/** Referencia de línea OC para la columna informativa. */
export function formatOcLineReference(
  pol: OcLineReferenceInput,
  poSupplierName?: string | null,
  itemTypeKey?: PurchaseItemTypeKey | null,
): string {
  const mat = pol.material
  const meta = parseOcLineMeta(pol.description)
  const supplierName =
    mat?.supplier?.name?.trim() ||
    poSupplierName?.trim() ||
    null

  const resolvedType: PurchaseItemTypeKey =
    itemTypeKey ??
    (meta.itemType === "Tinta"
      ? "tinta"
      : meta.itemType === "Químico"
        ? "quimico"
        : meta.itemType === "Misceláneo"
          ? "otros"
          : "sustrato")

  if (mat?.sku || mat?.name) {
    return formatMaterialCatalogLabel({
      sku: mat.sku,
      name: mat.name,
      supplierName,
      micras: mat.micras ?? meta.micras,
      ancho: mat.ancho ?? meta.ancho_mm,
      itemTypeKey: resolvedType,
    })
  }

  const codeOrDesc = meta.baseText || "Ítem solicitado"
  return formatMaterialCatalogLabel({
    sku: codeOrDesc,
    name: null,
    supplierName,
    micras: meta.micras,
    ancho: meta.ancho_mm,
    itemTypeKey: resolvedType,
  })
}

/** Avance de recepción por línea OC: Pedido · Recibido · Pendiente. */
export function formatOcLineReceiptProgress(pol: OcLineReferenceInput): string {
  const ordered = Number(pol.quantity_ordered ?? 0)
  const received = Number(pol.quantity_received ?? 0)
  const unit = (pol.unit ?? "kg").trim() || "kg"
  const pending = Math.max(0, ordered - (Number.isFinite(received) ? received : 0))
  return `Pedido ${formatQtyEs(ordered)} · Recibido ${formatQtyEs(received)} · Pendiente ${formatQtyEs(pending)} ${unit}`
}

/** Banner de OC vinculada: código · proveedor · estado */
export function formatPurchaseOrderBanner(input: {
  code?: string | null
  supplierName?: string | null
  statusLabel?: string | null
}): string {
  const segments = [
    input.code?.trim(),
    input.supplierName?.trim(),
    input.statusLabel?.trim(),
  ].filter(Boolean)
  return segments.join(MATERIAL_IDENTITY_SEP) || "Orden de compra"
}
