"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { LaravelPaginated, MaterialRow } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PoLine = {
  id: number
  material_id: number | null
  quantity_ordered: string
  quantity_received: string
  material?: Pick<MaterialRow, "id" | "sku" | "name">
}

type PurchaseOrderDetail = {
  id: number
  code: string
  lines: PoLine[]
}

type FreeLine = {
  material_id: string
  quantity: string
}

export default function PurchaseReceiptNewPage() {
  const [orders, setOrders] = useState<
    LaravelPaginated<{ id: number; code: string; status: string }>
  | null>(null)
  const [poId, setPoId] = useState<string>("")
  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null)
  const [loadingPo, setLoadingPo] = useState(false)

  const [withoutPo, setWithoutPo] = useState(false)
  const [exceptionReason, setExceptionReason] = useState("")
  const [notes, setNotes] = useState("")
  const [receivedAt, setReceivedAt] = useState("")

  const [qtyByLineId, setQtyByLineId] = useState<Record<string, string>>({})
  const [bobinaCountByLineId, setBobinaCountByLineId] = useState<Record<string, string>>({})
  const [bobinaWeightByLineId, setBobinaWeightByLineId] = useState<Record<string, string>>({})
  const [freeLines, setFreeLines] = useState<FreeLine[]>([
    { material_id: "", quantity: "" },
  ])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let c = false
    void (async () => {
      try {
        const [o, m] = await Promise.all([
          apiFetch<LaravelPaginated<{ id: number; code: string; status: string }>>(
            "purchase-orders",
            { query: { per_page: 100, page: 1 } },
          ).catch(() => null),
          apiFetch<LaravelPaginated<MaterialRow>>("materials", {
            query: { per_page: 300, page: 1 },
          }),
        ])
        if (!c) {
          if (o) setOrders(o)
          setMaterials(m.data)
        }
      } catch {
        if (!c) {
          setOrders(null)
          setMaterials([])
        }
      }
    })()
    return () => {
      c = true
    }
  }, [])

  const loadPo = useCallback(async () => {
    const id = Number(poId)
    if (!Number.isFinite(id) || id < 1) {
      setPoDetail(null)
      setQtyByLineId({})
      return
    }
    setLoadingPo(true)
    try {
      const d = await apiFetch<PurchaseOrderDetail>(`purchase-orders/${id}`)
      setPoDetail(d)
      const init: Record<string, string> = {}
      const initB: Record<string, string> = {}
      const initW: Record<string, string> = {}
      for (const ln of d.lines ?? []) {
        const ord = String(ln.quantity_ordered ?? "0")
        const rec = String(ln.quantity_received ?? "0")
        const remaining = Math.max(0, Number(ord) - Number(rec))
        init[String(ln.id)] = remaining > 0 ? String(remaining) : ""
        initB[String(ln.id)] = ""
        initW[String(ln.id)] = ""
      }
      setQtyByLineId(init)
      setBobinaCountByLineId(initB)
      setBobinaWeightByLineId(initW)
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo cargar la OC.")
      setPoDetail(null)
    } finally {
      setLoadingPo(false)
    }
  }, [poId])

  useEffect(() => {
    if (!withoutPo && poId) void loadPo()
  }, [withoutPo, poId, loadPo])

  function addFreeLine() {
    setFreeLines((p) => [...p, { material_id: "", quantity: "" }])
  }

  function updateFreeLine(i: number, patch: Partial<FreeLine>) {
    setFreeLines((p) => p.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()

    if (!withoutPo) {
      const pid = Number(poId)
      if (!Number.isFinite(pid) || pid < 1) {
        toast.error("Seleccione la orden de compra.")
        return
      }
      if (!poDetail?.lines?.length) {
        toast.error("La OC no tiene líneas.")
        return
      }

      // Requisito: para materiales de área "material", exigir cantidad de bobinas.
      for (const ln of poDetail.lines ?? []) {
        const mid = ln.material_id
        if (!mid) continue
        const mat = materials.find((m) => m.id === mid)
        if (mat?.inventory_area !== "material") continue
        const q = Number(qtyByLineId[String(ln.id)] ?? 0)
        if (!Number.isFinite(q) || q <= 0) continue // si no se recibe en esta línea, no exigir
        const bCountRaw = (bobinaCountByLineId[String(ln.id)] ?? "").trim()
        const bCount = Number(bCountRaw)
        if (!bCountRaw || !Number.isFinite(bCount) || bCount < 1) {
          toast.error(
            `Indique cantidad de bobinas para la línea #${ln.id} (${mat.sku}).`,
          )
          return
        }
      }
      const lines = poDetail.lines
        .map((ln) => {
          const q = Number(qtyByLineId[String(ln.id)] ?? 0)
          if (!Number.isFinite(q) || q <= 0) return null
          const mid = ln.material_id
          if (!mid) {
            toast.error(`La línea #${ln.id} no tiene material en la OC.`)
            return null
          }
          const bCountRaw = (bobinaCountByLineId[String(ln.id)] ?? "").trim()
          const bWeightRaw = (bobinaWeightByLineId[String(ln.id)] ?? "").trim()
          const bobina_count =
            bCountRaw && Number.isFinite(Number(bCountRaw)) ? Number(bCountRaw) : undefined
          const bobina_weight_kg =
            bWeightRaw && Number.isFinite(Number(bWeightRaw)) ? Number(bWeightRaw) : undefined

          return {
            purchase_order_line_id: ln.id,
            material_id: mid,
            quantity: q,
            ...(bobina_count && bobina_count > 0 ? { bobina_count } : {}),
            ...(bobina_weight_kg && bobina_weight_kg > 0
              ? { bobina_weight_kg }
              : {}),
          }
        })
        .filter(Boolean) as {
        purchase_order_line_id: number
        material_id: number
        quantity: number
        bobina_count?: number
        bobina_weight_kg?: number
      }[]

      if (!lines.length) {
        toast.error("Indique cantidades a recibir en al menos una línea.")
        return
      }

      setSaving(true)
      try {
        await apiFetch("purchase-receipts", {
          method: "POST",
          body: JSON.stringify({
            purchase_order_id: pid,
            without_purchase_order: false,
            notes: notes.trim() || null,
            received_at: receivedAt || null,
            lines,
          }),
        })
        toast.success("Recepción registrada.")
        void loadPo()
      } catch (e) {
        if (e instanceof ApiError) toast.error(e.message)
        else toast.error("No se pudo registrar la recepción.")
      } finally {
        setSaving(false)
      }
      return
    }

    const reason = exceptionReason.trim()
    if (!reason) {
      toast.error("Indique el motivo de la recepción sin orden de compra.")
      return
    }
    const lines = freeLines
      .map((L) => ({
        material_id: Number(L.material_id),
        quantity: Number(L.quantity),
      }))
      .filter(
        (L) =>
          Number.isFinite(L.material_id) &&
          L.material_id > 0 &&
          Number.isFinite(L.quantity) &&
          L.quantity > 0,
      )

    if (!lines.length) {
      toast.error("Agregue al menos una línea con material y cantidad.")
      return
    }

    setSaving(true)
    try {
      await apiFetch("purchase-receipts", {
        method: "POST",
        body: JSON.stringify({
          without_purchase_order: true,
          exception_reason: reason,
          notes: notes.trim() || null,
          received_at: receivedAt || null,
          lines,
        }),
      })
      toast.success("Recepción sin OC registrada.")
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo registrar la recepción.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nueva recepción (materia prima)
          </h1>
          <p className="text-muted-foreground text-sm">
            Primero OC; si no aplica, marque sin OC e indique el motivo.{" "}
            <code className="text-xs">POST /purchase-receipts</code>
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/axones/recepciones-oc">Ver historial</Link>
        </Button>
      </div>

      <form
        onSubmit={(ev) => void submit(ev)}
        className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 p-4">
          <Checkbox
            id="no-po"
            checked={withoutPo}
            onCheckedChange={(v) => {
              setWithoutPo(v === true)
              if (v === true) {
                setPoId("")
                setPoDetail(null)
              }
            }}
          />
          <Label htmlFor="no-po" className="cursor-pointer text-sm font-normal">
            Recepción sin orden de compra (stock de seguridad u otro motivo)
          </Label>
        </div>

        {!withoutPo ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Orden de compra *</Label>
              <Select
                value={poId || undefined}
                onValueChange={(v) => setPoId(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione OC abierta…" />
                </SelectTrigger>
                <SelectContent>
                  {(orders?.data ?? [])
                    .filter((o) => o.status === "open" || o.status === "partial")
                    .map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.code} ({o.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Si no aparece, cree la OC o cambie el estado en el backend.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rc-date">Fecha recepción</Label>
              <Input
                id="rc-date"
                type="datetime-local"
                value={receivedAt}
                onChange={(ev) => setReceivedAt(ev.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="ex-reason">Motivo (sin OC) *</Label>
              <Textarea
                id="ex-reason"
                rows={3}
                value={exceptionReason}
                onChange={(ev) => setExceptionReason(ev.target.value)}
                placeholder="Explique por qué no hay OC que casar…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rc-date-free">Fecha recepción</Label>
              <Input
                id="rc-date-free"
                type="datetime-local"
                value={receivedAt}
                onChange={(ev) => setReceivedAt(ev.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="rc-notes">Notas</Label>
          <Textarea
            id="rc-notes"
            rows={2}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />
        </div>

        {!withoutPo ? (
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Líneas de la OC</h2>
            {loadingPo ? (
              <p className="text-muted-foreground text-sm">Cargando OC…</p>
            ) : !poDetail ? (
              <p className="text-muted-foreground text-sm">
                Seleccione una orden de compra.
              </p>
            ) : (
              <div className="space-y-3">
                {(poDetail.lines ?? []).map((ln) => {
                  const ord = Number(ln.quantity_ordered)
                  const rec = Number(ln.quantity_received)
                  const rem = Math.max(0, ord - rec)
                  const mid = ln.material_id
                  const mat = mid
                    ? materials.find((m) => m.id === mid)
                    : undefined
                  const isBobinaMaterial = mat?.inventory_area === "material"
                  return (
                    <div
                      key={ln.id}
                      className="grid gap-2 rounded-xl border p-4 md:grid-cols-12 md:items-end"
                    >
                      <div className="md:col-span-7 text-sm">
                        <div className="font-medium">
                          {ln.material?.sku ?? "—"} · {ln.material?.name ?? "Material"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Pedido {ln.quantity_ordered} · Recibido{" "}
                          {ln.quantity_received} · Pendiente {rem.toFixed(3)}
                        </div>
                      </div>
                      <div className="md:col-span-5 grid gap-2">
                        <Label className="text-xs">Cantidad a recibir ahora</Label>
                        <Input
                          inputMode="decimal"
                          value={qtyByLineId[String(ln.id)] ?? ""}
                          onChange={(ev) =>
                            setQtyByLineId((prev) => ({
                              ...prev,
                              [String(ln.id)]: ev.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                        {isBobinaMaterial ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label className="text-xs">
                                Cantidad de bobinas *
                              </Label>
                              <Input
                                inputMode="numeric"
                                value={bobinaCountByLineId[String(ln.id)] ?? ""}
                                onChange={(ev) =>
                                  setBobinaCountByLineId((prev) => ({
                                    ...prev,
                                    [String(ln.id)]: ev.target.value,
                                  }))
                                }
                                placeholder="ej. 5"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-xs">
                                Peso por bobina (kg) (opcional)
                              </Label>
                              <Input
                                inputMode="decimal"
                                value={bobinaWeightByLineId[String(ln.id)] ?? ""}
                                onChange={(ev) =>
                                  setBobinaWeightByLineId((prev) => ({
                                    ...prev,
                                    [String(ln.id)]: ev.target.value,
                                  }))
                                }
                                placeholder="auto"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Materiales recibidos</h2>
              <Button type="button" size="sm" variant="secondary" onClick={addFreeLine}>
                Añadir línea
              </Button>
            </div>
            {freeLines.map((L, i) => (
              <div
                key={i}
                className="grid gap-3 rounded-xl border p-4 md:grid-cols-12 md:items-end"
              >
                <div className="md:col-span-8 grid gap-2">
                  <Label className="text-xs">Material *</Label>
                  <Select
                    value={L.material_id || undefined}
                    onValueChange={(v) => updateFreeLine(i, { material_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.sku} — {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4 grid gap-2">
                  <Label className="text-xs">Cantidad *</Label>
                  <Input
                    inputMode="decimal"
                    value={L.quantity}
                    onChange={(ev) =>
                      updateFreeLine(i, { quantity: ev.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : "Registrar recepción"}
        </Button>
      </form>
    </div>
  )
}
