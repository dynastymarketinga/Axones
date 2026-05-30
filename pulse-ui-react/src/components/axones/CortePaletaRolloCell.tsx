"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  cortePaletaRolloCellClass,
  cortePaletaRolloNumberClass,
  type CortePaletaTheme,
} from "@/pages/axones/corte-paleta-rollos-ui"

type Props = {
  rolloNumber: number
  compact?: boolean
  theme?: CortePaletaTheme
  className?: string
  children: ReactNode
}

/** Celda de un rollo en paleta; deja espacio para campos extra (kg y más). */
export function CortePaletaRolloCell({ rolloNumber, compact, theme, className, children }: Props) {
  return (
    <div className={cn(cortePaletaRolloCellClass(compact, theme), className)}>
      <span className={cortePaletaRolloNumberClass(compact, theme)}>
        Rollo {String(rolloNumber).padStart(2, "0")}
      </span>
      {children}
    </div>
  )
}
