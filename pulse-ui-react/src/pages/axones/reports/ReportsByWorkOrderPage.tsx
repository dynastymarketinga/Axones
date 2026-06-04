"use client"

import { useState } from "react"

import { Boxes } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

import { getReportIdentity } from "./ReportIdentityBanner"
import { MaterialByOtReportFilters } from "./material-by-ot-report-filters"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsByWorkOrderPage() {
  const { loading, downloadCsv } = useReportRange()
  const [woId, setWoId] = useState("")

  return (
    <ReportPageShell
      identityKey="material-ot"
      title="Material por orden de trabajo"
      description="Trazabilidad de almacén: despachos, usos de bobina y devoluciones vinculados a una OT (CSV)."
      showRange={false}
    >
      <MaterialByOtReportFilters
        woId={woId}
        onWoIdChange={setWoId}
        loading={loading}
        activeFilterCount={woId.trim() ? 1 : 0}
        theme={getReportIdentity("material-ot").theme}
        onDownload={() =>
          void downloadCsv(
            "reports/work-order-material-summary",
            `work-order-material-summary-${woId}.csv`,
            { work_order_id: Number(woId) },
          )
        }
      />

      <Card className="border-dashed border-orange-500/35 bg-orange-500/[0.04]">
        <CardContent className="flex gap-3 pt-6">
          <Boxes className="mt-0.5 h-8 w-8 shrink-0 text-orange-600" aria-hidden />
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Descarga de inventario, no de planilla</p>
            <p className="text-muted-foreground leading-relaxed">
              El CSV incluye materiales despachados por solicitud, usos de bobina en áreas y devoluciones.
              No incluye Kg de salida de producción ni tintas del módulo Tintas — para eso use{" "}
              <strong className="text-foreground">Resumen de órdenes de trabajo</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </ReportPageShell>
  )
}
