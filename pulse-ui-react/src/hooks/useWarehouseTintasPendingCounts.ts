import * as React from "react"

import { apiFetch } from "@/lib/api"
import { useDebouncedWindowEvent } from "@/lib/debounced-event-listener"

const CACHE_TTL_MS = 30_000
const CACHE_KEY = "warehouse-tintas-pending-counts"

export type WarehouseTintasPendingCounts = {
  devoluciones: number
  solicitudes_area: number
  materiales: number
  bell: number
}

const EMPTY: WarehouseTintasPendingCounts = {
  devoluciones: 0,
  solicitudes_area: 0,
  materiales: 0,
  bell: 0,
}

type UseWarehouseTintasPendingCountsOptions = {
  /** Si false, no consulta el API (p. ej. roles sin menú de almacén). */
  enabled?: boolean
}

export function useWarehouseTintasPendingCounts(
  options: UseWarehouseTintasPendingCountsOptions = {},
) {
  const enabled = options.enabled !== false
  const [counts, setCounts] = React.useState<WarehouseTintasPendingCounts>(EMPTY)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<WarehouseTintasPendingCounts>("warehouse/tintas-pending-counts")
      const next: WarehouseTintasPendingCounts = {
        devoluciones: Math.max(0, Number(res.devoluciones ?? 0)),
        solicitudes_area: Math.max(0, Number(res.solicitudes_area ?? 0)),
        materiales: Math.max(0, Number(res.materiales ?? 0)),
        bell: Math.max(0, Number(res.bell ?? 0)),
      }
      setCounts(next)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), v: next }))
      } catch {
        // ignore
      }
    } catch {
      // Mantener último valor
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!enabled) return
    let useCache = false
    try {
      const raw = sessionStorage.getItem(CACHE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number; v: WarehouseTintasPendingCounts }
        if (parsed?.t && Date.now() - parsed.t <= CACHE_TTL_MS && parsed.v) {
          setCounts(parsed.v)
          useCache = true
        }
      }
    } catch {
      // ignore
    }
    if (!useCache) void load()
  }, [enabled, load])

  useDebouncedWindowEvent("alerts:refresh", () => {
    if (!enabled) return
    void load()
  })

  return { counts, loading, reload: load }
}
