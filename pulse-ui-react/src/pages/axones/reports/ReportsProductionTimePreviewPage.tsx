"use client"

import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { ArrowLeft, Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ApiError, apiDownloadFile, authHeadersDownload, buildApiUrl } from "@/lib/api"

import { buildWorkOrderTimeReportQuery } from "./report-shared"

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

type PreviewView = "planta" | "ot"

export default function ReportsProductionTimePreviewPage() {
  const [searchParams] = useSearchParams()
  const view: PreviewView = searchParams.get("view") === "ot" ? "ot" : "planta"
  const from = searchParams.get("from") ?? defaultFrom()
  const to = searchParams.get("to") ?? defaultTo()
  const aggregateAll = searchParams.get("aggregate") === "all"
  const woId = searchParams.get("ot") ?? searchParams.get("work_order_id") ?? ""

  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  const canRunOtReport = view === "ot" && (aggregateAll || woId.trim() !== "")

  const backHref = useMemo(() => {
    const p = new URLSearchParams()
    p.set("tab", view === "ot" ? "ordenes" : "areas")
    if (aggregateAll) p.set("aggregate", "all")
    else if (woId.trim()) p.set("ot", woId.trim())
    const qs = p.toString()
    return `/reportes/produccion${qs ? `?${qs}` : ""}`
  }, [aggregateAll, view, woId])

  useEffect(() => {
    if (view === "ot" && !canRunOtReport) {
      setLoading(false)
      setPreviewHtml("")
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const apiPath =
          view === "planta"
            ? "reports/production-time-by-area/preview"
            : "reports/work-order-time-report/preview"
        const query =
          view === "planta"
            ? { from, to }
            : buildWorkOrderTimeReportQuery(from, to, aggregateAll, woId)
        const url = buildApiUrl(apiPath, query)
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
          else {
            toast.error(
              view === "planta"
                ? "No se pudo cargar la vista previa de planta."
                : "No se pudo cargar la vista previa de tiempos por OT.",
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [aggregateAll, canRunOtReport, from, to, view, woId])

  async function downloadPdf() {
    setDownloading(true)
    try {
      if (view === "planta") {
        await apiDownloadFile("reports/production-time-by-area.pdf", {
          query: { from, to },
          fallbackName: `tiempos-planta-${from}-${to}.pdf`,
        })
      } else {
        const query = buildWorkOrderTimeReportQuery(from, to, aggregateAll, woId)
        const tag = aggregateAll ? `${from}-${to}` : `ot-${woId.trim()}`
        await apiDownloadFile("reports/work-order-time-report.pdf", {
          query,
          fallbackName: `reporte-tiempos-${tag}.pdf`,
        })
      }
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setDownloading(false)
    }
  }

  const title =
    view === "planta"
      ? "Vista previa · Tiempos por área (planta)"
      : "Vista previa · Tiempos por orden de trabajo"

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el documento antes de descargar o imprimir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="icon" title="Volver a Producción y tiempos" asChild>
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Volver a Producción y tiempos</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={downloading ? "Generando PDF..." : "Descargar PDF"}
            onClick={() => void downloadPdf()}
            disabled={downloading || loading || (view === "ot" && !canRunOtReport)}
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
          <p className="text-muted-foreground text-xs">Alcance</p>
          <p className="text-sm font-medium">
            {view === "planta"
              ? "Planta (todas las OT del rango)"
              : aggregateAll
                ? "Todas las OT del rango (agregado)"
                : woId.trim()
                  ? `OT ID #${woId.trim()}`
                  : "Sin OT seleccionada"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-2">
        {view === "ot" && !canRunOtReport ? (
          <p className="text-muted-foreground p-4 text-sm">
            Indique <span className="font-mono">aggregate=all</span> o{" "}
            <span className="font-mono">ot</span> en la URL para generar la vista previa de OT.
          </p>
        ) : loading ? (
          <p className="text-muted-foreground p-4 text-sm">Cargando vista previa…</p>
        ) : previewHtml ? (
          <iframe
            title={title}
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
