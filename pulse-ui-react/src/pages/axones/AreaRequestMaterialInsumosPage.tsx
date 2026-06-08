"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { MaterialRequestInventoryResolutionCard } from "@/pages/axones/MaterialRequestInventoryResolutionCard"
import { apiFetch, ApiError } from "@/lib/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"
import type { MaterialRequestDispatchLine } from "@/lib/material-request-dispatch-utils"
import type { ClientRecord, ProductRecord } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { tintasMaterialRequestOriginLabel } from "@/lib/tintas-warehouse-labels"

type LineRow = MaterialRequestDispatchLine

type Detail = {
  id: number
  work_order_id?: number | null
  status: string
  authorized_by?: number | null
  originating_area?: string | null
  notes?: string | null
  work_order?: {
    code: string
    client?: Pick<ClientRecord, "name">
    product?: Pick<ProductRecord, "name">
  }
  requester?: { id: number; name: string; email?: string }
  lines: LineRow[]
}

function materialStatusLabel(code: string) {
  const m: Record<string, string> = {
    pending: "Pendiente",
    partial: "Recibido parcial",
    dispatched: "Recibido",
    cancelled: "Cancelada",
  }
  return m[code] ?? code
}

function materialStatusBadgeClass(status: string) {
  switch (status) {
    case "pending":
      return "border-amber-300/80 bg-amber-100 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-50"
    case "partial":
      return "border-teal-300/80 bg-teal-100 text-teal-950 shadow-sm dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-50"
    case "dispatched":
      return "border-emerald-300/80 bg-emerald-100 text-emerald-950 shadow-sm dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50"
    case "cancelled":
      return "border-border bg-muted text-muted-foreground"
    default:
      return "border-border bg-secondary text-secondary-foreground"
  }
}

