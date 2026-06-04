"use client"

import type { ReactNode } from "react"
import { CalendarDays } from "lucide-react"

import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import type { ReportWorkOrderOption } from "@/components/axones/reports/ReportWorkOrderPicker"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogFilterDateInputClass } from "@/components/axones/catalog-list-classes"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import type { WorkOrderTimeCandidate } from "./report-shared"

import type { ReportFiltersTheme } from "./report-identities"

type ProductionTimeReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  includeLive: boolean
  onIncludeLiveChange: (checked: boolean) => void
  aggregateAll: boolean
  onAggregateAllChange: (checked: boolean) => void
  woId: string
  onWoIdChange: (id: string) => void
  candidates: WorkOrderTimeCandidate[]
  loading?: boolean
  actionsSlot: ReactNode
  theme: ReportFiltersTheme
}

function FilterColumn({
  title,
  accentClass,
  dotClass,
  children,
  className,
  showDivider = false,
}: {
  title: string
  accentClass: string
  dotClass: string
  children: ReactNode
  className?: string
  showDivider?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-2.5 sm:space-y-3",
        showDivider && "xl:border-border xl:border-l xl:pl-4",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
          accentClass,
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
        {title}
      </p>
      {children}
    </div>
  )
}

export function ProductionTimeReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  includeLive,
  onIncludeLiveChange,
  aggregateAll,
  onAggregateAllChange,
  woId,
  onWoIdChange,
  candidates,
  loading,
  actionsSlot,
  theme,
}: ProductionTimeReportFiltersProps) {
  const woPickerOptions: ReportWorkOrderOption[] = candidates.map((r) => ({
    work_order_id: r.work_order_id,
    work_order_code: r.work_order_code,
    client_name: r.client_name,
    product_name: r.product_name,
  }))

  return (
    <ReportFiltersPanel
      subtitle="Período, vista en pantalla, orden de trabajo y exportación de tiempos"
      loading={loading}
      activeFilterCount={(aggregateAll ? 1 : 0) + (woId.trim() ? 1 : 0) + (includeLive ? 1 : 0)}
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-3">
        <FilterColumn
          title="Período"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
        >
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1 xl:gap-3">
            <CatalogLabeledField label="Desde" icon={CalendarDays} className="min-w-0">
              <Input
                type="date"
                value={from}
                onChange={(ev) => onFromChange(ev.target.value)}
                className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
              />
            </CatalogLabeledField>
            <CatalogLabeledField label="Hasta" icon={CalendarDays} className="min-w-0">
              <Input
                type="date"
                value={to}
                onChange={(ev) => onToChange(ev.target.value)}
                className={cn(catalogFilterDateInputClass, "border-sky-500/30 focus-visible:ring-sky-500/25")}
              />
            </CatalogLabeledField>
          </div>
        </FilterColumn>

        <FilterColumn
          title="Vista en pantalla"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
          showDivider
        >
          <div className="flex items-start gap-2">
            <Checkbox
              id="include-live"
              className="mt-0.5"
              checked={includeLive}
              onCheckedChange={(v) => onIncludeLiveChange(v === true)}
            />
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="include-live" className="cursor-pointer text-sm font-normal leading-snug">
                Incluir turnos en curso (tiempo real)
              </Label>
              {includeLive ? (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  <strong className="text-foreground">Modo pantalla: tiempo real.</strong> Suma turnos abiertos y
                  cronómetro Montaje. Se actualiza cada 30 s. Recomendado para ver la planta <em>hoy</em>.
                </p>
              ) : (
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  <strong className="text-foreground">Modo pantalla: solo cerrados.</strong> Mismo criterio que PDF y
                  Excel. Recomendado para cuadrar cifras antes de exportar o cerrar el mes.
                </p>
              )}
              <p className="text-muted-foreground text-[10px] leading-relaxed">
                PDF y Excel <strong>siempre</strong> usan segmentos cerrados, independientemente de este toggle.
              </p>
            </div>
          </div>
        </FilterColumn>

        <FilterColumn
          title="Orden de trabajo"
          accentClass="text-amber-800 dark:text-amber-200"
          dotClass="bg-amber-500"
          showDivider
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="aggregate-all"
                checked={aggregateAll}
                onCheckedChange={(v) => onAggregateAllChange(v === true)}
              />
              <Label htmlFor="aggregate-all" className="cursor-pointer text-sm font-normal leading-snug">
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
            />
          </div>
        </FilterColumn>

        <FilterColumn
          title="Acciones"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
          className="sm:col-span-2 xl:col-span-1"
        >
          {actionsSlot}
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}
