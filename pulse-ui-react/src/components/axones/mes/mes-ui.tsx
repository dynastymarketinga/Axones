import type { LucideIcon } from "lucide-react"
import { CheckCircle2 } from "lucide-react"
import type { ReactNode } from "react"

export function mesSectionTitle(icon: LucideIcon, text: string) {
  const I = icon
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <I className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <span className="truncate">{text}</span>
    </span>
  )
}

/** Texto de sección junto a grupos de controles (no es etiqueta de un solo campo). */
export function fieldLegend(icon: LucideIcon, text: ReactNode) {
  const I = icon
  return (
    <div className="ot-label text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      <span className="inline-flex items-center gap-1.5">
        <I className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span>{text}</span>
      </span>
    </div>
  )
}

export function MesSectionHeaderExtras({
  isDone,
  actions,
}: {
  isDone?: boolean
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {isDone ? (
        <div className="mes-badge-done">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Completo
        </div>
      ) : null}
      {actions ?? null}
    </div>
  )
}