export default function AreaRequestMaterialInsumosPage() {
  const { id } = useParams()
  const rid = id ? Number(id) : NaN

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [dispatching, setDispatching] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(rid) || rid < 1) return
    setLoading(true)
    try {
      const d = await apiFetch<Detail>(`material-requests/${rid}`)
      setDetail(d)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la solicitud.")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [rid])

  useEffect(() => {
    void load()
  }, [load])

  async function handleApprove(payload: {
    lines: Array<{
      material_request_line_id: number
      quantity: number
      material_id?: number
      bobina_ids?: number[]
    }>
  }) {
    if (!detail) return
    if (detail.status === "cancelled") {
      toast.error("La solicitud está cancelada.")
      return
    }
    if (detail.status === "dispatched") {
      toast.info("La solicitud ya está completamente recibida.")
      return
    }

    setDispatching(true)
    try {
      if (detail.authorized_by == null) {
        await apiFetch(`material-requests/${rid}/authorize`, { method: "POST" })
      }
      await apiFetch(`material-requests/${rid}/dispatch`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
      toast.success("Aprobación aplicada. El inventario se rebajó.")
      window.dispatchEvent(new Event("alerts:refresh"))
      await load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo aplicar la aprobación.")
    } finally {
      setDispatching(false)
    }
  }

  const showResolution =
    detail &&
    detail.status !== "cancelled" &&
    detail.status !== "dispatched"

  if (!Number.isFinite(rid) || rid < 1) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">ID inválido.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes entre áreas</h1>
        <p className="text-muted-foreground max-w-3xl text-sm">
          Vista de una <strong>solicitud de insumos</strong> enlazada al aviso entre áreas. Quien gestiona el almacén
          (p. ej. <strong>Leonardo</strong>) puede <strong>aprobar la salida</strong>: se carga el inventario disponible,
          elige cantidades o bobinas y el sistema <strong>rebaja el stock</strong> de forma automática. El historial
          queda en{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/movimientos-inventario">
            Movimientos
          </Link>
          . La bandeja general de solicitudes sigue en{" "}
          <Link className="text-primary font-medium underline-offset-4 hover:underline" to="/solicitudes-material">
            Solicitudes de insumos
          </Link>
          .
        </p>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight">Solicitud de insumos #{rid}</h2>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Revise líneas y observaciones. En la sección inferior compare el pedido con el inventario,
              asigne el SKU de salida y use <strong>Aprobar salida de inventario</strong> para registrar la rebaja.
            </p>
          </div>
          <Button type="button" variant="outline" asChild>
            <Link to="/solicitudes-area">Volver a solicitudes entre áreas</Link>
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Cargando…</p>
        ) : !detail ? null : (
          <>
            {(() => {
              const tintasOrigin = tintasMaterialRequestOriginLabel(detail.notes, detail.originating_area)
              return tintasOrigin ? (
                <Badge variant="outline" className="border-violet-300 bg-violet-50 text-violet-900">
                  Origen: {tintasOrigin}
                </Badge>
              ) : null
            })()}
            <div className="rounded-xl border border-border/80 bg-card/90 p-4 text-sm shadow-sm">
              {detail.work_order_id ? (
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">OT: </span>
                    <Link
                      className="text-primary font-semibold underline-offset-4 hover:underline"
                      to={`/ordenes-trabajo/${detail.work_order_id}`}
                    >
                      {detail.work_order?.code ?? detail.work_order_id}
                    </Link>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cliente: </span>
                    {detail.work_order?.client?.name ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Producto: </span>
                    {detail.work_order?.product?.name ?? "—"}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Orden de trabajo: </span>
                    <span className="font-medium">Sin OT (solicitud directa)</span>
                  </div>
                  {detail.requester ? (
                    <div>
                      <span className="text-muted-foreground">Solicitó: </span>
                      <span className="font-medium">{detail.requester.name}</span>
                    </div>
                  ) : null}
                </div>
              )}
              {detail.notes ? (
                <div className="mt-2">
                  <span className="text-muted-foreground">Observaciones: </span>
                  <span className="whitespace-pre-wrap">{detail.notes}</span>
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Estado: </span>
                  <Badge
                    variant="outline"
                    className={cn("font-medium shadow-none", materialStatusBadgeClass(detail.status))}
                  >
                    {materialStatusLabel(detail.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Autorización: </span>
                  {detail.authorized_by != null ? (
                    <Badge variant="outline" className="border-emerald-300/80 bg-emerald-50 text-emerald-950">
                      Sí
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300/80 bg-amber-50 text-amber-950">
                      Pendiente
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-violet-500/[0.07] shadow-md shadow-primary/5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                      <TableHead className="pl-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Material
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Solicitado
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Aprobado
                      </TableHead>
                      <TableHead className="pr-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pendiente
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lines.map((ln, idx) => {
                      const req = Number(ln.quantity_requested)
                      const dis = Number(ln.quantity_dispatched)
                      const rem = Math.max(0, req - dis)
                      return (
                        <TableRow
                          key={ln.id}
                          className={cn(
                            "border-border/60 transition-colors",
                            idx % 2 === 1 ? "bg-muted/25" : "bg-card/80",
                            "hover:bg-violet-500/[0.06]",
                          )}
                        >
                          <TableCell className="pl-5 align-middle">
                            {ln.material ? (
                              <div>
                                <div className="font-mono text-xs text-muted-foreground">{ln.material.sku}</div>
                                <div className="text-foreground text-sm font-medium">{ln.material.name}</div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <span className="text-muted-foreground text-xs">Sin catálogo · </span>
                                {ln.description?.trim() || "—"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-middle font-medium tabular-nums">
                            {formatQuantityDisplay(ln.quantity_requested)}
                            {ln.unit?.trim() || ln.material?.unit ? (
                              <span className="text-muted-foreground ml-1 text-xs font-normal">
                                {ln.unit?.trim() || ln.material?.unit}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-middle tabular-nums text-muted-foreground">
                            {formatQuantityDisplay(ln.quantity_dispatched)}
                          </TableCell>
                          <TableCell className="pr-5 align-middle font-semibold tabular-nums text-primary">
                            {formatQuantityDisplay(rem)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {showResolution ? (
              <MaterialRequestInventoryResolutionCard
                detail={detail}
                disabled={loading}
                dispatching={dispatching}
                onApprove={handleApprove}
              />
            ) : null}

            <p className="text-muted-foreground text-center text-xs">
              <Link className="text-primary underline-offset-4 hover:underline" to={`/solicitudes-material/${detail.id}`}>
                Abrir la misma solicitud en el módulo de insumos
              </Link>{" "}
              (consulta alternativa).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
