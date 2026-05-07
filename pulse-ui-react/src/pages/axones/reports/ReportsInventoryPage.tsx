"use client"

import { Button } from "@/components/ui/button"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsInventoryPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()

  return (
    <ReportPageShell
      title="Reporte de inventario"
      description="Entradas y salidas por fecha; consumo agregado cliente/producto; inventario de bobinas rechazadas."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() =>
            void downloadCsv("reports/inventory-daily", "inventory-daily.csv", {
              from,
              to,
            })
          }
        >
          Movimientos diarios (CSV)
        </Button>
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() =>
              void downloadCsv(
                "reports/consumption-by-client-product",
                "consumption-by-client-product.csv",
                { from, to },
              )
            }
          >
            Consumo por cliente y producto (CSV)
          </Button>
          <p className="text-muted-foreground max-w-xl text-xs">
            Agrega consumo de material vinculado a órdenes de trabajo en el rango
            (cliente y producto).
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() =>
            void downloadCsv("reports/rejected-bobinas", "rejected-bobinas.csv", {
              from,
              to,
            })
          }
        >
          Bobinas rechazadas (CSV)
        </Button>
      </div>
    </ReportPageShell>
  )
}
