"use client"

import { Link } from "react-router-dom"
import {
  Barcode,
  CalendarDays,
  ClipboardList,
  Eye,
  FileText,
  Loader2,
  Truck,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  formatDateDMY,
  formatDateTime,
  formatQuantityEs,
  parsePoLineItemType,
  poLinePrimaryLabel,
  PO_ITEM_TYPE_DISPLAY,
  PoLineTypeBadge,
  PurchaseOrderStatusBadge,
} from "@/pages/axones/purchase-order-shared"

export type PurchaseOrderDetailData = {
  id: number
  code: string
  status: string
  supplier_id: number
  ordered_at: string | null
  created_at?: string | null
  notes: string | null
  manually_closed_at?: string | null
  supplier?: { id: number; name: string; rif?: string | null } | null
  lines?: Array<{
    id: number
    description?: string | null
    quantity_ordered: string | number
    quantity_received?: string | number
    unit?: string
    material?: { name?: string; sku?: string } | null
  }>
  receipts?: Array<{
    id: number
    invoice_number?: string | null
    received_at?: string | null
    lines?: unknown[]
  }>
}

function formatReceiptCode(id: number): string {
  if (!Number.isFinite(id) || id < 1) return "REC-———"
  return `REC-${String(Math.trunc(id)).padStart(6, "0")}`
}

type PurchaseOrderDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  detail: PurchaseOrderDetailData | null
}

export function PurchaseOrderDetailSheet({
  open,
  onOpenChange,
  loading,
  detail,
}: PurchaseOrderDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="po-detail-dialog flex max-h-[min(92vh,52rem)] w-[min(calc(100vw-1.5rem),44rem)] flex-col gap-0 overflow-hidden border-primary/15 p-0 sm:max-w-none">
        <div className="po-detail-dialog-header shrink-0 px-6 pb-5 pt-6">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-sm">
              <Eye className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="text-left text-xl font-semibold tracking-tight">
                Detalle de orden
              </DialogTitle>
              <DialogDescription className="text-left text-sm leading-relaxed">
                Consulta de cabecera, artículos solicitados y recepciones vinculadas.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              <p className="text-sm">Cargando orden…</p>
            </div>
          ) : !detail ? (
            <p className="text-muted-foreground py-8 text-sm">No se pudo cargar la orden.</p>
          ) : (
            <div className="space-y-5">
              <div className="po-detail-hero space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Código
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-primary">
                      {detail.code}
                    </p>
                  </div>
                  <PurchaseOrderStatusBadge
                    status={detail.status}
                    manuallyClosedAt={detail.manually_closed_at ?? null}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="po-detail-stat">
                    <Truck className="size-4 shrink-0 text-primary/70" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs">Proveedor</p>
                      <p className="text-sm font-semibold">{detail.supplier?.name ?? `#${detail.supplier_id}`}</p>
                    </div>
                  </div>
                  <div className="po-detail-stat">
                    <CalendarDays className="size-4 shrink-0 text-primary/70" aria-hidden />
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha de pedido</p>
                      <p className="text-sm font-semibold">{formatDateDMY(detail.ordered_at)}</p>
                    </div>
                  </div>
                  <div className="po-detail-stat">
                    <Barcode className="size-4 shrink-0 text-primary/70" aria-hidden />
                    <div>
                      <p className="text-muted-foreground text-xs">Registrada</p>
                      <p className="text-sm font-semibold">{formatDateTime(detail.created_at)}</p>
                    </div>
                  </div>
                  <div className="po-detail-stat">
                    <ClipboardList className="size-4 shrink-0 text-primary/70" aria-hidden />
                    <div>
                      <p className="text-muted-foreground text-xs">Artículos</p>
                      <p className="text-sm font-semibold tabular-nums">{detail.lines?.length ?? 0}</p>
                    </div>
                  </div>
                </div>
                {detail.notes?.trim() ? (
                  <div className="rounded-xl border border-primary/15 bg-background/90 px-3.5 py-3">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <FileText className="size-3.5" aria-hidden />
                      Notas
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{detail.notes.trim()}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Artículos del pedido
                  {detail.lines?.length ? (
                    <span className="text-muted-foreground ml-1.5 font-normal">({detail.lines.length})</span>
                  ) : null}
                </h3>

                {detail.lines?.length ? (
                  <ul className="space-y-2.5">
                    {detail.lines.map((ln, idx) => {
                      const itemType = parsePoLineItemType(ln.description)
                      const accent = PO_ITEM_TYPE_DISPLAY[itemType].rowAccent
                      return (
                        <li key={ln.id} className={cn("po-line-card border-l-4", accent)}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                  {idx + 1}
                                </span>
                                <PoLineTypeBadge type={itemType} />
                              </div>
                              <p className="text-sm font-semibold leading-snug">{poLinePrimaryLabel(ln)}</p>
                              {ln.description?.trim() &&
                              ln.description.trim() !== poLinePrimaryLabel(ln) ? (
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                  {ln.description.trim()}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right text-sm">
                              <p className="font-bold tabular-nums">
                                {formatQuantityEs(ln.quantity_ordered)}{" "}
                                <span className="text-muted-foreground font-medium">{ln.unit ?? "—"}</span>
                              </p>
                              <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                                Recibido:{" "}
                                {ln.quantity_received != null && String(ln.quantity_received) !== ""
                                  ? formatQuantityEs(ln.quantity_received)
                                  : "0,000"}
                              </p>
                              {(() => {
                                const ordered = Number(ln.quantity_ordered ?? 0)
                                const received = Number(ln.quantity_received ?? 0)
                                const pending = Math.max(
                                  0,
                                  ordered - (Number.isFinite(received) ? received : 0),
                                )
                                const unit = ln.unit ?? "kg"
                                return pending > 0.0001 ? (
                                  <p className="mt-1 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                                    Pendiente: {formatQuantityEs(pending)} {unit}
                                  </p>
                                ) : null
                              })()}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                    Sin artículos en esta orden.
                  </p>
                )}
              </div>

              {detail.receipts?.length ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Recepciones ({detail.receipts.length})</h3>
                  <ul className="space-y-2">
                    {detail.receipts.map((rec) => (
                      <li
                        key={rec.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3.5 py-3"
                      >
                        <div>
                          <p className="font-mono text-sm font-semibold">{formatReceiptCode(rec.id)}</p>
                          <p className="text-muted-foreground text-xs">
                            {rec.invoice_number?.trim()
                              ? `Factura ${rec.invoice_number.trim()}`
                              : "Sin factura"}{" "}
                            · {formatDateTime(rec.received_at ?? null)}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <Link to={`/recepciones-oc/${rec.id}/vista-previa`}>Ver recepción</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-muted/25 px-6 py-4">
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              <X className="mr-2 size-4" aria-hidden />
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
