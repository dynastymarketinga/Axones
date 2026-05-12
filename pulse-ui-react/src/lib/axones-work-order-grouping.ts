import type { WorkOrderListRow } from "@/types/api"

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

/** Valor crudo de pedidoKg en el formulario técnico (misma lógica que el listado OT). */
export function pedidoKgRaw(row: WorkOrderListRow): string | number | null {
  const doc = row.technical_document?.form
  if (!doc) return null
  const v = doc.pedidoKg
  if (typeof v === "number") return v
  if (typeof v === "string" && v.trim()) return v.trim()
  return null
}

/**
 * Intenta obtener un número para sumar Kg en cabeceras de grupo.
 * Acepta número en JSON; cadenas con coma decimal; cadenas tipo 1.234,56 (miles con punto).
 */
export function parsePedidoKgNumber(row: WorkOrderListRow): number | null {
  const raw = pedidoKgRaw(row)
  if (raw === null) return null
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  const t = readString(raw).replace(/\s/g, "")
  if (!t) return null
  if (t.includes(",") && t.includes(".")) {
    const n = Number.parseFloat(t.replace(/\./g, "").replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  if (t.includes(",")) {
    const n = Number.parseFloat(t.replace(",", "."))
    return Number.isFinite(n) ? n : null
  }
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** Clave de agrupación: mismo pedido cliente y mismo producto del catálogo. */
export function groupKey(row: WorkOrderListRow): string {
  const cid = row.client_order?.id
  const pid = row.product?.id
  if (cid != null && pid != null && Number.isFinite(cid) && Number.isFinite(pid) && cid > 0 && pid > 0) {
    return `co:${cid}:p:${pid}`
  }
  return `solo:${row.id}`
}

export type WorkOrderHubGroup = {
  key: string
  rows: WorkOrderListRow[]
}

function rowSortKey(row: WorkOrderListRow): number {
  const t = row.created_at ? new Date(row.created_at).getTime() : NaN
  if (Number.isFinite(t)) return t
  return row.id
}

/** Ordena por más reciente primero y agrupa por OC+producto. */
export function groupWorkOrdersForHub(rows: WorkOrderListRow[]): WorkOrderHubGroup[] {
  const sorted = [...rows].sort((a, b) => rowSortKey(b) - rowSortKey(a))
  const map = new Map<string, WorkOrderListRow[]>()
  for (const row of sorted) {
    const k = groupKey(row)
    const list = map.get(k) ?? []
    list.push(row)
    map.set(k, list)
  }
  const keys: string[] = []
  for (const row of sorted) {
    const k = groupKey(row)
    if (!keys.includes(k)) keys.push(k)
  }
  return keys.map((key) => ({ key, rows: map.get(key) ?? [] }))
}

/** Suma de Kg pedido para fila de grupo; "—" si no hay ningún valor numérico. */
export function sumPedidoKgDisplay(rows: WorkOrderListRow[]): string {
  let sum = 0
  let any = false
  for (const r of rows) {
    const n = parsePedidoKgNumber(r)
    if (n != null) {
      sum += n
      any = true
    }
  }
  if (!any) return "—"
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(sum)
}

/** OT más reciente del grupo (primera fila tras ordenar por fecha/id). */
export function latestRowInGroup(rows: WorkOrderListRow[]): WorkOrderListRow {
  return [...rows].sort((a, b) => rowSortKey(b) - rowSortKey(a))[0]!
}
