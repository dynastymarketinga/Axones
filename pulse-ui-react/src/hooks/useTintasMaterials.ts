import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"

type UseTintasMaterialsOptions = {
  /** Si false, no carga hasta que pase a true (p. ej. pestaña inventario en /tintas). */
  enabled?: boolean
}

export function useTintasMaterials(options: UseTintasMaterialsOptions = {}) {
  const enabled = options.enabled !== false
  const [tintaMaterials, setTintaMaterials] = useState<MaterialRow[]>([])
  const [invTintas, setInvTintas] = useState<MaterialRow[]>([])
  const [invCementerio, setInvCementerio] = useState<MaterialRow[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const mats = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: { per_page: 400, page: 1 },
      })
      const all = (mats.data ?? []).filter(
        (m) => m.inventory_area === "tintas" || m.inventory_area === "cementerio_tintas",
      )
      setTintaMaterials(all)
      setInvTintas(all.filter((m) => m.inventory_area === "tintas"))
      setInvCementerio(all.filter((m) => m.inventory_area === "cementerio_tintas"))
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status !== 0) toast.error(e.message)
      } else {
        toast.error("No se pudieron cargar materiales de tintas.")
      }
      setTintaMaterials([])
      setInvTintas([])
      setInvCementerio([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void reload()
  }, [enabled, reload])

  return { tintaMaterials, invTintas, invCementerio, loading, reload }
}
