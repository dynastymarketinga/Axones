"use client"

import type { ReactNode } from "react"
import { Download, Loader2 } from "lucide-react"

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

type MaterialByOtReportFiltersProps = {
  woId: string
  onWoIdChange: (id: string) => void
  loading?: boolean
  activeFilterCount?: number
  theme: ReportFiltersTheme
  onDownload: () => void
}

export function MaterialByOtReportFilters({
  woId,
  onWoIdChange,
  loading,
  activeFilterCount,
  theme,
  onDownload,
}: MaterialByOtReportFiltersProps) {
  return (
    <ReportFiltersPanel
      subtitle="Trazabilidad de inventario — despachos y devoluciones por OT"
      loading={loading}
      activeFilterCount={activeFilterCount}
      theme={theme}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-3">
        <FilterColumn title="Orden de trabajo" accentClass="text-orange-900 dark:text-orange-100" dotClass="bg-orange-500">
          <ReportWorkOrderPicker
            value={woId}
            onValueChange={onWoIdChange}
            mode="search"
            placeholder="Buscar por código OT…"
            highlighted={!!woId.trim()}
          />
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Exporta movimientos de almacén. Para controles de planilla (Kg, tintas, tiempos) use{" "}
            <strong className="text-foreground">Resumen de órdenes de trabajo</strong>.
          </p>
        </FilterColumn>

        <FilterColumn
          title="Descarga"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          showDivider
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || !woId.trim()}
            className="h-9 w-full justify-start gap-2 text-xs sm:max-w-xs lg:max-w-none"
            onClick={onDownload}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
            Descargar trazabilidad CSV
          </Button>
        </FilterColumn>
      </div>
    </ReportFiltersPanel>
  )
}
