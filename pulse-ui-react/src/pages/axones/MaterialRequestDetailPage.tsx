"use client"

import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"

import { apiFetch, ApiError } from "@/lib/api"
import type { ClientRecord, LaravelPaginated, ProductRecord } from "@/types/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  material_id: number
  quantity_requested: string
  quantity_dispatched: string
  material?: { sku: string; name: string; unit: string; inventory_area?: string }
}

type Detail = {
  id: number
  work_order_id: number
  status: string
  work_order?: {
    code: string
    client?: Pick<ClientRecord, "name">
    product?: Pick<ProductRecord, "name">
  }
  lines: LineRow[]
}

type BobinaRow = {
  id: number
  code?: string | null
  status: string
  weight_kg: string | null
  material_id?: number
}

export default function MaterialRequestDetailPage() {
  const { id } = useParams()
  const rid = id ? Number(id) : NaN

  const [loading, setLoading] = useState(true)
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
    if (!Number.isFinite(rid) || rid < 1) return
    setLoading(true)
    try {
      const d = await apiFetch<Detail>(`material-requests/${rid}`)
      setDetail(d)
      const q: Record<string, string> = {}
      for (const ln of d.lines ?? []) {
        const req = Number(ln.quantity_requested)
        const dis = Number(ln.quantity_dispatched)
        const rem = Math.max(0, req - dis)
        q[String(ln.id)] = rem > 0 ? String(rem) : ""
      }
      setQty(q)

      // Pre-carga bobinas disponibles por línea cuando el material es de área "material"
      const lines = d.lines ?? []
      const wanted = lines.filter((ln) => ln.material?.inventory_area === "material")
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
  }, [rid])

  useEffect(() => {
    void load()
  }, [load])

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
      toast.error("Indique cantidades a despachar.")
      return
    }

    setDispatching(true)
    try {
      await apiFetch(`material-requests/${detail.id}/dispatch`, {
        method: "POST",
        body: JSON.stringify({ lines }),
      })
      toast.success("Despacho aplicado al inventario.")
      void load()
    } catch (e) {
      if (e instanceof ApiError) toast.error(e.message)
      else toast.error("No se pudo despachar.")
    } finally {
      setDispatching(false)
    }
  }

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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Solicitud #{rid}
          </h1>
          <p className="text-muted-foreground text-sm">
            Autorice desde el listado; aquí despacha cantidades contra inventario.
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/axones/solicitudes-material">Volver</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : !detail ? null : (
        <>
          <div className="rounded-xl border bg-card p-4 text-sm shadow-sm">
            <div>
              <span className="text-muted-foreground">OT: </span>
              <Link
                className="text-primary underline-offset-4 hover:underline"
                to={`/axones/ordenes-trabajo/${detail.work_order_id}`}
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
            <div>
              <span className="text-muted-foreground">Estado: </span>
              {detail.status}
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
                  <TableHead>Despachar ahora</TableHead>
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
                        <div className="font-mono text-xs">{ln.material?.sku}</div>
                        <div>{ln.material?.name}</div>
                      </TableCell>
                      <TableCell>{ln.quantity_requested}</TableCell>
                      <TableCell>{ln.quantity_dispatched}</TableCell>
                      <TableCell>{rem.toFixed(3)}</TableCell>
                      <TableCell className="w-[340px]">
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
                                La selección excede lo pendiente ({rem.toFixed(3)} kg). Quite
                                bobinas para poder despachar.
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
                                    // Evita pasar el pendiente: si no está marcado y ya excede, bloquea marcar.
                                    // El backend igual valida, pero esto mejora UX.
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

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void dispatch()}
              disabled={
                dispatching ||
                detail.status === "cancelled" ||
                detail.status === "dispatched"
              }
            >
              {dispatching ? "Procesando…" : "Despachar selección"}
            </Button>
            {detail.status === "pending" ? (
              <p className="text-muted-foreground text-xs">
                Pendiente de autorización en el listado; el backend puede
                permitir despacho según política interna.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
