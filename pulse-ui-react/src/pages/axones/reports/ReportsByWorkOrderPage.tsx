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
      <div className="bg-card space-y-3 rounded-2xl border p-4 shadow-sm">
        <p className="text-muted-foreground text-sm">
          Indique el <strong>ID numérico</strong> de la orden de trabajo tal como aparece en el sistema (ej.{" "}
          <span className="font-mono text-xs">42</span>). La descarga es un único archivo.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid min-w-[12rem] gap-2">
            <Label>Orden de trabajo (ID)</Label>
            <Input
              inputMode="numeric"
              value={woId}
              onChange={(ev) => setWoId(ev.target.value)}
              placeholder="ej. 42"
            />
            <p className="text-muted-foreground text-[11px]">
              Debe existir en la base de datos; si el ID no es válido, el servidor devolverá un error.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
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
        </div>
      </div>
    </ReportPageShell>
  )
}
