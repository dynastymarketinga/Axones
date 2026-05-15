import type { WorkOrderListRow } from "@/types/api"

export type AreaBandejaTabMode = "activas" | "historial"

type AreaRequestLite = {
  status: string
  created_at?: string
}

/** API Laravel puede devolver `areaRequests` o `area_requests`. */
export function areaRequestsFromRow(row: WorkOrderListRow): AreaRequestLite[] {
  const camel = row.areaRequests
  if (Array.isArray(camel) && camel.length > 0) {
    return camel.map((r) => ({ status: r.status, created_at: r.created_at }))
  }
  const snake = (row as { area_requests?: AreaRequestLite[] }).area_requests
  if (Array.isArray(snake)) {
    return snake.map((r) => ({ status: r.status, created_at: r.created_at }))
  }
  return []
}

/** Badge de solicitud al área: en historial prioriza Hecho/Cancelado sobre Pendiente reciente. */
export function resolveAreaRequestStatusForTab(
  row: WorkOrderListRow,
  tab: AreaBandejaTabMode,
): string | null {
  const reqs = areaRequestsFromRow(row)
  if (reqs.length === 0) {
    return tab === "activas" ? "pending" : null
  }
  if (tab === "historial") {
    const done = reqs.find((r) => r.status === "done")
    if (done) return "done"
    const cancelled = reqs.find((r) => r.status === "cancelled")
    if (cancelled) return "cancelled"
    const closed = reqs.find((r) => r.status !== "pending")
    return closed?.status ?? reqs[0]?.status ?? null
  }
  const pending = reqs.find((r) => r.status === "pending")
  return pending?.status ?? reqs[0]?.status ?? "pending"
}

export function areaRequestCreatedAtFromRow(row: WorkOrderListRow): string | null {
  const reqs = areaRequestsFromRow(row)
  if (!reqs.length) return null
  const pending = reqs.find((r) => r.status === "pending")
  const done = reqs.find((r) => r.status === "done")
  const pick = pending ?? done ?? reqs[0]
  return pick?.created_at ?? null
}
