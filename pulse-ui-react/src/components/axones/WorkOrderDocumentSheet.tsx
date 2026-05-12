"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import { CLIENT_ORDER_MODULE_TITLE } from "@/pages/axones/client-order-i18n"
import type {
  LaravelPaginated,
  MaterialRow,
  WorkOrderDetailRecord,
} from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LineDraft = {
  key: string
  material_id: string
  quantity: string
  notes: string
}

function newLineRow(): LineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    material_id: "",
    quantity: "1",
    notes: "",
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat("es-VE", {
      day: "2-digit",
      month: "numeric",
      year: "numeric",
    }).format(d)
  } catch {
    return iso
  }
}

export function WorkOrderDocumentSheet({
  workOrder,
  workOrderId,
  readOnly = false,
  onSaved,
}: {
  workOrder: WorkOrderDetailRecord
  workOrderId: number
  /** Operadores de impresión: solo consultan maestro/pedido; no editan líneas ni ficha. */
  readOnly?: boolean
  onSaved: () => void | Promise<void>
}) {
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [materialQ, setMaterialQ] = useState("")
  const [linesDraft, setLinesDraft] = useState<LineDraft[]>([])
  const [autoCreateMr, setAutoCreateMr] = useState(true)

  const loadMaterials = useCallback(async (q: string) => {
    try {
      const res = await apiFetch<LaravelPaginated<MaterialRow>>("materials", {
        query: {
          inventory_area: "material",
          per_page: 100,
          page: 1,
          ...(q.trim() ? { q: q.trim() } : {}),
        },
      })
      setMaterials(res.data)
    } catch {
      setMaterials([])
    }
  }, [])

  useEffect(() => {
    void loadMaterials("")
  }, [loadMaterials])

  useEffect(() => {
    const t = setTimeout(() => {
      void loadMaterials(materialQ)
    }, 320)
    return () => clearTimeout(t)
  }, [materialQ, loadMaterials])

  useEffect(() => {
    const fromApi = workOrder.lines ?? []
    if (fromApi.length) {
      setLinesDraft(
        fromApi.map((l) => ({
          key: `l-${l.id}`,
          material_id: String(l.material_id),
          quantity: String(l.quantity ?? "1"),
          notes: l.notes ?? "",
        })),
      )
    } else {
      setLinesDraft([newLineRow()])
    }
  }, [
    workOrder.id,
    workOrder.lines,
  ])

  const canReplaceLines = useMemo(() => {
    const mrs = workOrder.material_requests ?? []
    for (const mr of mrs) {
      if (mr.status === "partial" || mr.status === "dispatched") return false
      for (const ln of mr.lines ?? []) {
        const d = Number(ln.quantity_dispatched ?? 0)
        if (d > 0) return false
      }
    }
    return true
  }, [workOrder.material_requests])

  async function saveSheet() {
    if (readOnly) return
    const filled = linesDraft.filter((r) => r.material_id !== "")
    if (filled.length !== linesDraft.length) {
      toast.error(
        "Seleccione material en cada fila o elimine filas vacías antes de guardar.",
      )
      return
    }

    const linesPayload = filled.map((r) => ({
      material_id: Number(r.material_id),
      quantity: r.quantity.trim() || "0",
      notes: r.notes.trim() || null,
    }))

    for (const row of linesPayload) {
      if (!Number.isFinite(row.material_id) || row.material_id <= 0) {
        toast.error("Material inválido en una de las filas.")
        return
      }
      if (Number(row.quantity) <= 0) {
        toast.error("La cantidad debe ser mayor que cero en cada línea.")
        return
      }
    }

    try {
      await apiFetch<WorkOrderDetailRecord>(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          lines: linesPayload,
          auto_create_material_request: autoCreateMr && linesPayload.length > 0,
        }),
      })
      toast.success("Ficha de OT actualizada.")
      await onSaved()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar la ficha.")
    }
  }

  const c = workOrder.client
  const p = workOrder.product
  const co = workOrder.client_order

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-sky-500 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Maestro y pedido
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Datos que en papel vienen en la cabecera: cliente, producto y pedido
            (precarga desde datos maestros).
            {readOnly ? (
              <span className="mt-1 block text-amber-800 dark:text-amber-200">
                Solo lectura: la ficha de materiales la gestiona Calidad / planificación.
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="font-medium text-foreground">Cliente</div>
            <div className="text-muted-foreground space-y-1">
              <div>
                <span className="text-foreground font-medium">
                  {c?.name ?? "—"}
                </span>
              </div>
              {c?.rif ? <div>RIF: {c.rif}</div> : null}
              {c?.state || c?.city ? (
                <div>
                  {[c.state, c.city].filter(Boolean).join(" · ") || "—"}
                </div>
              ) : null}
              {c?.email ? <div>{c.email}</div> : null}
              {c?.phone ? <div>{c.phone}</div> : null}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="font-medium text-foreground">Producto (maestro)</div>
            {p ? (
              <dl className="text-muted-foreground grid gap-1">
                <div>
                  <dt className="sr-only">Nombre</dt>
                  <dd className="text-foreground font-medium">{p.name}</dd>
                </div>
                {p.cpe ? (
                  <div>
                    CPE: <span className="text-foreground">{p.cpe}</span>
                  </div>
                ) : null}
                {p.mps ? (
                  <div>
                    M.P.P.S: <span className="text-foreground">{p.mps}</span>
                  </div>
                ) : null}
                {p.barcode ? (
                  <div>
                    Código de barra:{" "}
                    <span className="text-foreground font-mono text-xs">
                      {p.barcode}
                    </span>
                  </div>
                ) : null}
                {p.print_type ? (
                  <div>
                    Tipo impresión:{" "}
                    <span className="text-foreground">{p.print_type}</span>
                  </div>
                ) : null}
                {p.structure ? (
                  <div>
                    Estructura:{" "}
                    <span className="text-foreground">{p.structure}</span>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground">Sin producto ligado.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 md:col-span-2">
            <div className="font-medium text-foreground">{CLIENT_ORDER_MODULE_TITLE}</div>
            {co ? (
              <div className="text-muted-foreground grid gap-2 md:grid-cols-2">
                <div>
                  <div>
                    Código:{" "}
                    <span className="text-foreground font-mono">{co.code}</span>
                  </div>
                  <div>Fecha: {formatDate(co.ordered_at ?? null)}</div>
                  {workOrder.client_order_reference ? (
                    <div>
                      Ref. OT:{" "}
                      <span className="text-foreground">
                        {workOrder.client_order_reference}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div>
                  {co.lines?.length ? (
                    <ul className="list-inside list-disc space-y-1 text-xs">
                      {co.lines.map((ln) => (
                        <li key={ln.id}>
                          {ln.product?.name ??
                            ln.material?.name ??
                            ln.description ??
                            "Línea"}
                          : {ln.quantity} {ln.unit ?? ""}
                          {ln.material
                            ? ` · ${ln.material.sku}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs">Sin líneas en la orden.</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Esta OT no está ligada a un pedido cliente (OC) en el sistema. Puede enlazarse al crear o editar la orden desde
                ese módulo.
              </p>
            )}
            {workOrder.production_items?.length ? (
              <div className="border-t pt-2">
                <div className="text-foreground mb-1 text-xs font-medium">
                  Partidas / cantidades en documento
                </div>
                <ul className="space-y-1 text-xs">
                  {workOrder.production_items.map((it) => (
                    <li key={it.id}>
                      {it.product_description}: {it.quantity}{" "}
                      {it.quantity_unit}
                      {it.technical_specs
                        ? ` · ${it.technical_specs}`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
