import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Tone = "neutral" | "positive" | "negative"

type Props = {
  label: string
  value: ReactNode
  tone?: Tone
  className?: string
  /** Icono pequeño (p. ej. Lucide) junto a la etiqueta */
  icon?: ReactNode
}

export function MesStatTile({ label, value, tone = "neutral", className, icon }: Props) {
  return (
    <div className={cn("mes-stat-tile", className)}>
      <span className="mes-stat-tile__label">
        {icon ? (
          <span className="mes-stat-tile__labelRow">
            <span className="mes-stat-tile__labelIcon" aria-hidden>
              {icon}
            </span>
            {label}
          </span>
        ) : (
          label
        )}
      </span>
      <div
        className={cn(
          "mes-stat-tile__value",
          tone === "positive" && "mes-stat-tile__value--positive",
          tone === "negative" && "mes-stat-tile__value--negative",
        )}
      >
        {value}
      </div>
    </div>
  )
}
