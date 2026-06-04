import { formatMaterialCatalogLabel } from "@/lib/purchase-receipt-material-label"
import type { MaterialRow } from "@/types/api"
import { PRINTING_REJECT_REASONS, type WarehouseRejectedEntry } from "./printing-turnos"

export function materialSpecificationsLabel(m: MaterialRow | undefined): string {
  if (!m) return ""
  return formatMaterialCatalogLabel({
    sku: m.sku,
    name: m.name,
    supplierName: m.supplier?.name ?? null,
    micras: m.micras,
    ancho: m.ancho,
    itemTypeKey: "sustrato",
  })
}

export function rejectReasonLabel(motivoId: string): string {
  const id = motivoId.trim()
  if (!id) return ""
  return PRINTING_REJECT_REASONS.find((r) => r.id === id)?.label ?? id
}

export function buildGoodReturnReason(parts: {
  motivo: string
  especificaciones?: string
  bobinaRef?: string
}): string {
  const segments: string[] = []
  const motivo = parts.motivo.trim()
  if (motivo) segments.push(`Motivo: ${motivo}`)
  const specs = parts.especificaciones?.trim()
  if (specs) segments.push(`Especificaciones: ${specs}`)
  const ref = parts.bobinaRef?.trim()
  if (ref) segments.push(`Bobina/Ref: ${ref}`)
  return segments.length ? segments.join(" · ") : ""
}

export function buildRejectedReturnReason(
  entry: WarehouseRejectedEntry,
  ctx: {
    rejectReasonLabel: string
    proveedorName?: string
    materialLabel?: string
    bobinaRef?: string
    operador?: string
  },
): string {
  const parts: string[] = []
  const kg = readKg(entry.kg)
  if (kg > 0.005) {
    parts.push(`${kg.toFixed(3)} Kg rechazados`)
  }
  const bobinas = readBobinas(entry.bobinas)
  if (bobinas > 0) {
    parts.push(`${bobinas} bobina(s)`)
  }
  if (ctx.rejectReasonLabel) parts.push(`Motivo: ${ctx.rejectReasonLabel}`)
  const proveedor = ctx.proveedorName?.trim() || entry.proveedorId.trim()
  if (proveedor) parts.push(`Proveedor: ${proveedor}`)
  const material = ctx.materialLabel?.trim() || entry.materialId.trim()
  if (material) parts.push(`Material: ${material}`)
  if (ctx.operador?.trim()) parts.push(`Operador: ${ctx.operador.trim()}`)
  if (entry.fechaBobina.trim()) parts.push(`Fecha bobina: ${entry.fechaBobina.trim()}`)
  if (entry.creadaFecha.trim()) parts.push(`Creada: ${entry.creadaFecha.trim()}`)
  if (entry.obs.trim()) parts.push(`Obs: ${entry.obs.trim()}`)
  if (ctx.bobinaRef?.trim()) parts.push(`Bobina/Ref: ${ctx.bobinaRef.trim()}`)
  return parts.join(" · ")
}

function readKg(raw: unknown): number {
  const s = String(raw ?? "").trim().replace(",", ".")
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function readBobinas(raw: unknown): number {
  const s = String(raw ?? "").trim().replace(",", ".")
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
