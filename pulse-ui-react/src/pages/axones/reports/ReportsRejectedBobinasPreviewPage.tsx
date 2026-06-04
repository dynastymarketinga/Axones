"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ApiError, apiDownloadFile, authHeadersDownload, buildApiUrl } from "@/lib/api"

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ReportsRejectedBobinasPreviewPage() {
  const [searchParams] = useSearchParams()
  const from = searchParams.get("from") ?? defaultFrom()
  const to = searchParams.get("to") ?? defaultTo()
  const supplierId = searchParams.get("supplier_id") ?? ""

  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const url = buildApiUrl("reports/rejected-bobinas/preview", {
          from,
          to,
          supplier_id: supplierId || undefined,
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
          else toast.error("No se pudo cargar la vista previa de bobinas rechazadas.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [from, to, supplierId])

  async function downloadPdf() {
    setDownloading(true)
    try {
      await apiDownloadFile("reports/rejected-bobinas", {
        query: {
          from,
          to,
          supplier_id: supplierId || undefined,
          format: "pdf",
        },
        fallbackName: `bobinas-rechazadas-${from}-${to}.pdf`,
      })
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa · Bobinas rechazadas</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el documento antes de descargar o imprimir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" title="Volver a Reporte inventario" asChild>
            <Link
              to={`/reportes/inventario?${new URLSearchParams({
                from,
                to,
                ...(supplierId ? { supplier_id: supplierId } : {}),
              }).toString()}`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Reporte inventario</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={downloading ? "Generando PDF..." : "Descargar PDF"}
            onClick={() => void downloadPdf()}
            disabled={downloading || loading}
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

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">Desde</p>
          <p className="text-sm font-medium">{from}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Hasta</p>
          <p className="text-sm font-medium">{to}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Proveedor</p>
          <p className="text-sm font-medium">{supplierId || "Todos"}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-2">
        {loading ? (
          <p className="text-muted-foreground p-4 text-sm">Cargando vista previa…</p>
        ) : previewHtml ? (
          <iframe
            title="Vista previa del reporte de bobinas rechazadas"
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
