"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Construction } from "lucide-react"

import { CatalogEmptyState } from "@/components/axones/CatalogEmptyState"
import { CatalogPageShell } from "@/components/axones/CatalogPageShell"
import { catalogMasterFormPanelClass } from "@/components/axones/catalog-list-classes"

type AxonesModuleComingSoonProps = {
  title: string
  subtitle: string
  icon: LucideIcon
  message?: string
  action?: ReactNode
}

export function AxonesModuleComingSoon({
  title,
  subtitle,
  icon,
  message = "Este módulo estará disponible próximamente.",
  action,
}: AxonesModuleComingSoonProps) {
  return (
    <CatalogPageShell
      title={title}
      subtitle={subtitle}
      icon={icon}
      headerVariant="elevated"
      action={action}
    >
      <div className={catalogMasterFormPanelClass}>
        <CatalogEmptyState icon={Construction} title="Próximamente" description={message} />
      </div>
    </CatalogPageShell>
  )
}
