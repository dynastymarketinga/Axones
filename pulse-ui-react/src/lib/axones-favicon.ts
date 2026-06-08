/** Favicon cuadrado (diamante) generado desde logo-axones-var-01.png. */
export const AXONES_FAVICON_PATH = "brand/pwa-192.png"

/** Asegura favicon con la ruta correcta (`/axones/brand/...` en dev). */
export function ensureAxonesFavicon(): void {
  if (typeof document === "undefined") return

  const href = `${import.meta.env.BASE_URL}${AXONES_FAVICON_PATH}`

  for (const rel of ["icon", "shortcut icon"] as const) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!link) {
      link = document.createElement("link")
      link.rel = rel
      document.head.appendChild(link)
    }
    link.type = "image/png"
    link.href = href
  }
}
