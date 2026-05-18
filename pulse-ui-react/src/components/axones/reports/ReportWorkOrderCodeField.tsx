"use client"

import { Barcode, Search } from "lucide-react"

import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { catalogSearchInputClass } from "@/components/axones/catalog-list-classes"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ReportWorkOrderCodeFieldProps = {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ReportWorkOrderCodeField({
  id = "report-wo-code",
  value,
  onChange,
  placeholder = "Ej. OT-001",
  disabled = false,
  className,
}: ReportWorkOrderCodeFieldProps) {
  const hasWo = value.trim().length > 0

  return (
    <ReportFilterSection
      title="Orden de trabajo"
      accentClass="text-amber-800 dark:text-amber-200"
      dotClass="bg-amber-500"
      borderClass="border-amber-500/30 from-amber-500/[0.07]"
      className={className}
    >
      <CatalogLabeledField label="Código OT" icon={Barcode} className="min-w-0 max-w-xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-700/70 dark:text-amber-300/80"
            aria-hidden
          />
          <Input
            id={id}
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            className={cn(
              catalogSearchInputClass,
              "border-amber-500/35 pl-9 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20",
              hasWo && "border-amber-500/50 bg-amber-500/[0.06]",
            )}
            onChange={(ev) => onChange(ev.target.value)}
          />
        </div>
      </CatalogLabeledField>
    </ReportFilterSection>
  )
}
