/** Separador visual entre código, descripción y proveedor en recepciones. */
export const MATERIAL_IDENTITY_SEP = " · "

export type MaterialIdentityInput = {
  sku?: string | null
  name?: string | null
  supplierName?: string | null
}

export type OcLineReferenceInput = {
  description?: string | null
  material?: {
    sku?: string | null
    name?: string | null
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

/** Referencia de línea OC para la columna informativa. */
export function formatOcLineReference(
  pol: OcLineReferenceInput,
  poSupplierName?: string | null,
): string {
  const mat = pol.material
  const meta = parseOcLineMeta(pol.description)
  const supplierName =
    mat?.supplier?.name?.trim() ||
    poSupplierName?.trim() ||
    null

  if (mat?.sku || mat?.name) {
    return formatMaterialIdentity({
      sku: mat.sku,
      name: mat.name,
      supplierName,
    })
  }

  const codeOrDesc = meta.baseText || "Ítem solicitado"
  return formatMaterialIdentity({
    sku: codeOrDesc,
    name: null,
    supplierName,
  })
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
