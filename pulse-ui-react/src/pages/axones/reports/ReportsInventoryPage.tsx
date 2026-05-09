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
      <div className="bg-card space-y-4 rounded-2xl border p-4 shadow-sm">
        <p className="text-muted-foreground text-sm">
          Las descargas respetan el <strong>rango de fechas global</strong> de arriba. Cada archivo se genera al instante
          desde el servidor.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="flex min-w-[11rem] flex-col gap-1">
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
              Movimientos diarios
            </Button>
            <p className="text-muted-foreground max-w-xs text-xs">
              Movimientos de inventario agrupados por día en el período seleccionado.
            </p>
          </div>
          <div className="flex min-w-[11rem] flex-col gap-1">
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
              Consumo por cliente y producto
            </Button>
            <p className="text-muted-foreground max-w-xs text-xs">
              Consumo de material vinculado a órdenes de trabajo en el rango (cliente y producto).
            </p>
          </div>
          <div className="flex min-w-[11rem] flex-col gap-1">
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
              Bobinas rechazadas
            </Button>
            <p className="text-muted-foreground max-w-xs text-xs">
              Bobinas en estado rechazado registradas en inventario durante el período.
            </p>
          </div>
        </div>
      </div>
    </ReportPageShell>
  )
}
