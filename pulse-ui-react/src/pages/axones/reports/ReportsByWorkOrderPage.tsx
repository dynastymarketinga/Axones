"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsByWorkOrderPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const [woId, setWoId] = useState("")

  return (
    <ReportPageShell
      title="Reporte por orden de trabajo"
      description="Resumen de material, despachos y usos por bobina vinculados a una OT (movimiento de orden §9)."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      showRange={false}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label>Orden de trabajo (ID)</Label>
          <Input
            inputMode="numeric"
            value={woId}
            onChange={(ev) => setWoId(ev.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !woId.trim()}
          onClick={() =>
            void downloadCsv(
              "reports/work-order-material-summary",
              `work-order-material-summary-${woId}.csv`,
              { work_order_id: Number(woId) },
            )
          }
        >
          Resumen OT (CSV)
        </Button>
      </div>
    </ReportPageShell>
  )
}
