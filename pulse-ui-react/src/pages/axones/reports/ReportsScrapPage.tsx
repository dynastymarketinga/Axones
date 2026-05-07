"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsScrapPage() {
  const { from, setFrom, to, setTo, loading, downloadCsv } = useReportRange()
  const [clientId, setClientId] = useState("")
  const [productId, setProductId] = useState("")

  return (
    <ReportPageShell
      title="Mermas"
      description="Desperdicio filtrable por fechas y opcionalmente cliente/producto."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label>Cliente (ID opcional)</Label>
          <Input
            inputMode="numeric"
            value={clientId}
            onChange={(ev) => setClientId(ev.target.value)}
            placeholder="opcional"
          />
        </div>
        <div className="grid gap-2">
          <Label>Producto (ID opcional)</Label>
          <Input
            inputMode="numeric"
            value={productId}
            onChange={(ev) => setProductId(ev.target.value)}
            placeholder="opcional"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() =>
            void downloadCsv("reports/scrap-by-filters", "scrap-by-filters.csv", {
              from,
              to,
              client_id: clientId.trim() ? Number(clientId) : undefined,
              product_id: productId.trim() ? Number(productId) : undefined,
            })
          }
        >
          Mermas (CSV)
        </Button>
      </div>
    </ReportPageShell>
  )
}
