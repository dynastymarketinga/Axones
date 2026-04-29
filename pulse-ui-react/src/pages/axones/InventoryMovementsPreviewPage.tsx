"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { apiDownloadFile, ApiError, authHeadersDownload, buildApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

export default function InventoryMovementsPreviewPage() {
  const [searchParams] = useSearchParams()
  const from = searchParams.get("from") ?? weekAgoIsoDate()
  const to = searchParams.get("to") ?? todayIsoDate()
  const movementType = searchParams.get("movement_type") ?? ""
  const inventoryArea = searchParams.get("inventory_area") ?? ""
  const referenceType = searchParams.get("reference_type") ?? ""
  const invalidOnly = searchParams.get("invalid_only") === "1"

  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const query = new URLSearchParams({ from, to })
        if (movementType) query.set("movement_type", movementType)
        if (inventoryArea) query.set("inventory_area", inventoryArea)
        if (referenceType) query.set("reference_type", referenceType)
        if (invalidOnly) query.set("invalid_only", "1")

        const res = await fetch(
          `${buildApiUrl("reports/inventory-movements-general/preview")}?${query.toString()}`,
          { headers: authHeadersDownload() },
        )
        if (!res.ok) throw new Error(`Error ${res.status}`)
        const html = await res.text()
        if (!cancelled) setPreviewHtml(html)
      } catch {
        if (!cancelled) {
          setPreviewHtml("")
          toast.error("No se pudo cargar la vista previa de movimientos.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [from, to, movementType, inventoryArea, referenceType, invalidOnly])

  async function downloadMovementsPdf() {
    setDownloadingPdf(true)
    try {
      await apiDownloadFile("reports/inventory-movements-general.pdf", {
        query: {
          from,
          to,
          movement_type: movementType || undefined,
          inventory_area: inventoryArea || undefined,
          reference_type: referenceType || undefined,
          invalid_only: invalidOnly ? 1 : undefined,
        },
        fallbackName: `inventory-movements-general-${from}-${to}.pdf`,
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
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de movimientos</h1>
          <p className="text-muted-foreground text-sm">
            Revisa el reporte de movimientos antes de imprimir o generar PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link
              to={`/movimientos-inventario?${new URLSearchParams({
                from,
                to,
                ...(movementType ? { movement_type: movementType } : {}),
                ...(inventoryArea ? { inventory_area: inventoryArea } : {}),
                ...(referenceType ? { reference_type: referenceType } : {}),
                ...(invalidOnly ? { invalid_only: "1" } : {}),
              }).toString()}`}
            >
              Volver a Movimientos
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadMovementsPdf()} disabled={downloadingPdf || loading}>
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
          <p className="text-muted-foreground text-xs">Desde</p>
          <p className="text-sm font-medium">{from}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Hasta</p>
          <p className="text-sm font-medium">{to}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-2">
        {loading ? (
          <p className="text-muted-foreground p-4 text-sm">Cargando vista previa…</p>
        ) : previewHtml ? (
          <iframe
            title="Vista previa del reporte de movimientos"
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
