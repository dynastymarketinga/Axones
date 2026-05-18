"use client"

import { ReportDownloadActionsPanel } from "@/components/axones/reports/ReportDownloadActionsPanel"
import { ReportFiltersPanel } from "@/components/axones/reports/ReportFiltersPanel"
import { ReportPeriodFields } from "@/components/axones/reports/ReportPeriodFields"

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
      showRange={false}
    >
      <ReportFiltersPanel
        subtitle="Las descargas usan el período seleccionado"
        loading={loading}
      >
        <ReportPeriodFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <ReportDownloadActionsPanel
          intro={
            <>
              Las descargas respetan el <strong>período</strong> de arriba. Cada archivo se genera al
              instante desde el servidor.
            </>
          }
          actions={[
            {
              id: "daily",
              label: "Movimientos diarios",
              description:
                "Movimientos de inventario agrupados por día en el período seleccionado.",
              disabled: loading,
              onClick: () =>
                void downloadCsv("reports/inventory-daily", "inventory-daily.csv", { from, to }),
            },
            {
              id: "consumption",
              label: "Consumo por cliente y producto",
              description:
                "Consumo de material vinculado a órdenes de trabajo en el rango (cliente y producto).",
              disabled: loading,
              onClick: () =>
                void downloadCsv(
                  "reports/consumption-by-client-product",
                  "consumption-by-client-product.csv",
                  { from, to },
                ),
            },
            {
              id: "rejected",
              label: "Bobinas rechazadas",
              description:
                "Bobinas en estado rechazado registradas en inventario durante el período.",
              disabled: loading,
              onClick: () =>
                void downloadCsv("reports/rejected-bobinas", "rejected-bobinas.csv", { from, to }),
            },
          ]}
        />
      </ReportFiltersPanel>
    </ReportPageShell>
  )
}
