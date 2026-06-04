"use client"

import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import {
  apiDownloadFile,
  apiFetch,
  ApiError,
  authHeadersDownload,
  buildApiUrl,
} from "@/lib/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"
import { formatMaterialDimensionDisplay } from "@/lib/purchase-receipt-material-label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ReceiptLine = {
  id: number
  quantity: string | number | null
  unit: string | null
  micras: string | number | null
  ancho_mm: string | number | null
  item_type: string | null
  material?: {
    id: number
    sku?: string | null
    name?: string | null
  } | null
}

type PurchaseReceiptDetail = {
  id: number
  supplier?: { id: number; name: string } | null
  supplier_name?: string | null
  invoice_number?: string | null
  purchase_order_reference?: string | null
  received_at?: string | null
  notes?: string | null
  lines: ReceiptLine[]
}

function formatReceiptCode(id: number | null | undefined): string {
  const n = Number(id)
  if (!Number.isFinite(n) || n < 1) return "REC-———"
  return `REC-${String(Math.trunc(n)).padStart(6, "0")}`
}

export default function PurchaseReceiptPreviewPage() {
  const { id: routeId } = useParams()
  const rawId = routeId ?? ""
  const id = Number(rawId)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [receipt, setReceipt] = useState<PurchaseReceiptDetail | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setLoading(false)
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [data, previewResponse] = await Promise.all([
          apiFetch<PurchaseReceiptDetail>(`purchase-receipts/${id}`),
          fetch(buildApiUrl(`purchase-receipts/${id}/report/preview`), {
            headers: authHeadersDownload(),
          }),
        ])
        if (!previewResponse.ok) {
          throw new Error(`Error ${previewResponse.status}`)
        }
        const html = await previewResponse.text()
        if (!cancelled) {
          setReceipt(data)
          setPreviewHtml(html)
        }
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo cargar la vista previa de recepción.")
        if (!cancelled) {
          setReceipt(null)
          setPreviewHtml("")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  async function downloadReceiptPdf() {
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Recepción inválida.")
      return
    }
    setDownloadingPdf(true)
    try {
      await apiDownloadFile(`purchase-receipts/${id}/report.pdf`, {
        fallbackName: `reporte-recepcion-${id}.pdf`,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de recepción</h1>
          <p className="text-muted-foreground text-sm">Use esta vista para revisar y preparar reporte/impresión.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/recepciones-oc">Volver al listado</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadReceiptPdf()} disabled={downloadingPdf || loading}>
            {downloadingPdf ? "Generando PDF..." : "Descargar PDF"}
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Cargando vista previa…</div>
      ) : !receipt ? (
        <div className="text-muted-foreground">No se encontró la recepción solicitada.</div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">N° Recepción</p>
              <p className="text-sm font-semibold">{formatReceiptCode(receipt.id)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fecha recepción</p>
              <p className="text-sm font-medium">
                {receipt.received_at ? String(receipt.received_at).slice(0, 19).replace("T", " ") : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Proveedor</p>
              <p className="text-sm font-medium">{receipt.supplier?.name || receipt.supplier_name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">N° Factura</p>
              <p className="text-sm font-medium">{receipt.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">N° OC (referencia)</p>
              <p className="text-sm font-medium">{receipt.purchase_order_reference || "—"}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-muted-foreground text-xs">Observaciones</p>
              <p className="text-sm">{receipt.notes || "—"}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Micras</TableHead>
                  <TableHead>Ancho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lines?.length ? (
                  receipt.lines.map((line, index) => (
                    <TableRow key={line.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{line.material?.sku || "—"}</TableCell>
                      <TableCell>{line.material?.name || "—"}</TableCell>
                      <TableCell>{line.item_type || "—"}</TableCell>
                      <TableCell>{formatQuantityDisplay(line.quantity) || "—"}</TableCell>
                      <TableCell>{line.unit || "—"}</TableCell>
                      <TableCell>{formatMaterialDimensionDisplay(line.micras) || "—"}</TableCell>
                      <TableCell>{formatMaterialDimensionDisplay(line.ancho_mm) || "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Esta recepción no tiene líneas cargadas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-white p-2">
            {previewHtml ? (
              <iframe
                title="Vista previa del reporte de recepción"
                srcDoc={previewHtml}
                className="h-[760px] w-full rounded-md border"
              />
            ) : (
              <p className="text-muted-foreground p-4 text-sm">No se pudo renderizar la vista previa del documento.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
