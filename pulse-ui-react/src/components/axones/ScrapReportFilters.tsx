"use client"

import { Barcode, Package, Users } from "lucide-react"

import { ReportEntityFilters } from "@/components/axones/reports/ReportEntityFilters"
import {
  ReportFiltersPanel,
  type ReportFilterChip,
} from "@/components/axones/reports/ReportFiltersPanel"
import { ReportPeriodFields } from "@/components/axones/reports/ReportPeriodFields"
import { ReportWorkOrderCodeField } from "@/components/axones/reports/ReportWorkOrderCodeField"
import type { ReportFiltersTheme } from "@/pages/axones/reports/report-identities"
import type { ClientRecord, ProductRecord } from "@/types/api"

type ScrapReportFiltersProps = {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  clientFilter: string
  onClientFilterChange: (v: string) => void
  productFilter: string
  onProductFilterChange: (v: string) => void
  workOrderCode: string
  onWorkOrderCodeChange: (v: string) => void
  clients: ClientRecord[]
  products: ProductRecord[]
  clientComboOpen: boolean
  onClientComboOpenChange: (open: boolean) => void
  productComboOpen: boolean
  onProductComboOpenChange: (open: boolean) => void
  selectedClientLabel: string
  selectedProductLabel: string
  listLoading?: boolean
  theme: ReportFiltersTheme
}

export function ScrapReportFilters({
  from,
  to,
  onFromChange,
  onToChange,
  clientFilter,
  onClientFilterChange,
  productFilter,
  onProductFilterChange,
  workOrderCode,
  onWorkOrderCodeChange,
  clients,
  products,
  clientComboOpen,
  onClientComboOpenChange,
  productComboOpen,
  onProductComboOpenChange,
  selectedClientLabel,
  selectedProductLabel,
  listLoading = false,
  theme,
}: ScrapReportFiltersProps) {
  const hasClient = clientFilter !== "all"
  const hasProduct = productFilter !== "all"
  const hasWo = workOrderCode.trim().length > 0
  const activeCount = [hasClient, hasProduct, hasWo].filter(Boolean).length

  const chips: ReportFilterChip[] = []
  if (hasClient) {
    chips.push({
      id: "client",
      label: selectedClientLabel,
      icon: <Users className="h-3 w-3" aria-hidden />,
      className: "border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100",
      onRemove: () => onClientFilterChange("all"),
      removeLabel: "Quitar filtro de cliente",
    })
  }
  if (hasProduct) {
    chips.push({
      id: "product",
      label: selectedProductLabel,
      icon: <Package className="h-3 w-3" aria-hidden />,
      className: "border-violet-500/35 bg-violet-500/10 text-violet-950 dark:text-violet-100",
      onRemove: () => onProductFilterChange("all"),
      removeLabel: "Quitar filtro de producto",
    })
  }
  if (hasWo) {
    chips.push({
      id: "wo",
      label: workOrderCode.trim(),
      icon: <Barcode className="h-3 w-3" aria-hidden />,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
      onRemove: () => onWorkOrderCodeChange(""),
      removeLabel: "Quitar filtro de orden",
    })
  }

  return (
    <ReportFiltersPanel
      subtitle="Fechas, cliente, producto u OT — merma por tipo de film"
      loading={listLoading}
      activeFilterCount={activeCount}
      chips={chips.length > 0 ? chips : undefined}
      theme={theme}
      onClearAll={
        activeCount > 0
          ? () => {
              onClientFilterChange("all")
              onProductFilterChange("all")
              onWorkOrderCodeChange("")
            }
          : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPeriodFields from={from} to={to} onFromChange={onFromChange} onToChange={onToChange} />
        <ReportEntityFilters
          clientFilter={clientFilter}
          onClientFilterChange={onClientFilterChange}
          productFilter={productFilter}
          onProductFilterChange={onProductFilterChange}
          clients={clients}
          products={products}
          clientComboOpen={clientComboOpen}
          onClientComboOpenChange={onClientComboOpenChange}
          productComboOpen={productComboOpen}
          onProductComboOpenChange={onProductComboOpenChange}
          selectedClientLabel={selectedClientLabel}
          selectedProductLabel={selectedProductLabel}
        />
      </div>
      <ReportWorkOrderCodeField
        id="scrap-wo-code"
        value={workOrderCode}
        onChange={onWorkOrderCodeChange}
      />
    </ReportFiltersPanel>
  )
}
