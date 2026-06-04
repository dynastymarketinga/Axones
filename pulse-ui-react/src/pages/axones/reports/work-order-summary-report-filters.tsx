"use client"

import type { ReactNode } from "react"
import { Download, Eye, FileDown, Loader2 } from "lucide-react"

import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { ReportFiltersTheme } from "./report-identities"

function FilterColumn({
  title,
  accentClass,
  dotClass,
  children,
  showDivider = false,
}: {
  title: string
  accentClass: string
  dotClass: string
  children: ReactNode
  showDivider?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 space-y-2.5 sm:space-y-3",
        showDivider && "lg:border-border lg:border-l lg:pl-4",
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

type WorkOrderSummaryReportFiltersProps = {
  woId: string
  onWoIdChange: (id: string) => void
  loading?: boolean
  activeFilterCount?: number
  theme: ReportFiltersTheme
  onPreview: () => void
  onPdf: () => void
  onCsv: () => void
}

export function WorkOrderSummaryReportFilters({
  woId,
  onWoIdChange,
  loading,
  activeFilterCount,
  theme,
  onPreview,
  onPdf,
  onCsv,
}: WorkOrderSummaryReportFiltersProps) {
  const disabled = loading || !woId.trim()

  return (
    <ReportFiltersPanel
      subtitle="Elija una OT — la ficha completa aparece debajo"
      loading={loading}
      activeFilterCount={activeFilterCount}
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-3">
        <FilterColumn title="Orden de trabajo" accentClass="text-amber-900 dark:text-amber-100" dotClass="bg-amber-500">
          <ReportWorkOrderPicker
            value={woId}
            onValueChange={onWoIdChange}
            mode="search"
            placeholder="Buscar por código OT…"
            highlighted={!!woId.trim()}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Una sola OT a la vez. Para totales de planta use{" "}
            <strong className="text-foreground">Resumen de producción</strong> o{" "}
            <strong className="text-foreground">Reporte de consumible</strong>.
          </p>
        </FilterColumn>

        <FilterColumn
          title="Acciones"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
        >
          <div className="flex flex-col gap-2">
            <Button type="button" variant="default" size="sm" disabled={disabled} className="h-9 justify-start gap-2 text-xs" onClick={onPreview}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Vista previa
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-9 justify-start gap-2 text-xs" onClick={onPdf}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-primary" />}
              PDF resumen OT
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={disabled} className="h-9 justify-start gap-2 text-xs" onClick={onCsv}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
              Descargar CSV
            </Button>
          </div>
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}
