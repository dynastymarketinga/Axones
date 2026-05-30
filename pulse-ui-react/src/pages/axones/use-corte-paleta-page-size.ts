import { useEffect, useState } from "react"

/** Paletas visibles por «cuadro» según ancho (2 móvil, 3 tablet, 4 escritorio). */
export function resolveCortePaletaPageSize(width: number): number {
  if (width >= 1280) return 4
  if (width >= 768) return 3
  return 2
}

export function cortePaletaTotalPages(totalPaletas: number, pageSize: number): number {
  if (totalPaletas <= 0) return 1
  return Math.ceil(totalPaletas / pageSize)
}

export function clampCortePaletaPage(page: number, totalPaletas: number, pageSize: number): number {
  return Math.min(Math.max(1, page), cortePaletaTotalPages(totalPaletas, pageSize))
}

export function useCortePaletaPageSize(): number {
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" ? resolveCortePaletaPageSize(window.innerWidth) : 4,
  )

  useEffect(() => {
    const update = () => setPageSize(resolveCortePaletaPageSize(window.innerWidth))
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return pageSize
}
