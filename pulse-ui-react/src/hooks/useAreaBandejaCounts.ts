import * as React from "react"

import {
  fetchBandejaTotal,
  type MiAreaApi,
} from "@/lib/axones-area-bandeja"
import { useDebouncedWindowEvent } from "@/lib/debounced-event-listener"

export type AreaBandejaCounts = {
  counts: Record<MiAreaApi, number>
}

export const DEFAULT_BANDEJA_AREAS: MiAreaApi[] = [
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

function parseAreasKey(areasKey: string): MiAreaApi[] {
  const parsed = areasKey.split(",").filter(Boolean) as MiAreaApi[]
  return parsed.length ? parsed : DEFAULT_BANDEJA_AREAS
}

function emptyCounts(areas: MiAreaApi[]): AreaBandejaCounts {
  const counts = {} as Record<MiAreaApi, number>
  for (const a of areas) counts[a] = 0
  return { counts }
}

export function useAreaBandejaCounts(options?: { areas?: MiAreaApi[] }) {
  const areasKey = React.useMemo(() => {
    const list = options?.areas ?? DEFAULT_BANDEJA_AREAS
    return [...list].sort().join(",")
  }, [options?.areas?.join(",") ?? "__default__"])
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

  const loadInFlight = React.useRef(false)

  const load = React.useCallback(async () => {
    if (loadInFlight.current) return
    loadInFlight.current = true
    const areas = parseAreasKey(areasKey)
    setLoading(true)
    try {
      // Secuencial: php artisan serve es mono-hilo; paralelo satura y falla fetch.
      const counts = {} as Record<MiAreaApi, number>
      for (const miArea of areas) {
        counts[miArea] = await fetchBandejaTotal(miArea, "active", {})
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
      loadInFlight.current = false
    }
  }, [areasKey, key])

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

  useDebouncedWindowEvent("alerts:refresh", () => {
    void load()
  })

  const areas = parseAreasKey(areasKey)
  return {
    loading,
    data: data ?? emptyCounts(areas),
    reload: load,
  }
}
