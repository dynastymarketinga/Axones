"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ApiError, apiDownloadFile, authHeadersDownload, buildApiUrl } from "@/lib/api"

export default function ReportsWorkOrderSummaryPreviewPage() {
  const [searchParams] = useSearchParams()
  const workOrderId = searchParams.get("work_order_id") ?? searchParams.get("ot") ?? ""

  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  useEffect(() => {
    const num = Number(workOrderId.trim())
    if (!Number.isFinite(num) || num < 1) {
      setLoading(false)
      setPreviewHtml("")
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const url = buildApiUrl("reports/work-order-controls-summary/preview", {
          work_order_id: num,
        })
        const res = await fetch(url, { headers: authHeadersDownload() })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string }
          throw new ApiError(body.message || `Error ${res.status}`, res.status, body)
        }
        const html = await res.text()
        if (!cancelled) setPreviewHtml(html)
      } catch (e) {
        if (!cancelled) {
          setPreviewHtml("")
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar la vista previa del resumen de OT.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [workOrderId])

  async function downloadPdf() {
    const num = Number(workOrderId.trim())
    if (!Number.isFinite(num) || num < 1) return
    setDownloading(true)
    try {
      await apiDownloadFile("reports/work-order-controls-summary.pdf", {
        query: { work_order_id: num },
        fallbackName: `resumen-ot-controles-${num}.pdf`,
      })
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setDownloading(false)
    }
  }

  const backParams = new URLSearchParams()
  if (workOrderId.trim()) backParams.set("work_order_id", workOrderId.trim())

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa · Resumen de OT</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el documento antes de descargar o imprimir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" title="Volver al resumen" asChild>
            <Link
              to={`/reportes/resumen-ordenes-trabajo${backParams.toString() ? `?${backParams.toString()}` : ""}`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver al resumen</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={downloading ? "Generando PDF..." : "Descargar PDF"}
            onClick={() => void downloadPdf()}
            disabled={downloading || loading || !workOrderId.trim()}
          >
            <Download className="h-4 w-4" />
            <span className="sr-only">{downloading ? "Generando PDF..." : "Descargar PDF"}</span>
          </Button>
          <Button
            type="button"
            size="icon"
            title="Imprimir"
            onClick={() => window.print()}
            disabled={loading || !previewHtml}
          >
            <Printer className="h-4 w-4" />
            <span className="sr-only">Imprimir</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-muted-foreground text-xs">Orden de trabajo</p>
        <p className="text-sm font-medium">
          {workOrderId.trim() ? `ID #${workOrderId.trim()}` : "No especificada"}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-2">
        {!workOrderId.trim() ? (
          <p className="text-muted-foreground p-4 text-sm">
            Falta el parámetro <span className="font-mono">work_order_id</span> en la URL.
          </p>
        ) : loading ? (
          <p className="text-muted-foreground p-4 text-sm">Cargando vista previa…</p>
        ) : previewHtml ? (
          <iframe
            title="Vista previa del resumen de controles por OT"
            srcDoc={previewHtml}
            className="h-[780px] w-full rounded-md border bg-white"
          />
        ) : (
          <p className="text-muted-foreground p-4 text-sm">
            No se pudo renderizar la vista previa del documento.
          </p>
        )}
      </div>
    </div>
  )
}
