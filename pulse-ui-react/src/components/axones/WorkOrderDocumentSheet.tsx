"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

const WINDING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function WorkOrderDocumentSheet({
  workOrder,
  workOrderId,
  onSaved,
}: {
  workOrder: WorkOrderDetailRecord
  workOrderId: number
  onSaved: () => void | Promise<void>
}) {
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [materialQ, setMaterialQ] = useState("")
  const [linesDraft, setLinesDraft] = useState<LineDraft[]>([])
  const [winding, setWinding] = useState<string>("none")
  const [autoCreateMr, setAutoCreateMr] = useState(true)
  const [saving, setSaving] = useState(false)

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
    setWinding(
      workOrder.winding_figure != null && workOrder.winding_figure > 0
        ? String(workOrder.winding_figure)
        : "none",
    )
  }, [
    workOrder.id,
    workOrder.winding_figure,
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

    setSaving(true)
    try {
      await apiFetch<WorkOrderDetailRecord>(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          lines: linesPayload,
          winding_figure:
            winding === "none" || winding === "" ? null : Number(winding),
          auto_create_material_request: autoCreateMr && linesPayload.length > 0,
        }),
      })
      toast.success("Ficha de OT actualizada.")
      await onSaved()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar la ficha.")
    } finally {
      setSaving(false)
    }
  }

  async function saveWindingOnly() {
    setSaving(true)
    try {
      await apiFetch<WorkOrderDetailRecord>(`work-orders/${workOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          winding_figure:
            winding === "none" || winding === "" ? null : Number(winding),
        }),
      })
      toast.success("Figura de embobinado guardada.")
      await onSaved()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo guardar la figura.")
    } finally {
      setSaving(false)
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
              {c?.vendor?.name || c?.vendor_name ? (
                <div>
                  Vendedor: {c.vendor?.name ?? c.vendor_name}
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
            <div className="font-medium text-foreground">
              Pedido del cliente
            </div>
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
                    <span className="text-xs">Sin líneas en el pedido.</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Esta OT no está ligada a una orden de cliente en el sistema.
                Puede enlazarse al crear o editar la OT por API / módulo de
                pedidos.
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

      <Card className="border-l-4 border-rose-500 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Materiales (inventario)
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Sustratos virgen / capas (bilaminado, trilaminado): elija bobina o
            material del área <strong>material</strong>. Cada fila es una capa o
            bobina distinta.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="wo-mat-q">Buscar en inventario material</Label>
              <Input
                id="wo-mat-q"
                placeholder="SKU, nombre o código…"
                value={materialQ}
                onChange={(ev) => setMaterialQ(ev.target.value)}
              />
            </div>
          </div>

          {!canReplaceLines ? (
            <p className="text-destructive text-xs">
              No se pueden cambiar las líneas de materiales: ya hay despachos en
              solicitudes ligadas a esta OT. Revise en{" "}
              <Link
                to="/axones/solicitudes-material"
                className="underline underline-offset-2"
              >
                Solicitudes de materiales
              </Link>
              .
            </p>
          ) : null}

          {canReplaceLines ? (
            <div className="space-y-3">
              {linesDraft.map((row, idx) => (
                <div
                  key={row.key}
                  className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-end"
                >
                  <div className="grid flex-1 gap-2">
                    <Label>Material {idx + 1}</Label>
                    <Select
                      value={row.material_id || undefined}
                      onValueChange={(v) => {
                        setLinesDraft((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, material_id: v } : r,
                          ),
                        )
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar del inventario…" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>
                            {m.sku} · {m.name} ({m.quantity_on_hand} {m.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid w-full gap-2 md:w-32">
                    <Label>Cantidad</Label>
                    <Input
                      value={row.quantity}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setLinesDraft((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, quantity: v } : r,
                          ),
                        )
                      }}
                    />
                  </div>
                  <div className="grid flex-1 gap-2">
                    <Label>Notas</Label>
                    <Input
                      value={row.notes}
                      placeholder="Opcional"
                      onChange={(ev) => {
                        const v = ev.target.value
                        setLinesDraft((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, notes: v } : r,
                          ),
                        )
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={linesDraft.length <= 1}
                    onClick={() =>
                      setLinesDraft((prev) =>
                        prev.filter((r) => r.key !== row.key),
                      )
                    }
                    aria-label="Eliminar fila"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {(workOrder.lines ?? []).length ? (
                workOrder.lines.map((ln, idx) => (
                  <li
                    key={ln.id}
                    className="rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <span className="font-medium">Capa {idx + 1}: </span>
                    {ln.material
                      ? `${ln.material.sku} · ${ln.material.name}`
                      : `Material #${ln.material_id}`}
                    {" · "}
                    {ln.quantity}{" "}
                    {ln.material?.unit ? ln.material.unit : ""}
                    {ln.notes ? ` · ${ln.notes}` : ""}
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Sin líneas registradas.</li>
              )}
            </ul>
          )}

          {canReplaceLines ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLinesDraft((prev) => [...prev, newLineRow()])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar capa / material (trilaminado)
            </Button>
          ) : null}

          {canReplaceLines ? (
            <div className="flex items-start gap-2">
              <Checkbox
                id="wo-auto-mr"
                checked={autoCreateMr}
                onCheckedChange={(v) => setAutoCreateMr(v === true)}
              />
              <label
                htmlFor="wo-auto-mr"
                className="text-muted-foreground text-xs leading-snug"
              >
                Tras guardar, generar una nueva solicitud de materiales con
                estas líneas (solo si aún no hay despachos; las solicitudes
                anteriores no despachadas se reemplazan).
              </label>
            </div>
          ) : null}

          {workOrder.material_requests?.length ? (
            <p className="text-muted-foreground text-xs">
              Solicitudes:{" "}
              {workOrder.material_requests
                .map((mr) => `#${mr.id} (${mr.status})`)
                .join(", ")}
              .{" "}
              <Link
                to="/axones/solicitudes-material"
                className="text-primary underline underline-offset-2"
              >
                Abrir panel
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-violet-500 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Figura de embobinado
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Número de figura como en la OT impresa; más adelante se pueden
            sustituir por dibujos seleccionables.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="grid gap-2">
            <Label>Figura</Label>
            <Select value={winding} onValueChange={setWinding}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sin definir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                {WINDING_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Figura {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canReplaceLines ? (
          <Button
            type="button"
            disabled={saving}
            onClick={() => void saveSheet()}
          >
            {saving ? "Guardando…" : "Guardar materiales y figura"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant={canReplaceLines ? "outline" : "default"}
          disabled={saving}
          onClick={() => void saveWindingOnly()}
        >
          {saving ? "Guardando…" : "Guardar solo figura de embobinado"}
        </Button>
      </div>
    </div>
  )
}
