import { useEffect, useState } from "react"

import { COR_ROLLOS_PER_PALETA } from "@/pages/axones/corte-turnos"

/** Rollos visibles por página (2 columnas en tarjeta ancha; 1 columna en pantallas estrechas). */
export function resolveCortePaletaRolloPageSize(width: number): number {
  if (width >= 420) return 8
  return 6
}

export function cortePaletaRolloTotalPages(pageSize: number): number {
  return Math.ceil(COR_ROLLOS_PER_PALETA / pageSize)
}

export function clampCortePaletaRolloPage(page: number, pageSize: number): number {
  return Math.min(Math.max(1, page), cortePaletaRolloTotalPages(pageSize))
}

export function useCortePaletaRolloPageSize(): number {
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" ? resolveCortePaletaRolloPageSize(window.innerWidth) : 8,
  )

  useEffect(() => {
    const update = () => setPageSize(resolveCortePaletaRolloPageSize(window.innerWidth))
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return pageSize
}
