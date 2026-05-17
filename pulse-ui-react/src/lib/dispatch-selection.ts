/** Selección acumulativa de paletas cerradas (Despacho → Nota de entrega). */

export const DISPATCH_SELECTION_KEY = "axones.dispatch.selection.v1"

export type DispatchSelectionItem = {
  corte_bobina_usage_id: number
  work_order_id: number
  work_order_code?: string
  client_name?: string
  product_id: number | null
  product_name?: string
  product_cpe?: string
  description: string
  quantity_finished_kg?: string
  quantity_dispatched_kg?: string
  quantity_remaining_kg?: string
  quantity_kg: string
  pallet_code: string
  bobbin_count: number
  /** Grilla de kg por rollo (48 posiciones), desde despacho-corte. */
  rollos_kg?: string[]
}

export function readDispatchSelection(): DispatchSelectionItem[] {
  if (typeof sessionStorage === "undefined") return []
  const raw = sessionStorage.getItem(DISPATCH_SELECTION_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is DispatchSelectionItem =>
        row !== null &&
        typeof row === "object" &&
        Number((row as DispatchSelectionItem).corte_bobina_usage_id) > 0 &&
        Number((row as DispatchSelectionItem).work_order_id) > 0,
    )
  } catch {
    return []
  }
}

export function writeDispatchSelection(items: DispatchSelectionItem[]): void {
  if (typeof sessionStorage === "undefined") return
  if (!items.length) {
    sessionStorage.removeItem(DISPATCH_SELECTION_KEY)
    return
  }
  sessionStorage.setItem(DISPATCH_SELECTION_KEY, JSON.stringify(items))
}

export function clearDispatchSelection(): void {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.removeItem(DISPATCH_SELECTION_KEY)
}

/** Une por `corte_bobina_usage_id`; las entradas nuevas reemplazan datos de la misma paleta. */
export function mergeDispatchSelection(
  existing: DispatchSelectionItem[],
  incoming: DispatchSelectionItem[],
): DispatchSelectionItem[] {
  const byUsage = new Map<number, DispatchSelectionItem>()
  for (const row of existing) {
    byUsage.set(row.corte_bobina_usage_id, row)
  }
  for (const row of incoming) {
    byUsage.set(row.corte_bobina_usage_id, row)
  }
  return Array.from(byUsage.values()).sort(
    (a, b) =>
      String(a.work_order_code ?? a.work_order_id).localeCompare(
        String(b.work_order_code ?? b.work_order_id),
      ) || a.pallet_code.localeCompare(b.pallet_code),
  )
}

export function sumDispatchSelectionKg(items: DispatchSelectionItem[]): number {
  return items.reduce((acc, row) => acc + (Number(row.quantity_kg) || 0), 0)
}

export function formatDispatchKg(value: string | number | undefined): string {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return "0.000 kg"
  return `${parsed.toLocaleString("es-DO", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`
}
