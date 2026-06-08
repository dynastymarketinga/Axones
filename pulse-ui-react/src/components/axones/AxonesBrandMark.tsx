import * as React from "react"

import { cn } from "@/lib/utils"

/** Logo completo (`public/brand/axones-logo-2026.svg`). */
const LOGO_FULL_SRC = `${import.meta.env.BASE_URL}brand/axones-logo-2026.svg`
/** Icono diamante (`public/brand/logo-axones-var-01.png`). */
const LOGO_ICON_SRC = `${import.meta.env.BASE_URL}brand/logo-axones-var-01.png`

export function AxonesBrandMark({
  className,
  imgClassName,
  fill = false,
  variant = "full",
}: {
  className?: string
  imgClassName?: string
  /** Ocupa todo el contenedor padre (p. ej. tarjeta de login). */
  fill?: boolean
  /** `icon`: diamante solo (auth); `full`: logo con texto (sidebar, impresión). */
  variant?: "icon" | "full"
}) {
  const src = variant === "icon" ? LOGO_ICON_SRC : LOGO_FULL_SRC

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-transparent",
        fill ? "size-full min-h-0 min-w-0" : "size-12 shrink-0",
        className,
      )}
    >
      <img
        src={src}
        alt="Logo Axones"
        className={cn(
          fill
            ? "size-full max-h-full object-contain object-center"
            : "h-full w-full max-h-12 object-contain object-center",
          variant === "icon" && fill && "max-w-[72%]",
          imgClassName,
        )}
        loading="eager"
        decoding="async"
      />
    </div>
  )
}
