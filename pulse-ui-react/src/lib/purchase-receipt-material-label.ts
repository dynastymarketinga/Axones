import { formatPlainNumberDisplay, formatQuantityDisplay } from "@/lib/numeric-display"
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
  return formatQuantityDisplay(value) || "0"
}

/** Micras / ancho para inputs y etiquetas (20.000 → "20"). */
export function formatMaterialDimensionDisplay(
  value: string | number | null | undefined,
): string {
  return formatPlainNumberDisplay(value)
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
  const micras = formatMaterialDimensionDisplay(input.micras)
  const ancho = formatMaterialDimensionDisplay(input.ancho)
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

export type PurchaseOrderOptionLabelInput = {
  code?: string | null
  supplierName?: string | null
  statusLabel?: string | null
  linesCount?: number | null
  receiptProgressLabel?: string | null
  receiptsCount?: number | null
}

/** Línea principal del selector de OC: código · proveedor. */
export function formatPurchaseOrderOptionPrimary(input: PurchaseOrderOptionLabelInput): string {
  const code = (input.code ?? "").trim()
  const supplier = (input.supplierName ?? "").trim()
  if (code && supplier) return `${code}${MATERIAL_IDENTITY_SEP}${supplier}`
  return code || supplier || "Orden de compra"
}

/** Línea secundaria: estado · avance · artículos · recepciones previas. */
export function formatPurchaseOrderOptionSecondary(input: PurchaseOrderOptionLabelInput): string {
  const parts: string[] = []
  const status = (input.statusLabel ?? "").trim()
  if (status) parts.push(status)
  const progress = (input.receiptProgressLabel ?? "").trim()
  if (progress) parts.push(progress)
  const linesCount = input.linesCount
  if (linesCount != null && linesCount > 0) {
    parts.push(linesCount === 1 ? "1 artículo" : `${linesCount} artículos`)
  }
  const receiptsCount = input.receiptsCount
  if (receiptsCount != null && receiptsCount > 0) {
    parts.push(receiptsCount === 1 ? "1 recepción" : `${receiptsCount} recepciones`)
  }
  return parts.join(MATERIAL_IDENTITY_SEP)
}

/** Etiquetas del botón seleccionado: principal incluye estado; secundaria omite estado. */
export function formatPurchaseOrderSelectorLabels(input: PurchaseOrderOptionLabelInput): {
  primary: string
  secondary: string | null
  title: string
} {
  const status = (input.statusLabel ?? "").trim()
  const primaryBase = formatPurchaseOrderOptionPrimary(input)
  const primary = status ? `${primaryBase}${MATERIAL_IDENTITY_SEP}${status}` : primaryBase

  const secondaryParts: string[] = []
  const progress = (input.receiptProgressLabel ?? "").trim()
  if (progress) secondaryParts.push(progress)
  const linesCount = input.linesCount
  if (linesCount != null && linesCount > 0) {
    secondaryParts.push(linesCount === 1 ? "1 artículo" : `${linesCount} artículos`)
  }
  const receiptsCount = input.receiptsCount
  if (receiptsCount != null && receiptsCount > 0) {
    secondaryParts.push(receiptsCount === 1 ? "1 recepción" : `${receiptsCount} recepciones`)
  }
  const secondary = secondaryParts.length ? secondaryParts.join(MATERIAL_IDENTITY_SEP) : null

  return {
    primary,
    secondary,
    title: secondary ? `${primary}${MATERIAL_IDENTITY_SEP}${secondary}` : primary,
  }
}

/** Texto de búsqueda para el combobox de OC. */
export function purchaseOrderOptionSearchValue(input: PurchaseOrderOptionLabelInput): string {
  return [
    input.code,
    input.supplierName,
    input.statusLabel,
    input.receiptProgressLabel,
    input.linesCount != null ? String(input.linesCount) : null,
    input.receiptsCount != null ? String(input.receiptsCount) : null,
    formatPurchaseOrderOptionPrimary(input),
    formatPurchaseOrderOptionSecondary(input),
  ]
    .filter(Boolean)
    .join(" ")
}
