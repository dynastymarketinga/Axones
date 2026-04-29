"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { apiDownloadFile, ApiError, authHeadersDownload, buildApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"

function areaLabel(area: string): string {
  switch (area) {
    case "material":
      return "Sustrato"
    case "tintas":
      return "Tintas"
    case "cementerio_tintas":
      return "Cementerio tintas"
    case "quimicos":
      return "Químicos"
    case "bobinas_rechazadas":
      return "Bobinas rechazadas"
    case "miscelaneos":
      return "Misceláneos"
    default:
      return area || "—"
  }
}

export default function InventoryAreaPreviewPage() {
  const [searchParams] = useSearchParams()
  const reportDate = searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  const inventoryArea = searchParams.get("inventory_area") ?? "material"

  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          buildApiUrl("reports/inventory-area-daily/preview", {
            date: reportDate,
            inventory_area: inventoryArea,
          }),
          { headers: authHeadersDownload() },
        )
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const html = await res.text()
        if (!cancelled) setPreviewHtml(html)
      } catch {
        if (!cancelled) {
          setPreviewHtml("")
          toast.error("No se pudo cargar la vista previa del inventario.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reportDate, inventoryArea])

  async function downloadInventoryAreaPdf() {
    setDownloadingPdf(true)
    try {
      await apiDownloadFile("reports/inventory-area-daily.pdf", {
        query: { date: reportDate, inventory_area: inventoryArea },
        fallbackName: `inventory-area-daily-${inventoryArea}-${reportDate}.pdf`,
      })
      toast.success("PDF generado.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo generar el PDF.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de inventario por área</h1>
          <p className="text-muted-foreground text-sm">Revisa el documento antes de imprimir o generar PDF.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to={`/inventario-areas?date=${encodeURIComponent(reportDate)}&area=${encodeURIComponent(inventoryArea)}`}>
              Volver a Inventario por área
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadInventoryAreaPdf()} disabled={downloadingPdf || loading}>
            {downloadingPdf ? "Generando PDF..." : "Generar PDF"}
          </Button>
          <Button type="button" onClick={() => window.print()} disabled={loading || !previewHtml}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">Fecha de corte</p>
          <p className="text-sm font-medium">{reportDate}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Área</p>
          <p className="text-sm font-medium">{areaLabel(inventoryArea)}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-2">
        {loading ? (
          <p className="text-muted-foreground p-4 text-sm">Cargando vista previa…</p>
        ) : previewHtml ? (
          <iframe
            title="Vista previa del inventario por área"
            srcDoc={previewHtml}
            className="h-[780px] w-full rounded-md border bg-white"
          />
        ) : (
          <p className="text-muted-foreground p-4 text-sm">No se pudo renderizar la vista previa del documento.</p>
        )}
      </div>
    </div>
  )
}
