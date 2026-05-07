"use client"

import { useState } from "react"
import { toast } from "sonner"

import {
  apiDownloadFile,
  ApiError,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ReportPageShell, useReportRange } from "./report-shared"

export default function ReportsTimesPage() {
  const { from, setFrom, to, setTo, loading, setLoading } = useReportRange()
  const [woId, setWoId] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)

  async function loadPreview() {
    setLoadingPreview(true)
    try {
      const trimmed = woId.trim()
      const query: Record<string, string | number> = { from, to }
      if (trimmed) query.work_order_id = Number(trimmed)
      const url = buildApiUrl("reports/work-order-time-report/preview", query)
      const res = await fetch(url, { headers: authHeadersDownload() })
      if (!res.ok) {
        if (res.status === 401) {
          throw new ApiError("Sesión expirada o no autorizada.", 401, {})
        }
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
      }
      setPreviewHtml(await res.text())
      toast.success("Vista previa actualizada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar la vista previa.")
    } finally {
      setLoadingPreview(false)
    }
  }

  async function downloadPdf() {
    setLoading(true)
    try {
      const trimmed = woId.trim()
      const query: Record<string, string | number> = { from, to }
      if (trimmed) query.work_order_id = Number(trimmed)
      const tag = trimmed ? `ot-${trimmed}` : `${from}-${to}`
      await apiDownloadFile("reports/work-order-time-report.pdf", {
        query,
        fallbackName: `reporte-tiempos-${tag}.pdf`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    } finally {
      setLoading(false)
    }
  }

  async function downloadCsvFile() {
    setLoading(true)
    try {
      const trimmed = woId.trim()
      const query: Record<string, string | number> = { from, to, format: "csv" }
      if (trimmed) query.work_order_id = Number(trimmed)
      const tag = trimmed ? `ot-${trimmed}` : `${from}-${to}`
      await apiDownloadFile("reports/work-order-time-report", {
        query,
        fallbackName: `reporte-tiempos-${tag}.csv`,
      })
      toast.success("Descarga iniciada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el CSV.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ReportPageShell
      title="Reporte de tiempos"
      description="Reporte del temporizador de producción: tiempo efectivo, tiempo muerto y montaje agregados por área (impresión, laminación, corte, montaje y tintas), con detalle de motivos de cada parada."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label>Orden de trabajo (ID, opcional)</Label>
          <Input
            inputMode="numeric"
            value={woId}
            onChange={(ev) => setWoId(ev.target.value)}
            placeholder="Vacío = todas las OT del rango"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            disabled={loadingPreview}
            onClick={() => void loadPreview()}
          >
            {loadingPreview ? "Generando…" : "Vista previa"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void downloadPdf()}
          >
            Descargar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void downloadCsvFile()}
          >
            Descargar CSV
          </Button>
        </div>
      </div>
      {previewHtml ? (
        <div className="rounded-xl border bg-white p-2">
          <iframe
            title="Vista previa del reporte de tiempos"
            srcDoc={previewHtml}
            className="h-[760px] w-full rounded-md border"
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Pulsa <strong>Vista previa</strong> para generar el reporte con el rango
          y la OT seleccionados. La previa se renderiza aquí mismo y los botones
          PDF/CSV usan los mismos filtros.
        </p>
      )}
    </ReportPageShell>
  )
}
