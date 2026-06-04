"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import { formatQuantityDisplay } from "@/lib/numeric-display"
import type { ClientRecord, ProductRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LineRow = {
  id: number
  material_id: number | null
  description?: string | null
  quantity_requested: string
  quantity_dispatched: string
  material?: { sku: string; name: string; unit: string; inventory_area?: string }
}

type Detail = {
  id: number
  work_order_id?: number | null
  status: string
  authorized_by?: number | null
  notes?: string | null
  work_order?: {
    code: string
    client?: Pick<ClientRecord, "name">
    product?: Pick<ProductRecord, "name">
  }
  requester?: { id: number; name: string; email?: string }
  lines: LineRow[]
}

function statusLabel(code: string) {
  const m: Record<string, string> = {
    pending: "Pendiente",
    partial: "Parcial",
    completed: "Completada",
    cancelled: "Cancelada",
  }
  return m[code] ?? code
}

export default function MaterialRequestDetailPage() {
  const { id } = useParams()
  const rid = id ? Number(id) : NaN

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Detail | null>(null)

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

  if (!Number.isFinite(rid) || rid < 1) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">ID inválido.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Solicitud #{rid}</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Consulta de la solicitud. Para la bandeja general use{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to="/solicitudes-material">
              Solicitudes de insumos
            </Link>
            ; avisos entre áreas en{" "}
            <Link className="text-primary underline-offset-4 hover:underline" to="/solicitudes-area">
              Solicitudes entre áreas
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/solicitudes-material">Volver a solicitudes</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : !detail ? null : (
        <>
          <div className="rounded-xl border bg-card space-y-2 p-4 text-sm shadow-sm">
            {detail.work_order_id ? (
              <>
                <div>
                  <span className="text-muted-foreground">OT: </span>
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
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
              </>
            ) : (
              <div className="space-y-1">
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
              <div>
                <span className="text-muted-foreground">Observaciones: </span>
                <span className="whitespace-pre-wrap">{detail.notes}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">Estado: </span>
              {statusLabel(detail.status)}
            </div>
            <div>
              <span className="text-muted-foreground">Autorización: </span>
              {detail.authorized_by != null ? "Sí" : "Pendiente"}
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-x-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Despachado</TableHead>
                  <TableHead>Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.lines.map((ln) => {
                  const req = Number(ln.quantity_requested)
                  const dis = Number(ln.quantity_dispatched)
                  const rem = Math.max(0, req - dis)
                  return (
                    <TableRow key={ln.id}>
                      <TableCell>
                        {ln.material ? (
                          <>
                            <div className="font-mono text-xs">{ln.material.sku}</div>
                            <div>{ln.material.name}</div>
                          </>
                        ) : (
                          <div className="text-sm">
                            <span className="text-muted-foreground text-xs">Sin catálogo · </span>
                            {ln.description?.trim() || "—"}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{formatQuantityDisplay(ln.quantity_requested)}</TableCell>
                      <TableCell>{formatQuantityDisplay(ln.quantity_dispatched)}</TableCell>
                      <TableCell>{formatQuantityDisplay(rem)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
