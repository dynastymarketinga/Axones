"use client"

import { useState } from "react"

import { ReportFilterSection } from "@/components/axones/reports/ReportFilterSection"
import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { ReportWorkOrderPicker } from "@/components/axones/reports/ReportWorkOrderPicker"
import { Button } from "@/components/ui/button"

import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsByWorkOrderPage() {
  const { loading, downloadCsv } = useReportRange()
  const [woId, setWoId] = useState("")

  return (
    <ReportPageShell
      title="Reporte por orden de trabajo"
      description="Resumen de material, despachos y usos por bobina vinculados a una OT (movimiento de orden §9)."
      showRange={false}
    >
      <ReportFiltersPanel
        subtitle="Seleccione la orden por código; la descarga es un único archivo CSV"
        activeFilterCount={woId.trim() ? 1 : 0}
      >
        <ReportFilterSection
          title="Orden de trabajo"
          accentClass="text-amber-800 dark:text-amber-200"
          dotClass="bg-amber-500"
          borderClass="border-amber-500/30 from-amber-500/[0.07]"
        >
          <ReportWorkOrderPicker
            value={woId}
            onValueChange={setWoId}
            mode="search"
            placeholder="Buscar por código OT…"
            highlighted={!!woId.trim()}
            className="max-w-xl"
          />
          <p className="text-muted-foreground mt-2 text-xs">
            Debe existir en la base de datos. Si el código no es válido, el servidor devolverá un error.
          </p>
        </ReportFilterSection>

        <ReportFilterSection
          title="Descarga"
          accentClass="text-emerald-800 dark:text-emerald-200"
          dotClass="bg-emerald-500"
          borderClass="border-emerald-500/30 from-emerald-500/[0.07]"
        >
          <Button
            type="button"
            disabled={loading || !woId.trim()}
            onClick={() =>
              void downloadCsv(
                "reports/work-order-material-summary",
                `work-order-material-summary-${woId}.csv`,
                { work_order_id: Number(woId) },
              )
            }
          >
            Resumen OT
          </Button>
        </ReportFilterSection>
      </ReportFiltersPanel>
    </ReportPageShell>
  )
}
