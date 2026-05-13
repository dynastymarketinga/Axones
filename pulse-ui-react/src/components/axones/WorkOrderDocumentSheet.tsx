"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import type { LucideIcon } from "lucide-react"
import {
  Barcode,
  Boxes,
  Calendar,
  CreditCard,
  FileStack,
  FileText,
  Layers,
  ListTree,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Printer,
  ShoppingCart,
  Tag,
  Trash2,
  User,
} from "lucide-react"

import { apiFetch, ApiError } from "@/lib/api"
import { CLIENT_ORDER_MODULE_TITLE } from "@/pages/axones/client-order-i18n"
import type {
  LaravelPaginated,
  MaterialRow,
  WorkOrderDetailRecord,
} from "@/types/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

  const clientRows: { label: string; value: string; Icon: LucideIcon }[] = [
    { label: "Nombre", value: c?.name ?? "—", Icon: User },
    { label: "RIF", value: c?.rif ?? "—", Icon: CreditCard },
    {
      label: "Ubicación",
      value:
        c?.state || c?.city
          ? [c.state, c.city].filter(Boolean).join(" · ") || "—"
          : "—",
      Icon: MapPin,
    },
    { label: "Correo", value: c?.email ?? "—", Icon: Mail },
    { label: "Teléfono", value: c?.phone ?? "—", Icon: Phone },
  ]

  const productRows: { label: string; value: string; mono?: boolean; Icon: LucideIcon }[] = p
    ? [
        { label: "Nombre", value: p.name, Icon: Tag },
        { label: "CPE", value: p.cpe ?? "—", Icon: Layers },
        { label: "M.P.P.S", value: p.mps ?? "—", Icon: Boxes },
        { label: "Código de barra", value: p.barcode ?? "—", mono: true, Icon: Barcode },
        { label: "Tipo impresión", value: p.print_type ?? "—", Icon: Printer },
        { label: "Estructura", value: p.structure ?? "—", Icon: Package },
      ]
    : []

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-xl border border-primary/12 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <FileStack className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            Maestro y pedido
          </CardTitle>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Datos que en papel vienen en la cabecera: cliente, producto y pedido
            (precarga desde datos maestros).
            {readOnly ? (
              <span className="mt-2 block rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:text-amber-100">
                Solo lectura: la ficha de materiales la gestiona Calidad /
                planificación.
              </span>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 p-4 md:grid-cols-2 md:p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Cliente
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                    <TableHead className="w-[38%] pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Campo
                    </TableHead>
                    <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRows.map((row) => {
                    const RowIcon = row.Icon
                    return (
                    <TableRow
                      key={row.label}
                      className="border-border/50 hover:bg-transparent"
                    >
                      <TableCell className="pl-4 text-xs font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <RowIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                          {row.label}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-sm text-foreground">
                        {row.value}
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Producto (maestro)
            </div>
            {p ? (
              <div className="overflow-x-auto rounded-lg border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                      <TableHead className="w-[38%] pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Campo
                      </TableHead>
                      <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Valor
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRows.map((row) => {
                      const RowIcon = row.Icon
                      return (
                      <TableRow
                        key={row.label}
                        className="border-border/50 hover:bg-transparent"
                      >
                        <TableCell className="pl-4 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <RowIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            {row.label}
                          </span>
                        </TableCell>
                        <TableCell
                          className={
                            row.mono
                              ? "pr-4 font-mono text-sm text-foreground"
                              : "pr-4 text-sm font-medium text-foreground"
                          }
                        >
                          {row.value}
                        </TableCell>
                      </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin producto ligado.</p>
            )}
          </div>

          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {CLIENT_ORDER_MODULE_TITLE}
            </div>
            {co ? (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                        <TableHead className="min-w-[120px] pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Campo
                        </TableHead>
                        <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Valor
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableCell className="pl-4 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            Código
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 font-mono text-sm font-medium">
                          {co.code}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableCell className="pl-4 text-xs font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                            Fecha
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 text-sm">
                          {formatDate(co.ordered_at ?? null)}
                        </TableCell>
                      </TableRow>
                      {workOrder.client_order_reference ? (
                        <TableRow className="border-border/50 hover:bg-transparent">
                          <TableCell className="pl-4 text-xs font-medium text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <FileStack className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                              Ref. OT
                            </span>
                          </TableCell>
                          <TableCell className="pr-4 text-sm">
                            {workOrder.client_order_reference}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                {co.lines?.length ? (
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-primary/10 bg-primary/[0.07] hover:bg-primary/[0.07]">
                          <TableHead className="min-w-[160px] pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Línea / producto
                          </TableHead>
                          <TableHead className="w-28 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Cantidad
                          </TableHead>
                          <TableHead className="min-w-[100px] pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Material
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {co.lines.map((ln, idx) => (
                          <TableRow
                            key={ln.id}
                            className={
                              idx % 2 === 1
                                ? "border-border/50 bg-muted/20 hover:bg-muted/30"
                                : "border-border/50 hover:bg-transparent"
                            }
                          >
                            <TableCell className="pl-4 text-sm">
                              {ln.product?.name ??
                                ln.material?.name ??
                                ln.description ??
                                "Línea"}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">
                              {ln.quantity} {ln.unit ?? ""}
                            </TableCell>
                            <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                              {ln.material?.sku ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Sin líneas en la orden.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Esta OT no está ligada a un pedido cliente (OC) en el sistema.
                Puede enlazarse al crear o editar la orden desde ese módulo.
              </p>
            )}
            {workOrder.production_items?.length ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ListTree className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Partidas / cantidades en documento
                </div>
                <ul className="space-y-1.5 text-sm">
                  {workOrder.production_items.map((it) => (
                    <li key={it.id} className="leading-snug">
                      <span className="font-medium text-foreground">
                        {it.product_description}
                      </span>
                      {": "}
                      {it.quantity} {it.quantity_unit}
                      {it.technical_specs ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {it.technical_specs}
                        </span>
                      ) : null}
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
