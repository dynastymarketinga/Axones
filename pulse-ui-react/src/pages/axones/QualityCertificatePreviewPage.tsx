"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import {
  apiDownloadFile,
  apiFetch,
  ApiError,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import type { WorkOrderDetailRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type QualityRecord = {
  outcome: string
  notes: string | null
  recorder?: { id: number; name: string } | null
  updated_at?: string
} | null

type QualityResponse = {
  work_order_id: number
  record: QualityRecord
}

function outcomeLabel(value: string | null | undefined): string {
  const v = (value ?? "").toLowerCase().trim()
  if (v === "pass" || v === "approved") return "Aprobado"
  if (v === "fail" || v === "rejected") return "Rechazado"
  if (v === "pending" || v === "pendiente") return "Pendiente"
  return value?.trim() || "Pendiente"
}

function formatDate(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d)
}

export default function QualityCertificatePreviewPage() {
  const [searchParams] = useSearchParams()
  const ot = searchParams.get("ot") ?? ""
  const id = Number(ot)

  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailRecord | null>(null)
  const [quality, setQuality] = useState<QualityResponse | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const [q, wo] = await Promise.all([
          apiFetch<QualityResponse>(`work-orders/${id}/quality`),
          apiFetch<WorkOrderDetailRecord>(`work-orders/${id}`),
        ])
        const url = buildApiUrl(`work-orders/${id}/quality/certificate/preview`)
        const res = await fetch(url, { headers: authHeadersDownload() })
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const html = await res.text()
        if (cancelled) return
        setQuality(q)
        setWorkOrder(wo)
        setPreviewHtml(html)
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar la vista previa del certificado.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function downloadCertificatePdf() {
    if (!Number.isFinite(id) || id < 1) {
      toast.error("OT inválida.")
      return
    }
    setDownloadingPdf(true)
    try {
      await apiDownloadFile(`work-orders/${id}/quality/certificate.pdf`, {
        fallbackName: `certificado-calidad-ot-${id}.pdf`,
      })
      toast.success("PDF descargado correctamente.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo descargar el PDF.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de certificado</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el certificado antes de imprimirlo para el cliente.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/calidad">Volver a calidad</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporte de calidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">OT seleccionada:</span> {workOrder?.code ?? "—"}</p>
          <p><span className="font-medium">Cliente:</span> {workOrder?.client?.name ?? "—"}</p>
          <p><span className="font-medium">Producto:</span> {workOrder?.product?.name ?? "—"}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" onClick={() => void downloadCertificatePdf()} disabled={downloadingPdf || loading}>
              {downloadingPdf ? "Generando PDF…" : "Imprimir en PDF"}
            </Button>
          </div>
          <p><span className="font-medium">Resultado:</span> {outcomeLabel(quality?.record?.outcome)}</p>
          <p><span className="font-medium">Observaciones:</span> {quality?.record?.notes?.trim() || "Sin observaciones."}</p>
          <p><span className="font-medium">Registrado por:</span> {quality?.record?.recorder?.name ?? "No indicado"}</p>
          <p><span className="font-medium">Última actualización:</span> {formatDate(quality?.record?.updated_at)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documento</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Cargando vista previa…</p>
          ) : previewHtml ? (
            <iframe
              title="Vista previa del certificado"
              srcDoc={previewHtml}
              className="h-[760px] w-full rounded-md border bg-white"
            />
          ) : (
            <p className="text-muted-foreground text-sm">No se pudo renderizar el certificado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
