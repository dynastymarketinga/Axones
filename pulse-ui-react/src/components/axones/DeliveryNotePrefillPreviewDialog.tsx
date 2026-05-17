"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import {
  formatPrefillKg,
  type DeliveryNotePrefill,
} from "@/lib/delivery-note-prefill"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number | null
  workOrderCode?: string
}

export function DeliveryNotePrefillPreviewDialog({
  open,
  onOpenChange,
  workOrderId,
  workOrderCode,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [prefill, setPrefill] = useState<DeliveryNotePrefill | null>(null)

  useEffect(() => {
    if (!open || workOrderId == null || workOrderId < 1) {
      setPrefill(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setPrefill(null)
    void (async () => {
      try {
        const data = await apiFetch<DeliveryNotePrefill>(
          `work-orders/${workOrderId}/nota-entrega/prefill`,
        )
        if (!cancelled) setPrefill(data)
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiError) toast.error(e.message)
          else toast.error("No se pudo cargar la vista previa de la nota.")
          onOpenChange(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, workOrderId, onOpenChange])

  const lines = prefill?.suggested_lines ?? []
  const otLabel =
    workOrderCode ??
    prefill?.work_order?.code ??
    (workOrderId != null ? `OT #${workOrderId}` : "—")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista previa de nota · {otLabel}</DialogTitle>
          <DialogDescription>
            Resumen de material disponible desde Corte para esta orden. Los datos de transporte se
            completan al crear la nota.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando vista previa…</p>
        ) : !lines.length ? (
          <p className="text-muted-foreground text-sm">
            Sin saldo disponible para esta OT en despacho.
          </p>
        ) : (
          <div className="space-y-4">
            {prefill?.client ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium">{prefill.client.name ?? "Cliente"}</p>
                {prefill.client.rif ? (
                  <p className="text-muted-foreground text-xs">RIF: {prefill.client.rif}</p>
                ) : null}
                {prefill.client.address ? (
                  <p className="text-muted-foreground text-xs">{prefill.client.address}</p>
                ) : null}
              </div>
            ) : null}

            {prefill?.material_type_description ? (
              <p className="text-muted-foreground text-sm">{prefill.material_type_description}</p>
            ) : null}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Fecha sugerida:</span>{" "}
                <span className="font-medium">{prefill?.suggested_document_date ?? "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Nº secuencial:</span>{" "}
                <span className="font-medium">
                  {prefill?.next_sequential_number ?? "—"}
                </span>
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Paleta</TableHead>
                    <TableHead className="text-right">Rollos</TableHead>
                    <TableHead className="text-right">Kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={line.corte_bobina_usage_id ?? i}>
                      <TableCell>{line.pallet_position ?? i + 1}</TableCell>
                      <TableCell>{String(line.pallet_code ?? "—")}</TableCell>
                      <TableCell className="text-right">{line.bobbin_count ?? 1}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrefillKg(line.quantity_kg)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {prefill?.totals_preview ? (
              <p className="text-sm">
                Total:{" "}
                <span className="font-medium">
                  {prefill.totals_preview.total_bobbin_count ?? 0} rollo(s) ·{" "}
                  {formatPrefillKg(prefill.totals_preview.total_kg)}
                </span>
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
