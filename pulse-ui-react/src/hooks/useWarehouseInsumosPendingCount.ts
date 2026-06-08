import * as React from "react"

import { apiFetch } from "@/lib/api"
import { useDebouncedWindowEvent } from "@/lib/debounced-event-listener"

const CACHE_TTL_MS = 30_000
const CACHE_KEY = "warehouse-insumos-pending-count"

type Payload = {
  count: number
  manual_pending?: number
  ot_planilla_pending?: number
}

export type WarehouseInsumosPendingBreakdown = {
  total: number
  manual: number
  otPlanilla: number
}

export function useWarehouseInsumosPendingCount() {
  const [count, setCount] = React.useState(0)
  const [breakdown, setBreakdown] = React.useState<WarehouseInsumosPendingBreakdown>({
    total: 0,
    manual: 0,
    otPlanilla: 0,
  })
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<Payload>("area-requests/warehouse-pending-count")
      const n = Number(res.count ?? 0)
      const manual = Number(res.manual_pending ?? 0)
      const otPlanilla = Number(res.ot_planilla_pending ?? 0)
      const nextBreakdown: WarehouseInsumosPendingBreakdown = {
        total: Number.isFinite(n) && n > 0 ? n : 0,
        manual: Number.isFinite(manual) && manual > 0 ? manual : 0,
        otPlanilla: Number.isFinite(otPlanilla) && otPlanilla > 0 ? otPlanilla : 0,
      }
      setCount(nextBreakdown.total)
      setBreakdown(nextBreakdown)
      try {
        sessionStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ t: Date.now(), v: nextBreakdown }),
        )
      } catch {
        // ignore
      }
    } catch {
      // Mantener último valor conocido
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let useCache = false
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number; v: WarehouseInsumosPendingBreakdown | number }
        if (parsed?.t && Date.now() - parsed.t <= CACHE_TTL_MS) {
          const v = parsed.v
          if (v && typeof v === "object") {
            setCount(v.total ?? 0)
            setBreakdown(v)
          } else {
            const n = Number(v ?? 0)
            setCount(Number.isFinite(n) && n > 0 ? n : 0)
          }
          useCache = true
        }
      }
    } catch {
      // ignore
    }
    if (!useCache) void load()
  }, [load])

  useDebouncedWindowEvent("alerts:refresh", () => {
    void load()
  })

  return { count, breakdown, loading, reload: load }
}
