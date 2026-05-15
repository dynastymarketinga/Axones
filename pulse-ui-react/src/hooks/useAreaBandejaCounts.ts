import * as React from "react"

import {
  fetchBandejaTotal,
  type MiAreaApi,
} from "@/lib/axones-area-bandeja"

export type AreaBandejaCounts = {
  counts: Record<MiAreaApi, number>
}

const DEFAULT_AREAS: MiAreaApi[] = [
  "impresion",
  "laminacion",
  "corte",
  "tintas",
  "montaje",
]

const CACHE_TTL_MS = 30_000
const CACHE_PREFIX = "area-bandeja-counts:"

function cacheKey(areasKey: string): string {
  return `${CACHE_PREFIX}${areasKey}`
}

function emptyCounts(areas: MiAreaApi[]): AreaBandejaCounts {
  const counts = {} as Record<MiAreaApi, number>
  for (const a of areas) counts[a] = 0
  return { counts }
}

export function useAreaBandejaCounts(options?: { areas?: MiAreaApi[] }) {
  const areas = options?.areas ?? DEFAULT_AREAS
  const areasKey = React.useMemo(
    () => [...areas].sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [areas.join(",")],
  )
  const key = cacheKey(areasKey)

  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<AreaBandejaCounts | null>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { t: number; v: AreaBandejaCounts }
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
      const totals = await Promise.all(
        areas.map(async (miArea) => {
          const total = await fetchBandejaTotal(miArea, "active", {})
          return [miArea, total] as const
        }),
      )
      const counts = {} as Record<MiAreaApi, number>
      for (const [miArea, total] of totals) {
        counts[miArea] = total
      }
      const next: AreaBandejaCounts = { counts }
      setData(next)
      try {
        sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: next }))
      } catch {
        // ignore
      }
    } catch {
      // Mantener cache anterior si existía
    } finally {
      setLoading(false)
    }
  }, [areas, key])

  React.useEffect(() => {
    let hasFresh = false
    try {
      const raw = sessionStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as { t: number }
        if (parsed?.t && Date.now() - parsed.t <= CACHE_TTL_MS) {
          hasFresh = true
        }
      }
    } catch {
      // ignore
    }
    if (!hasFresh) void load()
  }, [key, load])

  React.useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener("alerts:refresh", onRefresh)
    return () => window.removeEventListener("alerts:refresh", onRefresh)
  }, [load])

  return {
    loading,
    data: data ?? emptyCounts(areas),
    reload: load,
  }
}
