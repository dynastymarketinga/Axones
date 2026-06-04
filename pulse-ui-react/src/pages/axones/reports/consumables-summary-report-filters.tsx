"use client"

import type { ReactNode } from "react"
import { CalendarDays, Download, Loader2 } from "lucide-react"

import { ReportEntityFilters } from "@/components/axones/reports/ReportEntityFilters"
import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogFilterDateInputClass } from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ClientRecord } from "@/types/api"

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
        showDivider && "lg:border-border lg:border-l lg:pl-4",
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

import type { ReportFiltersTheme } from "./report-identities"

type ConsumablesSummaryReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  loading?: boolean
  activeFilterCount?: number
  chips?: React.ComponentProps<typeof ReportFiltersPanel>["chips"]
  onClearAll?: () => void
  clientFilter: string
  onClientFilterChange: (v: string) => void
  clients: ClientRecord[]
  clientComboOpen: boolean
  onClientComboOpenChange: (open: boolean) => void
  selectedClientLabel: string
  downloadDisabled: boolean
  onDownload: () => void
  theme: ReportFiltersTheme
}

export function ConsumablesSummaryReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  loading,
  activeFilterCount,
  chips,
  onClearAll,
  clientFilter,
  onClientFilterChange,
  clients,
  clientComboOpen,
  onClientComboOpenChange,
  selectedClientLabel,
  downloadDisabled,
  onDownload,
  theme,
}: ConsumablesSummaryReportFiltersProps) {
  return (
    <ReportFiltersPanel
      subtitle="Período, cliente y exportación de insumos"
      loading={loading}
      activeFilterCount={activeFilterCount}
      chips={chips}
      onClearAll={onClearAll}
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-3">
        <FilterColumn
          title="Período"
          accentClass="text-sky-800 dark:text-sky-200"
          dotClass="bg-sky-500"
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
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
          title="Cliente"
          accentClass="text-violet-800 dark:text-violet-200"
          dotClass="bg-violet-500"
          showDivider
        >
          <ReportEntityFilters
            embedded
            hideProduct
            clientFilter={clientFilter}
            onClientFilterChange={onClientFilterChange}
            productFilter="all"
            onProductFilterChange={() => {}}
            clients={clients}
            products={[]}
            clientComboOpen={clientComboOpen}
            onClientComboOpenChange={onClientComboOpenChange}
            productComboOpen={false}
            onProductComboOpenChange={() => {}}
            selectedClientLabel={selectedClientLabel}
            selectedProductLabel="—"
          />
        </FilterColumn>

        <FilterColumn
          title="Descarga"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
          className="sm:col-span-2 lg:col-span-1"
        >
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloadDisabled}
              className="h-9 w-full justify-start gap-2 text-xs sm:max-w-xs lg:max-w-none"
              onClick={onDownload}
            >
              {downloadDisabled ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              )}
              Descargar resumen CSV
            </Button>
            <p className="text-muted-foreground text-[10px] leading-relaxed">
              Tintas, químicos de laminación y entradas de material por OT y totales del período.
            </p>
          </div>
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}
