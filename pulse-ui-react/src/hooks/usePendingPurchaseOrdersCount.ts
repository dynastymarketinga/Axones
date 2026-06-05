import * as React from "react"

import { apiFetch } from "@/lib/api"

const CACHE_TTL_MS = 30_000
const CACHE_KEY = "pending-purchase-orders-count"

type Payload = {
  count: number
}

export function usePendingPurchaseOrdersCount() {
  const [count, setCount] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<Payload>("purchase-orders/pending-receipt-count")
      const n = Number(res.count ?? 0)
      setCount(Number.isFinite(n) && n > 0 ? n : 0)
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), v: n }))
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
        const parsed = JSON.parse(raw) as { t: number; v: number }
        if (parsed?.t && Date.now() - parsed.t <= CACHE_TTL_MS) {
          const n = Number(parsed.v ?? 0)
          setCount(Number.isFinite(n) && n > 0 ? n : 0)
          useCache = true
        }
      }
    } catch {
      // ignore
    }
    if (!useCache) void load()
  }, [load])

  React.useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener("alerts:refresh", onRefresh)
    return () => window.removeEventListener("alerts:refresh", onRefresh)
  }, [load])

  return { count, loading, reload: load }
}
