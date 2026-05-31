"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import {
  defaultApprovalQty,
  lineRemaining,
  maxApprovableQty,
  stockOnHand,
  usesBobinaPicker,
  validateApprovalQty,
  type BobinaDispatchRow,
  type MaterialRequestDispatchLine,
} from "@/lib/material-request-dispatch-utils"

type LineRow = MaterialRequestDispatchLine

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

type BobinaRow = BobinaDispatchRow

type Props = {
  open: boolean
  requestId: number | null
  onOpenChange: (open: boolean) => void
  onDispatched: () => void
  /** "delivery": textos de entrega (módulo insumos). "approval": aprobación desde entre áreas. */
  variant?: "delivery" | "approval"
}

export function MaterialRequestDeliveryDialog({
  open,
  requestId,
  onOpenChange,
  onDispatched,
  variant = "delivery",
}: Props) {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [bobinasByLine, setBobinasByLine] = useState<Record<string, BobinaRow[]>>(
    {},
  )
  const [selectedBobinaIds, setSelectedBobinaIds] = useState<
    Record<string, Record<string, boolean>>
  >({})
  const [dispatching, setDispatching] = useState(false)

  const load = useCallback(async () => {
    if (requestId == null || !Number.isFinite(requestId) || requestId < 1) return
    setLoading(true)
    try {
      const d = await apiFetch<Detail>(`material-requests/${requestId}`)
      setDetail(d)

      const lines = d.lines ?? []
      const wanted = lines.filter(
        (ln) => ln.material_id != null && ln.material?.inventory_area === "material",
      )
      const bobinasMap: Record<string, BobinaRow[]> = {}
      const selectedMap: Record<string, Record<string, boolean>> = {}

      await Promise.all(
        wanted.map(async (ln) => {
          try {
            const res = await apiFetch<LaravelPaginated<BobinaRow>>("bobinas", {
              query: {
                material_id: ln.material_id,
                status: "available",
                per_page: 200,
                page: 1,
              },
            })
            bobinasMap[String(ln.id)] = res.data ?? []
            selectedMap[String(ln.id)] = {}
          } catch {
            bobinasMap[String(ln.id)] = []
            selectedMap[String(ln.id)] = {}
          }
        }),
      )
      setBobinasByLine(bobinasMap)
      setSelectedBobinaIds(selectedMap)

      const q: Record<string, string> = {}
      for (const ln of lines) {
        const bobinas = bobinasMap[String(ln.id)] ?? []
        q[String(ln.id)] = defaultApprovalQty(ln, ln.material, bobinas)
      }
      setQty(q)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la solicitud.")
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    if (!open || requestId == null) {
      setDetail(null)
      return
    }
    void load()
  }, [open, requestId, load])

  function pendingLinesNeedingInput(): LineRow[] {
    if (!detail) return []
    return detail.lines.filter((ln) => lineRemaining(ln) > 0.0005)
  }

  function lineHasNoFulfillmentSource(ln: LineRow): boolean {
    const rem = lineRemaining(ln)
    if (rem <= 0.0005) return false
    const lineKey = String(ln.id)
    const bobinas = bobinasByLine[lineKey] ?? []
    if (usesBobinaPicker(ln.material?.inventory_area, bobinas)) return false
    return stockOnHand(ln.material) <= 0.0005
  }

  async function dispatch() {
    if (!detail) return

    const blocked = pendingLinesNeedingInput().filter(lineHasNoFulfillmentSource)
    if (blocked.length) {
      const names = blocked
        .map((ln) => ln.material?.name ?? ln.description?.trim() ?? "línea sin catálogo")
        .join(", ")
      toast.error(
        `Sin stock disponible para: ${names}. Registre entrada en Inventario (recepción o movimiento) antes de aprobar.`,
      )
      return
    }

    const lines = detail.lines
      .map((ln) => {
        const lineKey = String(ln.id)
        const bobinas = bobinasByLine[lineKey] ?? []
        if (usesBobinaPicker(ln.material?.inventory_area, bobinas)) {
          const sel = selectedBobinaIds[lineKey] ?? {}
          const ids = Object.keys(sel)
            .filter((k) => sel[k])
            .map((k) => Number(k))
            .filter((n) => Number.isFinite(n) && n > 0)
          if (!ids.length) return null
          const total = ids.reduce((acc, id) => {
            const b = bobinas.find((x) => x.id === id)
            const w = b?.weight_kg ? Number(b.weight_kg) : 0
            return acc + (Number.isFinite(w) ? w : 0)
          }, 0)
          if (!Number.isFinite(total) || total <= 0) return null
          return {
            material_request_line_id: ln.id,
            quantity: total,
            bobina_ids: ids,
          }
        }

        const qn = Number(qty[lineKey] ?? 0)
        if (!Number.isFinite(qn) || qn <= 0) return null
        return { material_request_line_id: ln.id, quantity: qn }
      })
      .filter(Boolean) as Array<{
      material_request_line_id: number
      quantity: number
      bobina_ids?: number[]
    }>

    if (!lines.length) {
      const pending = pendingLinesNeedingInput()
      const needsBobinas = pending.some((ln) => {
        const bobinas = bobinasByLine[String(ln.id)] ?? []
        return usesBobinaPicker(ln.material?.inventory_area, bobinas)
      })
      toast.error(
        needsBobinas
          ? variant === "approval"
            ? "Seleccione los rollos a aprobar."
            : "Seleccione los rollos a despachar."
          : variant === "approval"
            ? "Indique la cantidad a aprobar en cada línea pendiente."
            : "Indique la cantidad a despachar en cada línea pendiente.",
      )
      return
    }

    for (const entry of lines) {
      if (entry.bobina_ids?.length) continue
      const ln = detail.lines.find((l) => l.id === entry.material_request_line_id)
      if (!ln) continue
      const bobinas = bobinasByLine[String(ln.id)] ?? []
      const err = validateApprovalQty(
        lineRemaining(ln),
        entry.quantity,
        ln.material?.unit || "kg",
        stockOnHand(ln.material),
        usesBobinaPicker(ln.material?.inventory_area, bobinas),
        ln.material_id != null,
      )
      if (err) {
        toast.error(err)
        return
      }
    }

    setDispatching(true)
    try {
      await apiFetch(`material-requests/${detail.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      })
      toast.success(
        variant === "approval"
          ? "Aprobación aplicada. El inventario se rebajó."
          : "Despacho aplicado al inventario.",
      )
      onDispatched()
      onOpenChange(false)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error(variant === "approval" ? "No se pudo aplicar la aprobación." : "No se pudo despachar.")
    } finally {
      setDispatching(false)
    }
  }

  const canDispatch =
    detail &&
    detail.authorized_by != null &&
    detail.status !== "cancelled" &&
    detail.status !== "dispatched"

  const hasBlockedLines =
    detail != null && pendingLinesNeedingInput().some(lineHasNoFulfillmentSource)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {variant === "approval" ? "Aprobar salida de inventario" : "Entregar solicitud"}
            {requestId != null ? ` #${requestId}` : ""}
          </DialogTitle>
          <DialogDescription>
            {variant === "approval" ? (
              <>
                Se cargan existencias disponibles. Si hay rollos con código registrados, elija cuáles salen; si no,
                indique la cantidad en kg según el stock mostrado. Al confirmar, el sistema{" "}
                <strong>rebaja el inventario</strong> y registra el movimiento.
              </>
            ) : (
              <>
                Seleccione cantidades y confirme para registrar la salida de inventario.
                La solicitud debe estar autorizada.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        ) : !detail ? (
          <p className="text-muted-foreground text-sm">Sin datos.</p>
        ) : (
          <div className="space-y-4">
            {detail.authorized_by == null ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                {variant === "approval" ? (
                  <>
                    Esta solicitud aún no está autorizada. Cierre el cuadro y use el botón{" "}
                    <strong>Aprobar salida de inventario</strong> en la pantalla anterior (se autorizará
                    automáticamente antes de abrir este paso).
                  </>
                ) : (
                  <>
                    Esta solicitud aún no está autorizada. Pulse <strong>Autorizar</strong> en el detalle
                    de la solicitud o en el listado antes de entregar.
                  </>
                )}
              </p>
            ) : null}

            {hasBlockedLines ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Una o más líneas no tienen stock en inventario. No puede aprobar la salida hasta registrar
                entrada (p. ej. recepción de compra o movimiento de inventario).
              </p>
            ) : null}

            <div className="rounded-xl border bg-muted/30 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Estado: </span>
                {detail.status}
              </div>
              {detail.notes ? (
                <div>
                  <span className="text-muted-foreground">Observaciones: </span>
                  {detail.notes}
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>{variant === "approval" ? "Aprobado" : "Despachado"}</TableHead>
                    <TableHead>Pendiente</TableHead>
                    <TableHead>{variant === "approval" ? "Aprobar ahora" : "Despachar ahora"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.lines.map((ln) => {
                    const rem = lineRemaining(ln)
                    const lineKey = String(ln.id)
                    const bobinas = bobinasByLine[lineKey] ?? []
                    const bobinaPicker = usesBobinaPicker(ln.material?.inventory_area, bobinas)
                    const stock = stockOnHand(ln.material)
                    const maxQty = maxApprovableQty(
                      rem,
                      stock,
                      bobinaPicker,
                    )
                    const enteredQty = Number(qty[lineKey] ?? 0)
                    const qtyOverPending = !bobinaPicker && enteredQty - rem > 0.0005
                    const qtyOverStock =
                      !bobinaPicker &&
                      stock > 0 &&
                      enteredQty > stock + 0.0005
                    const noSource = lineHasNoFulfillmentSource(ln)
                    const sel = selectedBobinaIds[lineKey] ?? {}
                    const selectedIds = Object.keys(sel).filter((k) => sel[k])
                    const selectedKg = selectedIds.reduce((acc, idStr) => {
                      const idn = Number(idStr)
                      const b = bobinas.find((x) => x.id === idn)
                      const w = b?.weight_kg ? Number(b.weight_kg) : 0
                      return acc + (Number.isFinite(w) ? w : 0)
                    }, 0)
                    const overSelected = bobinaPicker && selectedKg - rem > 0.0005
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
                              <span className="text-muted-foreground text-xs">
                                Sin catálogo ·{" "}
                              </span>
                              {ln.description?.trim() || "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{ln.quantity_requested}</TableCell>
                        <TableCell>{ln.quantity_dispatched}</TableCell>
                        <TableCell>{rem.toFixed(3)}</TableCell>
                        <TableCell className="min-w-[280px]">
                          {bobinaPicker ? (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Seleccione rollos (sumatoria kg). Seleccionado:{" "}
                                <span className="font-medium">{selectedKg.toFixed(3)} kg</span>
                              </div>
                              {overSelected ? (
                                <div className="text-xs text-destructive">
                                  La selección excede lo pendiente ({rem.toFixed(3)} kg).
                                </div>
                              ) : null}
                              <div className="max-h-40 overflow-auto rounded-md border p-2">
                                <div className="space-y-1">
                                  {bobinas.map((b) => (
                                    <label
                                      key={b.id}
                                      className="flex cursor-pointer items-center justify-between gap-2 text-xs"
                                    >
                                      <span className="font-mono">
                                        #{b.id} {b.code ? `· ${b.code}` : ""}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {b.weight_kg ?? "—"} kg
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(sel[String(b.id)])}
                                        disabled={
                                          rem <= 0 ||
                                          (!sel[String(b.id)] && selectedKg >= rem - 0.0005)
                                        }
                                        onChange={(ev) => {
                                          const checked = ev.target.checked
                                          setSelectedBobinaIds((prev) => ({
                                            ...prev,
                                            [lineKey]: {
                                              ...(prev[lineKey] ?? {}),
                                              [String(b.id)]: checked,
                                            },
                                          }))
                                        }}
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : noSource ? (
                            <div className="space-y-1 text-xs">
                              <p className="font-medium text-destructive">
                                Sin rollos ni stock disponible.
                              </p>
                              <p className="text-muted-foreground">
                                Registre una entrada de inventario antes de aprobar esta línea.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {ln.material?.inventory_area === "material" ? (
                                <p className="text-xs text-muted-foreground">
                                  Sin rollos con código registrados. Stock en sistema:{" "}
                                  <span className="font-medium text-foreground">
                                    {stock.toFixed(3)} {ln.material.unit || "kg"}
                                  </span>
                                  {rem > stock + 0.0005 && stock > 0 ? (
                                    <span className="block text-amber-800 dark:text-amber-200">
                                      Pendiente {rem.toFixed(3)} kg — puede aprobar hasta{" "}
                                      {maxQty.toFixed(3)} kg ahora (parcial).
                                    </span>
                                  ) : null}
                                </p>
                              ) : null}
                              {qtyOverPending ? (
                                <p className="text-xs text-destructive">
                                  Supera lo pendiente ({rem.toFixed(3)}).
                                </p>
                              ) : null}
                              {qtyOverStock ? (
                                <p className="text-xs text-destructive">
                                  Supera el stock disponible ({stock.toFixed(3)}).
                                </p>
                              ) : null}
                              <Input
                                inputMode="decimal"
                                placeholder={
                                  rem > 0
                                    ? `Máx. ${maxQty.toFixed(3)} ${ln.material?.unit || "kg"}`
                                    : ""
                                }
                                value={qty[lineKey] ?? ""}
                                onChange={(ev) =>
                                  setQty((prev) => ({
                                    ...prev,
                                    [lineKey]: ev.target.value,
                                  }))
                                }
                                disabled={rem <= 0}
                              />
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button
            type="button"
            onClick={() => void dispatch()}
            disabled={dispatching || !canDispatch || loading || hasBlockedLines}
          >
            {dispatching ? "Procesando…" : variant === "approval" ? "Aplicar aprobación" : "Despachar selección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
