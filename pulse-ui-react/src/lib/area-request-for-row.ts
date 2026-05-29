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

function latestAreaRequest(reqs: AreaRequestLite[]): AreaRequestLite | null {
  if (reqs.length === 0) return null
  return [...reqs].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })[0] ?? null
}

/** Badge de solicitud al área según la solicitud de coordinación más reciente. */
export function resolveAreaRequestStatusForTab(
  row: WorkOrderListRow,
  tab: AreaBandejaTabMode,
): string | null {
  const reqs = areaRequestsFromRow(row)
  if (reqs.length === 0) {
    return tab === "activas" ? "pending" : null
  }
  const pending = reqs.find((r) => r.status === "pending")
  if (tab === "activas") {
    return pending?.status ?? latestAreaRequest(reqs)?.status ?? "pending"
  }
  if (pending) {
    return null
  }
  return latestAreaRequest(reqs)?.status ?? null
}

export function areaRequestCreatedAtFromRow(row: WorkOrderListRow): string | null {
  const reqs = areaRequestsFromRow(row)
  if (!reqs.length) return null
  const pending = reqs.find((r) => r.status === "pending")
  const pick = pending ?? latestAreaRequest(reqs)
  return pick?.created_at ?? null
}
