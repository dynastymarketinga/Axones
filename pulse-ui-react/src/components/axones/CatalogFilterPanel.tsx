"use client"

import type { ReactNode } from "react"

import { catalogMasterFilterPanelClass } from "@/components/axones/catalog-list-classes"
import { cn } from "@/lib/utils"

type CatalogFilterPanelProps = {
  children: ReactNode
  className?: string
  hint?: ReactNode
}

export function CatalogFilterPanel({ children, className, hint }: CatalogFilterPanelProps) {
  return (
    <div className={cn(catalogMasterFilterPanelClass, className)}>
      {children}
      {hint ? <div className="mt-3 border-t border-primary/10 pt-3">{hint}</div> : null}
    </div>
  )
}
