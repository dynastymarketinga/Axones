/** Prefijo de ruta de la SPA (`/axones` en dev, vacío en build de producción). */
export function appBaseUrlPath(): string {
  const base = import.meta.env.BASE_URL || "/"
  if (base === "/" || base === "") return ""
  return base.replace(/\/$/, "")
}

/** URL absoluta a una ruta de la app (p. ej. `/ordenes-trabajo/1`). */
export function appAbsoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  const prefix = appBaseUrlPath()
  return `${window.location.origin}${prefix}${normalized}`
}

/** Basename para React Router (undefined = raíz `/`). */
export function appRouterBasename(): string | undefined {
  const base = appBaseUrlPath()
  return base === "" ? undefined : base
}
