import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type OtPlanillaInputIconProps = {
  icon: LucideIcon
  children: React.ReactNode
  /** Tabla tintas / campos bajos: icono más pequeño y menos padding */
  compact?: boolean
  /** Textareas: icono arriba */
  align?: "center" | "top"
  className?: string
}

/**
 * Icono representativo a la izquierda dentro del control (planilla OT).
 * El padding lo aplica `work-order-planilla.css` sobre input/select/textarea descendientes.
 */
export function OtPlanillaInputIcon({
  icon: Icon,
  children,
  compact,
  align = "center",
  className,
}: OtPlanillaInputIconProps) {
  return (
    <div
      className={cn(
        "ot-input-icon-wrap group/oti relative min-w-0 self-start",
        compact && "ot-input-icon-wrap--compact",
        align === "top" && "ot-input-icon-wrap--icon-top",
        className,
      )}
    >
      <Icon className="ot-input-icon" aria-hidden strokeWidth={2.25} />
      {children}
    </div>
  )
}
