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
import type { WorkOrderDetailRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function readString(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  } catch {
    return iso
  }
}

function statusLabel(value: string | null | undefined): string {
  const s = (value ?? "").toLowerCase().trim()
  if (s === "open") return "Abierta"
  if (s === "in_progress") return "En proceso"
  if (s === "completed") return "Completada"
  if (s === "cancelled") return "Cancelada"
  return value?.trim() || "—"
}

function pedidoKgFromDetail(wo: WorkOrderDetailRecord): string {
  const items = wo.production_items ?? []
  const first = items[0]
  if (first && String(first.quantity_unit ?? "").toUpperCase() === "KG") {
    return String(first.quantity ?? "—")
  }
  const form = wo.technical_document?.form
  if (form && typeof form === "object" && "pedidoKg" in form) {
    const v = (form as Record<string, unknown>).pedidoKg
    if (typeof v === "number") return String(v)
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return "—"
}

export default function WorkOrderProductionPreviewPage() {
  const { woId } = useParams()
  const rawId = woId ?? ""
  const id = Number(rawId)
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [previewHtml, setPreviewHtml] = useState("")
  const [wo, setWo] = useState<WorkOrderDetailRecord | null>(null)

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
          apiFetch<WorkOrderDetailRecord>(`work-orders/${id}`),
          fetch(buildApiUrl(`work-orders/${id}/orden-produccion-planilla/preview`), {
            headers: authHeadersDownload(),
          }),
        ])
        if (!previewResponse.ok) {
          if (previewResponse.status === 403) {
            throw new Error("La vista previa no está disponible para esta orden (completada, cancelada o sin permiso).")
          }
          throw new Error(`Error ${previewResponse.status}`)
        }
        const html = await previewResponse.text()
        if (!cancelled) {
          setWo(data)
          setPreviewHtml(html)
        }
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else if (e instanceof Error) toast.error(e.message)
        else toast.error("No se pudo cargar la vista previa de la orden.")
        if (!cancelled) {
          setWo(null)
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

  async function downloadPdf() {
    if (!Number.isFinite(id) || id < 1) {
      toast.error("Orden inválida.")
      return
    }
    setDownloadingPdf(true)
    try {
      await apiDownloadFile(`work-orders/${id}/orden-produccion-planilla.pdf`, {
        fallbackName: `orden-trabajo-planilla-${id}.pdf`,
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
          <h1 className="text-2xl font-semibold tracking-tight">Vista previa de orden de trabajo</h1>
          <p className="text-muted-foreground text-sm">Use esta vista para revisar y preparar reporte/impresión.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/ordenes-trabajo">Volver al listado</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadPdf()} disabled={downloadingPdf || loading}>
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
      ) : !wo ? (
        <div className="text-muted-foreground">No se encontró la orden o no tiene vista previa disponible.</div>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">N° Orden</p>
              <p className="text-sm font-semibold">{wo.code}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fecha documento</p>
              <p className="text-sm font-medium">{formatDate(wo.document_date)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="text-sm font-medium">{wo.client?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Producto</p>
              <p className="text-sm font-medium">{wo.product?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Estado OT</p>
              <p className="text-sm font-medium">{statusLabel(wo.status)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Etapa tablero</p>
              <p className="text-sm font-medium">{readString(wo.board_stage) || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Kg (pedido / planilla)</p>
              <p className="text-sm font-medium">{pedidoKgFromDetail(wo)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">N° documento</p>
              <p className="text-sm font-medium">{wo.document_number ?? "—"}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Unidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(wo.production_items ?? []).length ? (
                  (wo.production_items ?? []).map((line, index) => (
                    <TableRow key={line.id ?? index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{line.product_description ?? "—"}</TableCell>
                      <TableCell>{line.quantity ?? "—"}</TableCell>
                      <TableCell>{line.quantity_unit ?? "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Esta orden no tiene ítems de producción registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-white p-2">
            {previewHtml ? (
              <iframe
                title="Vista previa del reporte de orden de trabajo"
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
