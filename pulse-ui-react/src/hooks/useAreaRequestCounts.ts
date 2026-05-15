import * as React from "react"

import { apiFetch, ApiError } from "@/lib/api"

export type AreaRequestCounts = {
  status: string
  counts: Record<string, number>
}

const CACHE_TTL_MS = 30_000

export function useAreaRequestCounts(options?: {
  status?: string
  areas?: string[]
}) {
  const status = (options?.status ?? "pending").trim() || "pending"
  const areas = options?.areas ?? ["almacen", "impresion", "laminacion", "corte", "tintas", "montaje"]
  const areasKey = React.useMemo(
    () => areas.map((a) => a.trim()).filter(Boolean).sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas.join(",")],
  )
  const cacheKey = `area-req-counts:${status}:${areasKey}`

  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<AreaRequestCounts | null>(() => {
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { t: number; v: AreaRequestCounts }
      if (!parsed?.t || !parsed?.v) return null
      if (Date.now() - parsed.t > CACHE_TTL_MS) return parsed.v
      return parsed.v
    } catch {
      return null
    }
  })

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<AreaRequestCounts>("area-requests/counts", {
        query: {
          status,
          areas: areasKey,
        },
      })
      setData(res)
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v: res }))
      } catch {
        // ignore
      }
    } catch (e) {
      // Sidebar no debe spamear errores al usuario; si falla, simplemente no mostramos badges.
      if (e instanceof ApiError) {
        // mantener cache anterior si existía
      } else {
        // mantener cache anterior si existía
      }
    } finally {
      setLoading(false)
    }
  }, [areasKey, cacheKey, status])

  React.useEffect(() => {
    // Si hay cache fresca, no hacemos fetch inmediato.
    let hasFresh = false
    try {
      const raw = sessionStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number }
        if (parsed?.t && Date.now() - parsed.t <= CACHE_TTL_MS) {
          hasFresh = true
        }
      }
    } catch {
      // ignore
    }
    if (hasFresh) return
    void load()
  }, [load])

  return { loading, data, reload: load }
}

