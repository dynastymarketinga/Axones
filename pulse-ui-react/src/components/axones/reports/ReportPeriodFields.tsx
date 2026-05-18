"use client"

import { CalendarDays } from "lucide-react"

import { CatalogFilterGrid } from "@/components/axones/CatalogFilterGrid"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { catalogFilterDateInputClass } from "@/components/axones/catalog-list-classes"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ReportPeriodFieldsProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  colSpan?: 6 | 12
  className?: string
}

export function ReportPeriodFields({
  from,
  to,
  onFromChange,
  onToChange,
  colSpan = 6,
  className,
}: ReportPeriodFieldsProps) {
  const spanClass = colSpan === 12 ? "md:col-span-12" : "md:col-span-6"

  return (
    <ReportFilterSection
      title="Período"
      accentClass="text-sky-700 dark:text-sky-300"
      dotClass="bg-sky-500"
      borderClass="border-sky-500/25 from-sky-500/[0.06]"
      className={className}
    >
      <CatalogFilterGrid>
        <CatalogLabeledField label="Desde" icon={CalendarDays} className={cn("min-w-0", spanClass)}>
          <Input
            type="date"
            value={from}
            onChange={(ev) => onFromChange(ev.target.value)}
            className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
          />
        </CatalogLabeledField>
        <CatalogLabeledField label="Hasta" icon={CalendarDays} className={cn("min-w-0", spanClass)}>
          <Input
            type="date"
            value={to}
            onChange={(ev) => onToChange(ev.target.value)}
            className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
          />
        </CatalogLabeledField>
      </CatalogFilterGrid>
    </ReportFilterSection>
  )
}
