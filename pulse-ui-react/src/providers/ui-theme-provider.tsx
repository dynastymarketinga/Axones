import { useEffect } from "react"

/** Clases de paletas antiguas (ya no se usan en UI). */
const LEGACY_PALETTE_CLASSES = ["dark-blue", "gaussian-black", "semi-dark"]

const UI_THEME_STORAGE_KEY = "ui-theme"

/**
 * Aplica siempre la paleta **classic-light** en `<html>` (la que define variables en `index.css`).
 * No depende de localStorage: se limpia la clave antigua `ui-theme` por compatibilidad.
 * Claro/oscuro lo sigue manejando `next-themes` (`light` / `dark` en la misma etiqueta).
 */
export default function UIThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    try {
      localStorage.removeItem(UI_THEME_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    const html = document.documentElement
    LEGACY_PALETTE_CLASSES.forEach((c) => html.classList.remove(c))
    if (!html.classList.contains("classic-light")) {
      html.classList.add("classic-light")
    }
  }, [])

  return <>{children}</>
}
