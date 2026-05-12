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

type BobinaRow = {
  id: number
  code?: string | null
  status: string
  weight_kg: string | null
  material_id?: number
}

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
      const q: Record<string, string> = {}
      for (const ln of d.lines ?? []) {
        const req = Number(ln.quantity_requested)
        const dis = Number(ln.quantity_dispatched)
        const rem = Math.max(0, req - dis)
        q[String(ln.id)] = rem > 0 ? String(rem) : ""
      }
      setQty(q)

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

  async function dispatch() {
    if (!detail) return
    const lines = detail.lines
      .map((ln) => {
        const lineKey = String(ln.id)
        const isBobina = ln.material?.inventory_area === "material"
        if (isBobina) {
          const sel = selectedBobinaIds[lineKey] ?? {}
          const ids = Object.keys(sel)
            .filter((k) => sel[k])
            .map((k) => Number(k))
            .filter((n) => Number.isFinite(n) && n > 0)
          if (!ids.length) return null
          const list = bobinasByLine[lineKey] ?? []
          const total = ids.reduce((acc, id) => {
            const b = list.find((x) => x.id === id)
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
      toast.error(
        variant === "approval"
          ? "Indique cantidades o bobinas a aprobar."
          : "Indique cantidades a despachar.",
      )
      return
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
                Se cargan existencias y bobinas disponibles. Seleccione cantidades o bobinas: al confirmar, el
                sistema <strong>rebaja el inventario</strong> y registra el movimiento.
              </>
            ) : (
              <>
                Seleccione cantidades o bobinas y confirme para registrar la salida de inventario.
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
                    const req = Number(ln.quantity_requested)
                    const dis = Number(ln.quantity_dispatched)
                    const rem = Math.max(0, req - dis)
                    const isBobina = ln.material?.inventory_area === "material"
                    const lineKey = String(ln.id)
                    const bobinas = bobinasByLine[lineKey] ?? []
                    const sel = selectedBobinaIds[lineKey] ?? {}
                    const selectedIds = Object.keys(sel).filter((k) => sel[k])
                    const selectedKg = selectedIds.reduce((acc, idStr) => {
                      const idn = Number(idStr)
                      const b = bobinas.find((x) => x.id === idn)
                      const w = b?.weight_kg ? Number(b.weight_kg) : 0
                      return acc + (Number.isFinite(w) ? w : 0)
                    }, 0)
                    const overSelected = isBobina && selectedKg - rem > 0.0005
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
                          {isBobina ? (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                Seleccione bobinas (sumatoria kg). Seleccionado:{" "}
                                <span className="font-medium">
                                  {selectedKg.toFixed(3)} kg
                                </span>
                              </div>
                              {overSelected ? (
                                <div className="text-xs text-destructive">
                                  La selección excede lo pendiente ({rem.toFixed(3)} kg).
                                </div>
                              ) : null}
                              <div className="max-h-40 overflow-auto rounded-md border p-2">
                                {!bobinas.length ? (
                                  <div className="text-xs text-muted-foreground">
                                    Sin bobinas disponibles para este material.
                                  </div>
                                ) : (
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
                                            (!sel[String(b.id)] &&
                                              selectedKg >= rem - 0.0005)
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
                                )}
                              </div>
                            </div>
                          ) : (
                            <Input
                              inputMode="decimal"
                              value={qty[lineKey] ?? ""}
                              onChange={(ev) =>
                                setQty((prev) => ({
                                  ...prev,
                                  [lineKey]: ev.target.value,
                                }))
                              }
                              disabled={rem <= 0}
                            />
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
            disabled={dispatching || !canDispatch || loading}
          >
            {dispatching ? "Procesando…" : variant === "approval" ? "Aplicar aprobación" : "Despachar selección"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
