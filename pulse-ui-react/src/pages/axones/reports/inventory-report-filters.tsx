"use client"

import type { ReactNode } from "react"
import { CalendarDays, Download, Eye, FileSpreadsheet, Loader2 } from "lucide-react"

import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { CatalogLabeledField } from "@/components/axones/CatalogLabeledField"
import { catalogFilterDateInputClass } from "@/components/axones/catalog-list-classes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import type { ReportFiltersTheme } from "./report-identities"

function FilterColumn({
  title,
  accentClass,
  dotClass,
  children,
  showDivider = false,
  className,
}: {
  title: string
  accentClass: string
  dotClass: string
  children: ReactNode
  showDivider?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-2.5 sm:space-y-3",
        showDivider && "lg:border-border lg:border-l lg:pl-4",
        className,
      )}
    >
      <p className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", accentClass)}>
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} aria-hidden />
        {title}
      </p>
      {children}
    </div>
  )
}

type InventoryReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  loading?: boolean
  theme: ReportFiltersTheme
  onDownloadDaily: () => void
  onDownloadConsumption: () => void
  onDownloadRejectedCsv: () => void
  onPreviewRejectedPdf: () => void
}

export function InventoryReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  loading,
  theme,
  onDownloadDaily,
  onDownloadConsumption,
  onDownloadRejectedCsv,
  onPreviewRejectedPdf,
}: InventoryReportFiltersProps) {
  return (
    <ReportFiltersPanel
      subtitle="Período y exportaciones de almacén"
      loading={loading}
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3">
        <FilterColumn title="Período" accentClass="text-sky-800 dark:text-sky-200" dotClass="bg-sky-500">
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
          title="Exportar CSV"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
          className="sm:col-span-2 lg:col-span-1"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 justify-start gap-2 text-xs"
              onClick={onDownloadDaily}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
              Movimientos diarios
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 justify-start gap-2 text-xs"
              onClick={onDownloadConsumption}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />}
              Consumo cliente/producto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 justify-start gap-2 text-xs"
              onClick={onDownloadRejectedCsv}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
              Bobinas rechazadas CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              className="h-9 justify-start gap-2 text-xs"
              onClick={onPreviewRejectedPdf}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 text-primary" />}
              Bobinas rechazadas PDF
            </Button>
          </div>
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}
