"use client"

import type { ReactNode } from "react"

import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { ReportPeriodFields } from "@/components/axones/reports/ReportPeriodFields"
import type { ReportWorkOrderOption } from "@/components/axones/reports/ReportWorkOrderPicker"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import type { WorkOrderTimeCandidate } from "./report-shared"

type ProductionTimeReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  aggregateAll: boolean
  onAggregateAllChange: (checked: boolean) => void
  woId: string
  onWoIdChange: (id: string) => void
  candidates: WorkOrderTimeCandidate[]
  loading?: boolean
  actionsSlot: ReactNode
}

export function ProductionTimeReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  aggregateAll,
  onAggregateAllChange,
  woId,
  onWoIdChange,
  candidates,
  loading,
  actionsSlot,
}: ProductionTimeReportFiltersProps) {
  const woPickerOptions: ReportWorkOrderOption[] = candidates.map((r) => ({
    work_order_id: r.work_order_id,
    work_order_code: r.work_order_code,
    client_name: r.client_name,
    product_name: r.product_name,
  }))

  return (
    <ReportFiltersPanel
      subtitle="Período, orden de trabajo o agregado global"
      loading={loading}
      activeFilterCount={aggregateAll ? 1 : woId.trim() ? 1 : 0}
    >
      <ReportPeriodFields from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} />

      <ReportFilterSection
        title="Orden de trabajo"
        accentClass="text-amber-800 dark:text-amber-200"
        dotClass="bg-amber-500"
        borderClass="border-amber-500/30 from-amber-500/[0.07]"
      >
        <div className="mb-4 flex items-center space-x-2">
          <Checkbox
            id="aggregate-all"
            checked={aggregateAll}
            onCheckedChange={(v) => onAggregateAllChange(v === true)}
          />
          <Label htmlFor="aggregate-all" className="cursor-pointer text-sm font-normal leading-none">
            Agregado de todas las OT del rango
          </Label>
        </div>
        <ReportWorkOrderPicker
          value={woId}
          onValueChange={onWoIdChange}
          options={woPickerOptions}
          mode="static"
          disabled={aggregateAll}
          placeholder="Seleccione en la tabla o busque por código…"
          highlighted={!aggregateAll && !!woId.trim()}
          className="max-w-xl"
        />
        <p className="text-muted-foreground mt-2 text-xs">
          Desactivado mientras el agregado global está activo. Pulse una fila de la tabla o elija aquí por código OT.
        </p>
      </ReportFilterSection>

      {actionsSlot}
    </ReportFiltersPanel>
  )
}
