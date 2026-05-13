import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  title: ReactNode
  headerRight?: ReactNode
  children: ReactNode
  /** Cabecera ligeramente más clara (bloques secundarios) */
  subtle?: boolean
  bodyClassName?: string
  className?: string
}

export function MesSectionShell({
  title,
  headerRight,
  children,
  subtle,
  bodyClassName,
  className,
}: Props) {
  return (
    <section
      className={cn("mes-section", subtle && "mes-section--subtle", className)}
    >
      <div className="mes-section__header">
        <div className="mes-section__title">{title}</div>
        {headerRight ? (
          <div className="mes-section__titleExtras">{headerRight}</div>
        ) : null}
      </div>
      <div className={cn("mes-section__body", bodyClassName)}>{children}</div>
    </section>
  )
}
