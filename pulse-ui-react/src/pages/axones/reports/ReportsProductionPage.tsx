"use client"

import { Button } from "@/components/ui/button"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsProductionPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()

  return (
    <ReportPageShell
      title="Producción y tiempos"
      description="Tiempos por área (montaje, producción, paradas) y consumo de tintas por cliente en el período."
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
            void downloadCsv(
              "reports/production-time-by-area",
              "production-time-by-area.csv",
              { from, to },
            )
          }
        >
          Tiempos por área (CSV)
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() =>
            void downloadCsv(
              "reports/tinta-consumption-by-client",
              "tinta-consumption-by-client.csv",
              { from, to },
            )
          }
        >
          Consumo tintas por cliente (CSV)
        </Button>
      </div>
    </ReportPageShell>
  )
}
