import type { MaterialRow } from "@/types/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"

export type MaterialRequestDispatchLine = {
  id: number
  material_id: number | null
  description?: string | null
  unit?: string | null
  quantity_requested: string
  quantity_dispatched: string
  material?: Pick<
    MaterialRow,
    "id" | "sku" | "name" | "unit" | "inventory_area" | "quantity_on_hand"
  >
}

export type BobinaDispatchRow = {
  id: number
  code?: string | null
  status: string
  weight_kg: string | null
  material_id?: number
}

export function lineRemaining(ln: MaterialRequestDispatchLine): number {
  const req = Number(ln.quantity_requested)
  const dis = Number(ln.quantity_dispatched)
  return Math.max(0, req - dis)
}

export function stockOnHand(
  material: Pick<MaterialRow, "quantity_on_hand"> | null | undefined,
): number {
  const n = Number(material?.quantity_on_hand ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Área material con bobinas registradas: se despacha por selección de bobina. */
export function usesBobinaPicker(
  inventoryArea: string | undefined,
  bobinas: BobinaDispatchRow[],
): boolean {
  return inventoryArea === "material" && bobinas.length > 0
}

export function maxApprovableQty(
  remaining: number,
  stock: number,
  bobinaPicker: boolean,
): number {
  if (remaining <= 0) return 0
  if (bobinaPicker) return remaining
  if (stock > 0) return Math.min(remaining, stock)
  return remaining
}

export function defaultApprovalQty(
  ln: MaterialRequestDispatchLine,
  material: Pick<MaterialRow, "quantity_on_hand" | "inventory_area"> | null | undefined,
  bobinas: BobinaDispatchRow[],
): string {
  const rem = lineRemaining(ln)
  const bobinaPicker = usesBobinaPicker(material?.inventory_area, bobinas)
  const max = maxApprovableQty(rem, stockOnHand(material), bobinaPicker)
  return max > 0 ? formatQuantityDisplay(max) : ""
}

export function validateApprovalQty(
  remaining: number,
  qn: number,
  unit: string,
  stock: number,
  bobinaPicker: boolean,
  hasMaterial: boolean,
): string | null {
  if (qn > remaining + 0.0005) {
    return `No puede aprobar más de lo pendiente (${formatQuantityDisplay(remaining)} ${unit}).`
  }
  if (bobinaPicker) return null
  if (hasMaterial && stock > 0 && qn > stock + 0.0005) {
    return `Stock insuficiente: hay ${formatQuantityDisplay(stock)} ${unit} en inventario.`
  }
  return null
}

export function lineLabel(ln: MaterialRequestDispatchLine): string {
  if (ln.material) return `${ln.material.sku} · ${ln.material.name}`
  return ln.description?.trim() || "Sin catálogo"
}

export function lineUnit(ln: MaterialRequestDispatchLine): string {
  return ln.unit?.trim() || ln.material?.unit || "kg"
}

export const INVENTORY_RESOLUTION_TABS = [
  { value: "material", label: "Sustrato" },
  { value: "tintas", label: "Tintas" },
  { value: "quimicos", label: "Químicos" },
  { value: "miscelaneos", label: "Misceláneos" },
] as const

export type InventoryResolutionTab = (typeof INVENTORY_RESOLUTION_TABS)[number]["value"]
